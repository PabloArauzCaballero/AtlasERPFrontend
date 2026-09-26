import { describe, expect, it } from 'vitest';
import { conReintentos, esRespuestaDePasarela, merecePrueba } from '@/lib/reintentos';

describe('pasarela durante un despliegue', () => {
  it('distingue errores HTML de la pasarela de errores JSON del backend', () => {
    const html = new Response('Bad Gateway', { status: 503, headers: { 'content-type': 'text/html' } });
    const backend = new Response('{"error":"x"}', { status: 503, headers: { 'content-type': 'application/json' } });
    expect(esRespuestaDePasarela(html)).toBe(true);
    expect(esRespuestaDePasarela(backend)).toBe(false);
    expect(merecePrueba({ response: html }, 'con-llave')).toBe(true);
    expect(merecePrueba({ response: backend }, 'segura')).toBe(false);
  });

  it('no repite POST ante 504 ni corte de red que pudieron llegar al backend', () => {
    const gatewayTimeout = new Response('Gateway Timeout', { status: 504 });
    expect(merecePrueba({ response: gatewayTimeout }, 'unica')).toBe(false);
    expect(merecePrueba({ error: new Error('red'), sinRespuesta: true }, 'unica')).toBe(false);
  });

  it('reintenta GET tras un 503 HTML y termina con la respuesta JSON', async () => {
    let count = 0;
    const result = await conReintentos(
      async () => ++count === 1 ? new Response('Bad Gateway', { status: 503 }) : new Response('{}', {
        headers: { 'content-type': 'application/json' },
      }),
      { repeticion: 'segura', esSinRespuesta: () => false, dormir: async () => undefined },
    );
    expect(result.ok).toBe(true);
    expect(count).toBe(2);
  });
});
