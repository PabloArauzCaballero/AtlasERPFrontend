// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/errores-cliente/route';
import { DESTINO_POR_DEFECTO, LIMITE_POR_MINUTO, reiniciarLimiteParaPruebas } from '@/lib/reenvioErroresCliente';

const SHA = 'b'.repeat(40);
let llamadas: { url: string; init: RequestInit }[];

function llamada(i = 0): { url: string; init: RequestInit } {
  const l = llamadas[i];
  if (!l) throw new Error(`no hubo envío ${i}`);
  return l;
}

function reporte(cuerpo: unknown, cabeceras: Record<string, string> = {}): Request {
  return new Request('http://erp.local/errores-cliente', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.1', ...cabeceras },
    body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
  });
}

const valido = { kind: 'error', message: 'falló', stack: 'Error: falló\n at x', route: '/login', userAgent: 'Mozilla/5.0' };

beforeEach(() => {
  reiniciarLimiteParaPruebas();
  llamadas = [];
  vi.stubEnv('BUILD_INFO_PATH', '/no/existe/build-info.json');
  vi.stubEnv('APP_COMMIT_SHA', SHA);
  vi.stubEnv('CLIENT_ERRORS_FORWARD_URL', '');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      llamadas.push({ url, init });
      return new Response('{}', { status: 202 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const reenviado = (i = 0) => JSON.parse(String(llamada(i).init.body)) as Record<string, unknown>;

describe('POST /errores-cliente', () => {
  it('acepta sin sesión, responde 202 y reenvía al alias del núcleo', async () => {
    const r = await POST(reporte(valido));
    expect(r.status).toBe(202);
    expect(llamadas).toHaveLength(1);
    expect(llamada().url).toBe(DESTINO_POR_DEFECTO);
    expect(llamada().init.method).toBe('POST');
    expect(llamada().init.signal).toBeInstanceOf(AbortSignal);
  });

  it('usa CLIENT_ERRORS_FORWARD_URL si está', async () => {
    vi.stubEnv('CLIENT_ERRORS_FORWARD_URL', 'http://receptor.local:9999/api/v1/client-errors');
    await POST(reporte(valido));
    expect(llamada().url).toBe('http://receptor.local:9999/api/v1/client-errors');
  });

  it('fija surface y release en el servidor y recorta la ruta al pathname', async () => {
    await POST(reporte({ ...valido, surface: 'admin-portal', release: 'mentira', route: '/operaciones/x?ci=123#h' }));
    expect(reenviado()).toEqual({
      surface: 'erp-frontend',
      kind: 'error',
      message: 'falló',
      stack: valido.stack,
      route: '/operaciones/x',
      release: SHA,
      userAgent: 'Mozilla/5.0',
    });
  });

  it('reenvía sólo el JSON validado: ni cookies, ni Authorization, ni campos de más', async () => {
    await POST(reporte({ ...valido, body: 'secreto', headers: { a: 1 } }, { cookie: 'sid=1', authorization: 'Bearer abc.def.ghi' }));
    expect(llamada().init.headers).toEqual({ 'content-type': 'application/json' });
    expect(String(llamada().init.body)).not.toMatch(/secreto|sid=1|Bearer/);
  });

  it.each([
    ['sin kind', { message: 'x' }],
    ['kind desconocido', { kind: 'otro', message: 'x' }],
    ['mensaje vacío', { kind: 'error', message: '   ' }],
    ['mensaje largo', { kind: 'error', message: 'x'.repeat(1001) }],
    ['pila larga', { kind: 'error', message: 'x', stack: 's'.repeat(8001) }],
    ['agente largo', { kind: 'error', message: 'x', userAgent: 'u'.repeat(401) }],
    ['tipo erróneo', { kind: 'error', message: 'x', route: 42 }],
    ['un array', [valido]],
  ])('400 si viene %s', async (_, cuerpo) => {
    expect((await POST(reporte(cuerpo))).status).toBe(400);
    expect(llamadas).toHaveLength(0);
  });

  it('400 si no es JSON', async () => {
    expect((await POST(reporte('esto no es json'))).status).toBe(400);
  });

  it('413 si pasa de 16 KB', async () => {
    const grande = JSON.stringify({ kind: 'error', message: 'x', stack: 'y'.repeat(17 * 1024) });
    expect((await POST(reporte(grande))).status).toBe(413);
    expect(llamadas).toHaveLength(0);
  });

  it(`429 pasado el límite de ${LIMITE_POR_MINUTO} por minuto e IP, sin afectar a otra IP`, async () => {
    for (let i = 0; i < LIMITE_POR_MINUTO; i += 1) expect((await POST(reporte(valido))).status).toBe(202);
    expect((await POST(reporte(valido))).status).toBe(429);
    expect((await POST(reporte(valido, { 'x-forwarded-for': '10.0.0.2' }))).status).toBe(202);
    expect(llamadas).toHaveLength(LIMITE_POR_MINUTO + 1);
  });

  it('cuenta por la IP que añade el proxy, no por la que escribe el cliente', async () => {
    for (let i = 0; i < LIMITE_POR_MINUTO; i += 1) await POST(reporte(valido, { 'x-forwarded-for': `1.1.1.${i}, 10.0.0.9` }));
    expect((await POST(reporte(valido, { 'x-forwarded-for': '9.9.9.9, 10.0.0.9' }))).status).toBe(429);
  });

  it('202 aunque el núcleo no responda', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('ECONNREFUSED'))));
    expect((await POST(reporte(valido))).status).toBe(202);
  });

  it('202 aunque el núcleo conteste con error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('caído', { status: 503 })));
    expect((await POST(reporte(valido))).status).toBe(202);
  });
});
