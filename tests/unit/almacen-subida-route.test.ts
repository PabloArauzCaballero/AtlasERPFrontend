// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PUT } from '@/app/almacen/subida/route';
import { CABECERA_DESTINO } from '@/lib/almacen';

const FIRMA = 'X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=c&X-Amz-Signature=s';
const TEST = 'minio.161.97.85.216.sslip.io';
const DEV = 'pablo-h310.taila8f993.ts.net';

function subida(destino: string, cuerpo = 'hola', cabeceras: Record<string, string> = {}): Request {
  return new Request('http://erp.local/almacen/subida', {
    method: 'PUT',
    headers: { [CABECERA_DESTINO]: destino, 'content-length': String(cuerpo.length), ...cabeceras },
    body: cuerpo,
  });
}

let destinoPedido: URL | null;

beforeEach(() => {
  destinoPedido = null;
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('ALMACEN_HOSTS_PERMITIDOS', `${TEST}, ${DEV}`);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL) => {
      destinoPedido = url;
      return new Response(null, { status: 200, headers: { etag: '"abc"' } });
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('PUT /almacen/subida', () => {
  it('reenvía al host listado (TEST, http implícito) y devuelve el estado', async () => {
    const r = await PUT(subida(`http://${TEST}/bucket/obj?${FIRMA}`));
    expect(r.status).toBe(200);
    expect(r.headers.get('etag')).toBe('"abc"');
    expect(destinoPedido?.host).toBe(TEST);
  });

  it('reenvía al host listado de DEV por https', async () => {
    expect((await PUT(subida(`https://${DEV}/bucket/obj?${FIRMA}`))).status).toBe(200);
  });

  it('rechaza un host malicioso con 403 y no sale a la red', async () => {
    const r = await PUT(subida(`http://169.254.169.254/latest?${FIRMA}`));
    expect(r.status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rechaza minio.<ip>.sslip.io no listado con 403', async () => {
    expect((await PUT(subida(`http://minio.10.0.0.5.sslip.io/x?${FIRMA}`))).status).toBe(403);
    expect((await PUT(subida(`https://otro.ts.net/x?${FIRMA}`))).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rechaza un puerto distinto del implícito si la lista no lo nombra', async () => {
    expect((await PUT(subida(`http://${TEST}:9000/x?${FIRMA}`))).status).toBe(403);
    vi.stubEnv('ALMACEN_HOSTS_PERMITIDOS', `${TEST}:9000`);
    expect((await PUT(subida(`http://${TEST}:9000/x?${FIRMA}`))).status).toBe(200);
    expect((await PUT(subida(`http://${TEST}/x?${FIRMA}`))).status).toBe(403);
  });

  it('con la lista vacía en producción responde 503, también para localhost', async () => {
    vi.stubEnv('ALMACEN_HOSTS_PERMITIDOS', '');
    expect((await PUT(subida(`http://${TEST}/x?${FIRMA}`))).status).toBe(503);
    expect((await PUT(subida(`http://localhost:9000/x?${FIRMA}`))).status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('con la lista vacía fuera de producción sólo deja localhost', async () => {
    vi.stubEnv('ALMACEN_HOSTS_PERMITIDOS', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect((await PUT(subida(`http://localhost:9000/x?${FIRMA}`))).status).toBe(200);
    expect((await PUT(subida(`http://minio.local/x?${FIRMA}`))).status).toBe(503);
  });

  it('rechaza usuario y contraseña en la URL', async () => {
    expect((await PUT(subida(`http://u:p@${TEST}/x?${FIRMA}`))).status).toBe(400);
  });

  it('exige la firma prefirmada', async () => {
    expect((await PUT(subida(`http://${TEST}/x`))).status).toBe(400);
  });

  it('exige content-length y respeta el tope', async () => {
    const sinLongitud = new Request('http://erp.local/almacen/subida', {
      method: 'PUT',
      headers: { [CABECERA_DESTINO]: `http://${TEST}/x?${FIRMA}` },
    });
    expect((await PUT(sinLongitud)).status).toBe(411);
    expect((await PUT(subida(`http://${TEST}/x?${FIRMA}`, 'x', { 'content-length': String(60 * 1024 * 1024) }))).status).toBe(413);
    expect((await PUT(subida(`http://${TEST}/x?${FIRMA}`, 'cuerpo largo', { 'content-length': '3' }))).status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('devuelve el XML de error de S3 pequeño, pero no un cuerpo arbitrario', async () => {
    const xml = '<?xml version="1.0"?><Error><Code>SignatureDoesNotMatch</Code></Error>';
    vi.mocked(fetch).mockResolvedValueOnce(new Response(xml, { status: 403, headers: { 'content-type': 'application/xml' } }));
    const r1 = await PUT(subida(`http://${TEST}/x?${FIRMA}`));
    expect(r1.status).toBe(403);
    expect(await r1.text()).toBe(xml);

    vi.mocked(fetch).mockResolvedValueOnce(new Response('{"secreto":1}', { status: 200, headers: { 'content-type': 'application/json' } }));
    const r2 = await PUT(subida(`http://${TEST}/x?${FIRMA}`));
    expect(r2.status).toBe(200);
    expect(await r2.text()).toBe('');

    vi.mocked(fetch).mockResolvedValueOnce(new Response(`<a>${'x'.repeat(9000)}</a>`, { status: 500, headers: { 'content-type': 'application/xml' } }));
    const r3 = await PUT(subida(`http://${TEST}/x?${FIRMA}`));
    expect(r3.status).toBe(500);
    expect(r3.headers.get('content-type')).toBe('text/plain');
    expect(await r3.text()).toBe('');
  });

  it('si el almacén no responde devuelve 502 en texto plano (pasarela, se reintenta)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('fetch failed'));
    const r = await PUT(subida(`http://${TEST}/x?${FIRMA}`));
    expect(r.status).toBe(502);
    expect(r.headers.get('content-type')).toBe('text/plain');
  });
});
