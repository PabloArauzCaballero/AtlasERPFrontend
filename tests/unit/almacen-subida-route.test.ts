// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Resolución de nombres simulada: por defecto, el almacén de TEST resuelve a la IP pública de
// Contabo y el de DEV a su IP de Tailscale. Cada prueba puede cambiarlo.
const resolucion = vi.hoisted(() => ({ porHost: new Map<string, string[]>() }));
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (host: string) => {
    const direcciones = resolucion.porHost.get(host);
    if (!direcciones) throw Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
    return direcciones.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));
  }),
}));

import { PUT } from '@/app/almacen/subida/route';
import { CABECERA_DESTINO } from '@/lib/almacen';

const FIRMA = 'X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=c&X-Amz-Signature=s';
const TEST = 'minio.161.97.85.216.sslip.io';
const DEV = 'pablo-h310.taila8f993.ts.net';
const BACKEND = 'http://erp:3007';
const BEARER = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1LTEifQ.firma-de-prueba';

function subida(destino: string, cuerpo = 'hola', cabeceras: Record<string, string> = {}): Request {
  return new Request('http://erp.local/almacen/subida', {
    method: 'PUT',
    headers: {
      [CABECERA_DESTINO]: destino,
      'content-length': String(cuerpo.length),
      authorization: BEARER,
      ...cabeceras,
    },
    body: cuerpo,
  });
}

let destinoPedido: URL | null;
/** Llamadas que salieron hacia el ALMACÉN (no las de comprobar la sesión). */
let alAlmacen: URL[];
/** Llamadas de comprobación de sesión al backend del ERP, con sus cabeceras. */
let alBackend: { url: URL; headers: Headers }[];
let estadoSesion: number;
let respuestaAlmacen: () => Promise<Response>;

beforeEach(() => {
  destinoPedido = null;
  alAlmacen = [];
  alBackend = [];
  estadoSesion = 200;
  respuestaAlmacen = async () => new Response(null, { status: 200, headers: { etag: '"abc"' } });
  resolucion.porHost = new Map([
    [TEST, ['161.97.85.216']],
    [DEV, ['100.101.207.88']],
    ['localhost', ['127.0.0.1']],
  ]);
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('ERP_API_ORIGIN', BACKEND);
  vi.stubEnv('ALMACEN_HOSTS_PERMITIDOS', `${TEST}, ${DEV}`);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL, init?: RequestInit) => {
      if (url.origin === BACKEND) {
        alBackend.push({ url, headers: new Headers(init?.headers) });
        return new Response('{}', { status: estadoSesion });
      }
      destinoPedido = url;
      alAlmacen.push(url);
      return respuestaAlmacen();
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
    expect(alAlmacen).toHaveLength(0);
  });

  it('rechaza minio.<ip>.sslip.io no listado con 403', async () => {
    expect((await PUT(subida(`http://minio.10.0.0.5.sslip.io/x?${FIRMA}`))).status).toBe(403);
    expect((await PUT(subida(`https://otro.ts.net/x?${FIRMA}`))).status).toBe(403);
    expect(alAlmacen).toHaveLength(0);
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
    expect(alAlmacen).toHaveLength(0);
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
      headers: { [CABECERA_DESTINO]: `http://${TEST}/x?${FIRMA}`, authorization: BEARER },
    });
    expect((await PUT(sinLongitud)).status).toBe(411);
    expect((await PUT(subida(`http://${TEST}/x?${FIRMA}`, 'x', { 'content-length': String(60 * 1024 * 1024) }))).status).toBe(413);
    expect((await PUT(subida(`http://${TEST}/x?${FIRMA}`, 'cuerpo largo', { 'content-length': '3' }))).status).toBe(413);
    expect(alAlmacen).toHaveLength(0);
  });

  it('devuelve el XML de error de S3 pequeño, pero no un cuerpo arbitrario', async () => {
    const xml = '<?xml version="1.0"?><Error><Code>SignatureDoesNotMatch</Code></Error>';
    respuestaAlmacen = async () => new Response(xml, { status: 403, headers: { 'content-type': 'application/xml' } });
    const r1 = await PUT(subida(`http://${TEST}/x?${FIRMA}`));
    expect(r1.status).toBe(403);
    expect(await r1.text()).toBe(xml);

    respuestaAlmacen = async () => new Response('{"secreto":1}', { status: 200, headers: { 'content-type': 'application/json' } });
    const r2 = await PUT(subida(`http://${TEST}/x?${FIRMA}`));
    expect(r2.status).toBe(200);
    expect(await r2.text()).toBe('');

    respuestaAlmacen = async () => new Response(`<a>${'x'.repeat(9000)}</a>`, { status: 500, headers: { 'content-type': 'application/xml' } });
    const r3 = await PUT(subida(`http://${TEST}/x?${FIRMA}`));
    expect(r3.status).toBe(500);
    expect(r3.headers.get('content-type')).toBe('text/plain');
    expect(await r3.text()).toBe('');
  });

  it('si el almacén no responde devuelve 502 en texto plano (pasarela, se reintenta)', async () => {
    respuestaAlmacen = async () => {
      throw new TypeError('fetch failed');
    };
    const r = await PUT(subida(`http://${TEST}/x?${FIRMA}`));
    expect(r.status).toBe(502);
    expect(r.headers.get('content-type')).toBe('text/plain');
  });

  describe('sesión (E8)', () => {
    it('sin bearer es 401 y no sale a ninguna red, ni al backend ni al almacén', async () => {
      const r = await PUT(subida(`http://${TEST}/x?${FIRMA}`, 'hola', { authorization: '' }));
      expect(r.status).toBe(401);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('con un bearer que el backend rechaza es 401 y no llega al almacén', async () => {
      estadoSesion = 401;
      expect((await PUT(subida(`http://${TEST}/x?${FIRMA}`))).status).toBe(401);
      expect(alBackend).toHaveLength(1);
      expect(alAlmacen).toHaveLength(0);
    });

    it('si el backend no contesta, falla CERRADO con 503', async () => {
      estadoSesion = 502;
      expect((await PUT(subida(`http://${TEST}/x?${FIRMA}`))).status).toBe(503);
      vi.stubEnv('ERP_API_ORIGIN', '');
      expect((await PUT(subida(`http://${TEST}/x?${FIRMA}`))).status).toBe(503);
      expect(alAlmacen).toHaveLength(0);
    });

    it('comprueba en /api/v1/auth/session con el bearer y la IP del cliente, y NO pasa el bearer al almacén', async () => {
      const r = await PUT(subida(`http://${TEST}/x?${FIRMA}`, 'hola', { 'x-forwarded-for': '198.51.100.7' }));
      expect(r.status).toBe(200);
      expect(alBackend[0]!.url.pathname).toBe('/api/v1/auth/session');
      expect(alBackend[0]!.headers.get('authorization')).toBe(BEARER);
      expect(alBackend[0]!.headers.get('x-forwarded-for')).toBe('198.51.100.7');
      const alMinio = vi.mocked(fetch).mock.calls.find(([url]) => (url as URL).host === TEST)!;
      expect(new Headers((alMinio[1] as RequestInit).headers).get('authorization')).toBeNull();
    });
  });

  describe('destinos de red internos (E8)', () => {
    it('en producción, ni siquiera localhost aunque se liste', async () => {
      vi.stubEnv('ALMACEN_HOSTS_PERMITIDOS', 'localhost:9000');
      expect((await PUT(subida(`http://localhost:9000/x?${FIRMA}`))).status).toBe(403);
    });

    it.each([
      ['loopback', '127.0.0.1'],
      ['red privada 10/8', '10.0.1.12'],
      ['red privada 172.16/12', '172.18.0.5'],
      ['red privada 192.168/16', '192.168.1.10'],
      ['metadatos de la nube', '169.254.169.254'],
      ['«esta red»', '0.0.0.0'],
      ['IPv6 loopback', '::1'],
      ['IPv6 única local', 'fd00::5'],
      ['IPv6 enlace local', 'fe80::1'],
      ['IPv4 mapeada en IPv6', '::ffff:10.0.0.5'],
    ])('un host permitido que resuelve a %s se rechaza con 403', async (_nombre, ip) => {
      resolucion.porHost.set(TEST, [ip]);
      expect((await PUT(subida(`http://${TEST}/x?${FIRMA}`))).status).toBe(403);
      expect(alAlmacen).toHaveLength(0);
    });

    it('basta con UNA dirección interna entre varias para rechazar', async () => {
      resolucion.porHost.set(TEST, ['161.97.85.216', '10.0.0.5']);
      expect((await PUT(subida(`http://${TEST}/x?${FIRMA}`))).status).toBe(403);
    });

    it('una IP interna escrita tal cual en la lista también se rechaza', async () => {
      vi.stubEnv('ALMACEN_HOSTS_PERMITIDOS', '10.0.0.5:9000');
      expect((await PUT(subida(`http://10.0.0.5:9000/x?${FIRMA}`))).status).toBe(403);
      expect(alAlmacen).toHaveLength(0);
    });

    it('un nombre que no resuelve se rechaza', async () => {
      resolucion.porHost.delete(TEST);
      expect((await PUT(subida(`http://${TEST}/x?${FIRMA}`))).status).toBe(403);
    });

    it('Tailscale (100.64/10) sigue valiendo para DEV', async () => {
      expect((await PUT(subida(`https://${DEV}/bucket/obj?${FIRMA}`))).status).toBe(200);
    });
  });
});
