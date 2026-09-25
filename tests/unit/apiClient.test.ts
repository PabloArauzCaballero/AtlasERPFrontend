import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, MENSAJE_RESULTADO_DESCONOCIDO, apiFileDownload, apiRequest } from '@/lib/apiClient';
import { conReintentos, repeticionDe } from '@/lib/reintentos';

/**
 * Portado de `erpf-reintentos.diag.ts` y `erpf-peor-caso.diag.ts` (plan de producción 2026-09-24,
 * ATL-04 / FND-ERPF-01). Antes: un POST sin llave ante un 502 en texto se mandaba hasta 11 veces, y
 * con un 401 de por medio hasta 22; un 200 con HTML o con `{ success: false }` se daba por éxito.
 */

type Llamada = { url: string; method: string; headers: Record<string, string> };
let llamadas: Llamada[] = [];

const texto = (status: number, body = 'Internal Server Error', tipo = 'text/plain') =>
  new Response(body, { status, headers: { 'content-type': tipo } });
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function simularFetch(responder: (llamada: Llamada, n: number) => Response | Promise<Response>) {
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const llamada = { url: String(url), method: String(init?.method ?? 'GET'), headers: (init?.headers ?? {}) as Record<string, string> };
    llamadas.push(llamada);
    return responder(llamada, llamadas.length);
  }) as typeof fetch;
}

async function resolver<T>(promesa: Promise<T>) {
  const resultado = promesa.then(
    (valor) => ({ ok: true as const, valor }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  return resultado;
}

const aDiario = (url: string) => url.includes('journal');

beforeEach(() => {
  llamadas = [];
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.spyOn(Math, 'random').mockReturnValue(0);
  window.localStorage.setItem('atlas_access_token', 'tok');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('repeticionDe', () => {
  it('clasifica por método y por llave', () => {
    expect(repeticionDe('GET')).toBe('segura');
    expect(repeticionDe(undefined)).toBe('segura');
    expect(repeticionDe('POST')).toBe('unica');
    expect(repeticionDe('DELETE', {})).toBe('unica');
    expect(repeticionDe('POST', { 'x-idempotency-key': 'k' })).toBe('con-llave');
    expect(repeticionDe('PATCH', { 'Idempotency-Key': 'k' })).toBe('con-llave');
  });

  it('una mutación sin llave no se repite ni ante la pasarela', async () => {
    let n = 0;
    await conReintentos(async () => (n++, texto(502)), { repeticion: 'unica', esSinRespuesta: () => true, dormir: async () => {} });
    expect(n).toBe(1);
  });
});

describe('apiRequest: mutaciones sin llave', () => {
  for (const [status, tipo] of [[500, 'text/plain'], [502, 'text/html'], [503, 'text/plain'], [404, 'text/plain'], [504, 'text/plain']] as const) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE'] as const) {
      it(`${method} ante ${status} ${tipo}: un solo envío y resultado desconocido`, async () => {
        simularFetch(() => texto(status, 'x', tipo));
        const r = await resolver(apiRequest('/accounting/journal-entries', { method, body: { a: 1 } }));
        expect(llamadas).toHaveLength(1);
        expect(r.ok).toBe(false);
        const error = (r as { error: ApiError }).error;
        expect(error).toBeInstanceOf(ApiError);
        expect(error.resultadoDesconocido).toBe(true);
        expect(error.message).toBe(MENSAJE_RESULTADO_DESCONOCIDO);
      });
    }
  }

  it('el mensaje no pide repetir a ciegas ni usa jerga técnica', () => {
    expect(MENSAJE_RESULTADO_DESCONOCIDO).not.toMatch(/int[eé]ntelo otra vez|HTTP|backend|endpoint|servidor|\d{3}/i);
    expect(MENSAJE_RESULTADO_DESCONOCIDO).toMatch(/revise si ya aparece registrada/);
  });

  it('un error JSON del backend sigue siendo un error normal, sin reintento', async () => {
    simularFetch(() => json(500, { success: false, error: { message: 'Período cerrado' } }));
    const r = await resolver(apiRequest('/accounting/journal-entries', { method: 'POST', body: {} }));
    expect(llamadas).toHaveLength(1);
    const error = (r as { error: ApiError }).error;
    expect(error.message).toBe('Período cerrado');
    expect(error.resultadoDesconocido).toBe(false);
  });

  it('plazo agotado en un POST: un envío y resultado desconocido', async () => {
    globalThis.fetch = vi.fn((url: unknown, init?: RequestInit) => {
      llamadas.push({ url: String(url), method: String(init?.method), headers: {} });
      return new Promise<Response>((_, rechazar) =>
        init?.signal?.addEventListener('abort', () => rechazar(new DOMException('a', 'AbortError'))),
      );
    }) as typeof fetch;
    const r = await resolver(apiRequest('/x', { method: 'POST', body: {} }));
    expect(llamadas).toHaveLength(1);
    expect((r as { error: ApiError }).error.resultadoDesconocido).toBe(true);
  });

  it('401 → refresco → 502: el POST sale dos veces, no 22', async () => {
    simularFetch((llamada) => {
      if (llamada.url.includes('auth/refresh')) return json(200, { success: true, data: { accessToken: 'nuevo' } });
      return llamadas.filter((x) => aDiario(x.url)).length === 1 ? json(401, { success: false, error: { message: 'exp' } }) : texto(502);
    });
    const r = await resolver(apiRequest('/accounting/journal-entries', { method: 'POST', body: {} }));
    expect(llamadas.filter((x) => aDiario(x.url))).toHaveLength(2);
    expect((r as { error: ApiError }).error.resultadoDesconocido).toBe(true);
  });

  it('peor caso del diagnóstico (500 texto en bucle con un 401): un solo envío', async () => {
    simularFetch(() => texto(500));
    await resolver(apiRequest('/accounting/receipts', { method: 'POST', body: {} }));
    expect(llamadas).toHaveLength(1);
  });
});

describe('apiRequest: mutaciones con llave', () => {
  it('se repiten ante la pasarela con la MISMA llave y acaban en éxito', async () => {
    simularFetch((_, n) => (n < 3 ? texto(502) : json(201, { success: true, data: { id: 7 } })));
    const r = await resolver(
      apiRequest<{ id: number }>('/campaigns', { method: 'POST', body: {}, headers: { 'x-idempotency-key': 'llave-1' } }),
    );
    expect(r).toEqual({ ok: true, valor: { id: 7 } });
    expect(llamadas).toHaveLength(3);
    expect(new Set(llamadas.map((l) => l.headers['x-idempotency-key']))).toEqual(new Set(['llave-1']));
  });

  it('si la pasarela no se recupera, el resultado es desconocido', async () => {
    simularFetch(() => texto(502));
    const r = await resolver(apiRequest('/campaigns', { method: 'POST', body: {}, headers: { 'Idempotency-Key': 'k' } }));
    expect(llamadas.length).toBeGreaterThan(1);
    expect((r as { error: ApiError }).error.resultadoDesconocido).toBe(true);
  });
});

describe('apiRequest: lecturas', () => {
  it('un GET sigue repitiéndose ante un corte de red', async () => {
    globalThis.fetch = vi.fn(async () => {
      llamadas.push({ url: '', method: 'GET', headers: {} });
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    const r = await resolver(apiRequest('/x'));
    expect(llamadas.length).toBeGreaterThan(1);
    expect((r as { error: ApiError }).error.resultadoDesconocido).toBe(false);
  });
});

describe('apiRequest: un 2xx fuera de contrato no es éxito', () => {
  it('200 text/html en un POST → error de resultado desconocido', async () => {
    simularFetch(() => texto(200, '<html>login</html>', 'text/html'));
    const r = await resolver(apiRequest('/accounting/invoices', { method: 'POST', body: {} }));
    expect(r.ok).toBe(false);
    expect((r as { error: ApiError }).error.resultadoDesconocido).toBe(true);
  });

  it('200 text/html en un GET → error', async () => {
    simularFetch(() => texto(200, '<html>login</html>', 'text/html'));
    const r = await resolver(apiRequest('/accounting/invoices'));
    expect(r.ok).toBe(false);
  });

  it('200 {success:false} → error con el motivo', async () => {
    simularFetch(() => json(200, { success: false, error: { message: 'rechazado' } }));
    const r = await resolver(apiRequest('/accounting/invoices', { method: 'POST', body: {} }));
    expect(r.ok).toBe(false);
    expect((r as { error: ApiError }).error.message).toBe('rechazado');
  });

  it('201 con JSON roto → error', async () => {
    simularFetch(() => new Response('{not json', { status: 201, headers: { 'content-type': 'application/json' } }));
    const r = await resolver(apiRequest('/accounting/invoices', { method: 'POST', body: {} }));
    expect(r.ok).toBe(false);
  });

  it('204 sin cuerpo → éxito', async () => {
    simularFetch(() => new Response(null, { status: 204 }));
    const r = await resolver(apiRequest('/accounting/invoices/1', { method: 'DELETE' }));
    expect(r).toEqual({ ok: true, valor: null });
    expect(llamadas).toHaveLength(1);
  });

  it('200 con sobre {success:true} → el dato', async () => {
    simularFetch(() => json(200, { success: true, data: [1, 2] }));
    const r = await resolver(apiRequest('/accounting/invoices'));
    expect(r).toEqual({ ok: true, valor: [1, 2] });
  });

  it('una descarga binaria sigue funcionando', async () => {
    simularFetch(() => new Response(new Uint8Array([37, 80, 68, 70]), { status: 200, headers: { 'content-type': 'application/pdf' } }));
    const r = await resolver(apiFileDownload('/documents/1', 'doc.pdf'));
    expect(r.ok).toBe(true);
    const archivo = (r as { valor: { blob: Blob; fileName: string } }).valor;
    expect(archivo.fileName).toBe('doc.pdf');
    expect(archivo.blob.size).toBe(4);
  });
});
