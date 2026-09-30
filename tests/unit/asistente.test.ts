import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import {
  MENSAJE_APAGADO,
  contarMensajes,
  fechaRelativa,
  conReintentoEnCurso,
  describirErrorDelAsistente,
  pantallaDelAsistente,
} from '@/lib/asistente';
import { assistService } from '@/services/assistService';

/**
 * El asistente del ERP: de qué sección habla quien pregunta, qué se le dice cuando algo falla y
 * cómo se repite la MISMA pregunta cuando Core dice que sigue en curso.
 */

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const fetchOriginal = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

describe('pantallaDelAsistente', () => {
  it('nombra la sección del personal con el grupo y la entrada del menú', () => {
    expect(pantallaDelAsistente('/operaciones/contabilidad/cierres', 'erp-staff')).toBe('Contabilidad › Cierres');
    expect(pantallaDelAsistente('/operaciones/crm/cuentas/detalle', 'erp-staff')).toBe('CRM › Cuentas B2B');
    expect(pantallaDelAsistente('/operaciones/crm/sucursales', 'erp-staff')).toBe('CRM › Sucursales');
    expect(pantallaDelAsistente('/operaciones', 'erp-staff')).toBe('Dashboard');
    expect(pantallaDelAsistente('/operaciones/tutoriales', 'erp-staff')).toBe('Centro de Tutoriales');
    expect(pantallaDelAsistente('/operaciones/crm/propuestas', 'erp-staff')).toBe('CRM › Pipeline › Propuestas');
    expect(pantallaDelAsistente('/operaciones/algo-nuevo', 'erp-staff')).toBe('Operaciones');
  });

  it('nombra la sección del comercio con su menú', () => {
    expect(pantallaDelAsistente('/portal-comercio/gestion-pos', 'merchant-portal')).toBe('Gestión POS');
    expect(pantallaDelAsistente('/portal-comercio/soporte', 'merchant-portal')).toBe('Soporte y tutoriales');
    expect(pantallaDelAsistente('/portal-comercio/cuenta', 'merchant-portal')).toBe('Mi cuenta');
  });

  it('solo usa los caracteres que acepta el backend y no pasa de 80', () => {
    const permitido = /^[\p{L}\p{N} ›/·_\-().,]{1,80}$/u;
    for (const ruta of ['/operaciones/contabilidad/impuestos-coa', '/operaciones/crm/tags', '/portal-comercio/facturacion']) {
      expect(pantallaDelAsistente(ruta, ruta.startsWith('/portal') ? 'merchant-portal' : 'erp-staff')).toMatch(permitido);
    }
  });
});

describe('describirErrorDelAsistente', () => {
  it('un 404 es el asistente apagado: se dice así y el campo se deshabilita', () => {
    expect(describirErrorDelAsistente(new ApiError('x', 404, false, false, 'ASSIST_DISABLED'))).toEqual({
      mensaje: MENSAJE_APAGADO,
      apagado: true,
    });
  });

  it('un rechazo trae su propio texto para la persona', () => {
    const rechazo = new ApiError('Esa pregunta no la puedo responder aquí.', 400, false, false, 'ASSIST_REJECTED');
    expect(describirErrorDelAsistente(rechazo)).toEqual({ mensaje: 'Esa pregunta no la puedo responder aquí.', apagado: false });
  });

  it('ocupado, caído y sin conexión no apagan el campo', () => {
    for (const error of [
      new ApiError('x', 429, false, false, 'ASSIST_BUSY'),
      new ApiError('x', 503, false, false, 'ASSIST_UNAVAILABLE'),
      new ApiError('x', 0, true),
      new Error('boom'),
    ]) {
      const descrito = describirErrorDelAsistente(error);
      expect(descrito.apagado).toBe(false);
      expect(descrito.mensaje).not.toMatch(/boom|ASSIST_/);
    }
  });
});

describe('conReintentoEnCurso', () => {
  it('repite tras un 409 esperando lo que pide Retry-After', async () => {
    const dormir = vi.fn(async () => {});
    const enviar = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('en curso', 409, false, false, 'ASSIST_IN_FLIGHT', 3))
      .mockResolvedValueOnce('listo');
    await expect(conReintentoEnCurso(enviar, { dormir })).resolves.toBe('listo');
    expect(dormir).toHaveBeenCalledWith(3000);
    expect(enviar).toHaveBeenCalledTimes(2);
  });

  it('se rinde tras tres reintentos y no repite otros errores', async () => {
    const dormir = vi.fn(async () => {});
    const enCurso = vi.fn().mockRejectedValue(new ApiError('en curso', 409));
    await expect(conReintentoEnCurso(enCurso, { dormir })).rejects.toMatchObject({ status: 409 });
    expect(enCurso).toHaveBeenCalledTimes(4);

    const ocupado = vi.fn().mockRejectedValue(new ApiError('ocupado', 429));
    await expect(conReintentoEnCurso(ocupado, { dormir })).rejects.toMatchObject({ status: 429 });
    expect(ocupado).toHaveBeenCalledTimes(1);
  });
});

describe('assistService', () => {
  it('pregunta por la pasarela del ERP y repite el 409 con el MISMO clientMessageId', async () => {
    const cuerpos: unknown[] = [];
    const urls: string[] = [];
    const llaves: string[] = [];
    let n = 0;
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      urls.push(String(url));
      cuerpos.push(JSON.parse(String(init?.body)));
      llaves.push((init?.headers as Record<string, string>)['x-idempotency-key'] ?? '');
      n += 1;
      if (n === 1) {
        return json(409, { success: false, error: { code: 'ASSIST_IN_FLIGHT', message: 'En curso' } }, { 'retry-after': '1' });
      }
      return json(200, { success: true, data: { reply: 'Está en «Cierres».', suggestHandoff: false, conversationId: 'c1', turnId: 't1' } });
    }) as typeof fetch;

    const pregunta = { prompt: '¿Dónde cierro el mes?', clientMessageId: '0b6c2a8e-6d3f-4c9e-9f1a-2b3c4d5e6f70', screen: 'Contabilidad › Cierres' };
    const respuesta = await assistService.preguntar(pregunta, { dormir: async () => {} });

    expect(respuesta.reply).toBe('Está en «Cierres».');
    expect(urls).toHaveLength(2);
    expect(urls[0]).toMatch(/\/api\/v1\/internal\/assist\/chat$/);
    expect(cuerpos[0]).toEqual(pregunta);
    expect(cuerpos[1]).toEqual(pregunta);
    expect(llaves).toEqual([pregunta.clientMessageId, pregunta.clientMessageId]);
  });

  it('lee la conversación vigente', async () => {
    globalThis.fetch = vi.fn(async () =>
      json(200, { success: true, data: { conversationId: 'c1', turns: [] } }),
    ) as typeof fetch;
    await expect(assistService.conversacion()).resolves.toEqual({ conversationId: 'c1', turns: [] });
    expect(String(vi.mocked(globalThis.fetch).mock.calls[0]?.[0])).toMatch(/\/api\/v1\/internal\/assist\/conversation$/);
  });

  it('lista, abre y borra conversaciones del historial', async () => {
    const llamadas: Array<[string, string]> = [];
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      llamadas.push([init?.method ?? 'GET', String(url)]);
      if (String(url).endsWith('/conversations')) {
        return json(200, { success: true, data: { conversations: [{ conversationId: 'c1', title: 'T', updatedAt: '2026-09-29T10:00:00Z', turnCount: 2 }] } });
      }
      return json(200, { success: true, data: init?.method === 'DELETE' ? { deleted: 1 } : { conversationId: 'c1', title: 'T', turns: [] } });
    }) as typeof fetch;
    await expect(assistService.conversaciones()).resolves.toHaveLength(1);
    await expect(assistService.abrir('c1')).resolves.toMatchObject({ conversationId: 'c1' });
    await expect(assistService.borrar('c1')).resolves.toEqual({ deleted: 1 });
    expect(llamadas.map(([metodo, url]) => `${metodo} ${url.replace(/^.*\/internal/, '')}`)).toEqual([
      'GET /assist/conversations',
      'GET /assist/conversations/c1',
      'DELETE /assist/conversations/c1',
    ]);
  });
});

describe('fechaRelativa y contarMensajes', () => {
  const ahora = new Date('2026-09-29T12:00:00.000Z');
  it.each([
    ['2026-09-29T11:59:40.000Z', 'ahora'],
    ['2026-09-29T11:55:00.000Z', 'hace 5 min'],
    ['2026-09-29T09:00:00.000Z', 'hace 3 h'],
    ['2026-09-28T09:00:00.000Z', 'ayer'],
    ['2026-09-25T12:00:00.000Z', 'hace 4 días'],
    ['fecha-rota', ''],
  ])('%s -> %s', (iso, esperado) => {
    expect(fechaRelativa(iso, ahora)).toBe(esperado);
  });
  it('cada turno son dos mensajes', () => {
    expect(contarMensajes(3)).toBe('6 mensajes');
  });
});
