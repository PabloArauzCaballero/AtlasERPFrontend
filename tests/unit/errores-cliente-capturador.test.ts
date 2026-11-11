import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAXIMO_REPORTES_POR_PAGINA,
  RUTA_ERRORES_CLIENTE,
  instalarCapturadorDeErrores,
  reiniciarCapturadorParaPruebas,
  reportarError,
} from '@/lib/erroresCliente';

let envios: { url: string; init: RequestInit }[];

function envio(i = 0): { url: string; init: RequestInit } {
  const l = envios[i];
  if (!l) throw new Error(`no hubo envío ${i}`);
  return l;
}

beforeEach(() => {
  reiniciarCapturadorParaPruebas();
  envios = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      envios.push({ url, init });
      return new Response(null, { status: 202 });
    }),
  );
  window.history.replaceState(null, '', '/operaciones/clientes?ci=1234567&token=abc#fila-3');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const cuerpo = (i = 0) => JSON.parse(String(envio(i).init.body)) as Record<string, unknown>;

describe('capturador de errores del navegador', () => {
  it('manda al mismo origen, con keepalive, sin cookies y sólo el pathname', () => {
    const error = new Error('se rompió la tabla');
    expect(reportarError('error', error)).toBe(true);
    expect(envios).toHaveLength(1);
    expect(envio().url).toBe(RUTA_ERRORES_CLIENTE);
    expect(envio().init).toMatchObject({ method: 'POST', keepalive: true, credentials: 'omit' });
    expect(envio().init.headers).toEqual({ 'content-type': 'application/json' });
    const b = cuerpo();
    expect(b.route).toBe('/operaciones/clientes');
    expect(JSON.stringify(b)).not.toMatch(/1234567|token|fila-3/);
    expect(b).toMatchObject({ kind: 'error', message: 'se rompió la tabla' });
    expect(typeof b.stack).toBe('string');
    expect(b.surface).toBeUndefined();
    expect(b.release).toBeUndefined();
  });

  it('deduplica por tipo, mensaje y primera línea de la pila', () => {
    const e = new Error('igual');
    expect(reportarError('error', e)).toBe(true);
    expect(reportarError('error', e)).toBe(false);
    expect(reportarError('unhandledrejection', e)).toBe(true);
    expect(envios).toHaveLength(2);
  });

  it(`no pasa de ${MAXIMO_REPORTES_POR_PAGINA} reportes por carga de página`, () => {
    for (let i = 0; i < 25; i += 1) reportarError('error', new Error(`fallo ${i}`));
    expect(envios).toHaveLength(MAXIMO_REPORTES_POR_PAGINA);
  });

  it('ignora extensiones, ResizeObserver, «Script error.» sin pila y abortos', () => {
    const deExtension = new Error('x');
    deExtension.stack = 'Error: x\n    at chrome-extension://abcdef/content.js:1:1';
    expect(reportarError('error', deExtension)).toBe(false);
    expect(reportarError('error', 'algo', 'moz-extension://id/script.js')).toBe(false);
    expect(reportarError('error', new Error('y'), 'safari-extension://id/a.js')).toBe(false);
    expect(reportarError('error', 'ResizeObserver loop completed with undelivered notifications.')).toBe(false);
    expect(reportarError('error', 'Script error.')).toBe(false);
    expect(reportarError('unhandledrejection', new DOMException('The user aborted a request.', 'AbortError'))).toBe(false);
    expect(envios).toHaveLength(0);
  });

  it('recorta el mensaje y la pila a los topes del contrato', () => {
    const e = new Error('m'.repeat(5000));
    e.stack = 's'.repeat(20000);
    reportarError('error', e);
    const b = cuerpo();
    expect(String(b.message)).toHaveLength(1000);
    expect(String(b.stack)).toHaveLength(8000);
  });

  it('nunca lanza aunque el envío falle', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sin red'))));
    expect(() => reportarError('error', new Error('a'))).not.toThrow();
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('síncrono'); }));
    expect(() => reportarError('error', new Error('b'))).not.toThrow();
    await Promise.resolve();
  });

  it('usa sendBeacon sólo si no hay fetch', () => {
    vi.stubGlobal('fetch', undefined);
    const beacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { userAgent: 'prueba', sendBeacon: beacon });
    expect(reportarError('error', new Error('sin fetch'))).toBe(true);
    expect(beacon).toHaveBeenCalledWith(RUTA_ERRORES_CLIENTE, expect.any(Blob));
  });

  it('se instala una sola vez y reporta `error` y `unhandledrejection` de la ventana', () => {
    const espia = vi.spyOn(window, 'addEventListener');
    instalarCapturadorDeErrores();
    instalarCapturadorDeErrores();
    expect(espia.mock.calls.filter(([t]) => t === 'error')).toHaveLength(1);
    expect(espia.mock.calls.filter(([t]) => t === 'unhandledrejection')).toHaveLength(1);

    window.dispatchEvent(new ErrorEvent('error', { error: new Error('desde la ventana'), message: 'desde la ventana' }));
    const rechazo = new Event('unhandledrejection') as Event & { reason?: unknown };
    rechazo.reason = new Error('promesa sin catch');
    window.dispatchEvent(rechazo);
    // Un evento `error` que no es ErrorEvent (un recurso que no cargó) no se reporta.
    window.dispatchEvent(new Event('error'));
    expect(envios.map((_, i) => cuerpo(i).kind)).toEqual(['error', 'unhandledrejection']);
    expect(cuerpo(1).message).toBe('promesa sin catch');
  });
});
