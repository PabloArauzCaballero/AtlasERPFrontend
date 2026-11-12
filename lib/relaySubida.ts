/**
 * Lo que `app/almacen/subida/route.ts` exige ANTES de reenviar una subida (auditoría de seguridad
 * 2026-11-11, E8). Sólo para el servidor: usa `node:dns`.
 *
 * Hasta hoy el reenvío no pedía sesión —cualquiera en internet podía usar este servidor para hacer
 * PUT a los destinos permitidos— y comparaba NOMBRES de host: si uno de ellos resolvía a una
 * dirección interna (un DNS cambiado, un `sslip.io` mal puesto en la lista), el servidor le hacía
 * la petición desde dentro de la red de Docker.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** Lo que tarda como mucho la comprobación de sesión contra el backend del ERP. */
const PLAZO_SESION_MS = 5_000;

function ipv4ANumero(ip: string): number {
  return ip.split('.').reduce((acc, octeto) => (acc << 8) + Number(octeto), 0) >>> 0;
}

function enRango(ip: string, base: string, bits: number): boolean {
  const mascara = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ANumero(ip) & mascara) === (ipv4ANumero(base) & mascara);
}

/**
 * Direcciones a las que el reenvío NUNCA llama: loopback, redes privadas (RFC 1918), enlace local
 * (169.254.0.0/16, donde vive el servicio de metadatos de las nubes), «esta red», multidifusión y
 * reservadas, y sus equivalentes IPv6 (incluidas las IPv4 mapeadas).
 *
 * El espacio compartido 100.64.0.0/10 NO se bloquea: es la red de Tailscale, por donde DEV publica
 * su almacén (`pablo-h310.taila8f993.ts.net`), y sólo se llega a él si su nombre está en la lista
 * EXACTA de `ALMACEN_HOSTS_PERMITIDOS`.
 */
export function direccionProhibida(ip: string): boolean {
  const familia = isIP(ip);
  if (familia === 4) {
    return [
      ['0.0.0.0', 8],
      ['10.0.0.0', 8],
      ['127.0.0.0', 8],
      ['169.254.0.0', 16],
      ['172.16.0.0', 12],
      ['192.0.0.0', 24],
      ['192.168.0.0', 16],
      ['198.18.0.0', 15],
      ['224.0.0.0', 4],
      ['240.0.0.0', 4],
    ].some(([base, bits]) => enRango(ip, base as string, bits as number));
  }
  if (familia === 6) {
    const v6 = ip.toLowerCase();
    const mapeada = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
    if (mapeada) return direccionProhibida(mapeada[1]!);
    return (
      v6 === '::' ||
      v6 === '::1' ||
      /^f[cd][0-9a-f]{0,2}:/.test(v6) || // fc00::/7, únicas locales
      /^fe[89ab][0-9a-f]?:/.test(v6) || // fe80::/10, enlace local
      /^ff[0-9a-f]{0,2}:/.test(v6) // multidifusión
    );
  }
  return true; // lo que no es una IP no es una dirección a la que llamar
}

export type VeredictoDeRed = { ok: true } | { ok: false; motivo: string };

/**
 * Resuelve el host y rechaza si CUALQUIERA de sus direcciones está prohibida (un nombre con una
 * dirección pública y otra interna no es de fiar). Fuera de producción se admite loopback para
 * `next dev` contra un MinIO local; en producción, nunca.
 */
export async function destinoDeRedSeguro(hostname: string): Promise<VeredictoDeRed> {
  const local = process.env.NODE_ENV !== 'production';
  const host = hostname.replace(/^\[|\]$/g, '');
  let direcciones: string[];
  try {
    direcciones = isIP(host)
      ? [host]
      : (await lookup(host, { all: true, verbatim: true })).map((d) => d.address);
  } catch {
    return { ok: false, motivo: 'no-resuelve' };
  }
  if (direcciones.length === 0) return { ok: false, motivo: 'no-resuelve' };
  const prohibida = direcciones.find(
    (ip) => direccionProhibida(ip) && !(local && (ip === '127.0.0.1' || ip === '::1')),
  );
  return prohibida ? { ok: false, motivo: `direccion-interna ${prohibida}` } : { ok: true };
}

export type VeredictoDeSesion = 'valida' | 'sin-sesion' | 'no-comprobable';

/**
 * ¿La petición trae una sesión válida del ERP? Se pregunta al backend (`GET /api/v1/auth/session`,
 * que sólo verifica el bearer) en vez de verificar el JWT aquí: este servidor no tiene ni debe tener
 * el secreto con que se firman. Sin bearer no se sale a la red. Si el backend no contesta, falla
 * CERRADO (`no-comprobable`): sin poder comprobar la sesión no se reenvía nada.
 *
 * Se reenvía `x-forwarded-for` para que el límite por IP del backend vea al cliente y no a este
 * servidor (que sería el mismo para todos).
 */
export async function comprobarSesion(request: Request): Promise<VeredictoDeSesion> {
  const autorizacion = request.headers.get('authorization') ?? '';
  if (!/^Bearer [A-Za-z0-9._~+/=-]{20,4096}$/.test(autorizacion)) return 'sin-sesion';
  const origen = process.env.ERP_API_ORIGIN;
  if (!origen) return 'no-comprobable';
  const cabeceras: Record<string, string> = { authorization: autorizacion, accept: 'application/json' };
  const reenviada = request.headers.get('x-forwarded-for');
  if (reenviada) cabeceras['x-forwarded-for'] = reenviada;
  try {
    const respuesta = await fetch(new URL('/api/v1/auth/session', origen), {
      method: 'GET',
      headers: cabeceras,
      redirect: 'manual',
      signal: AbortSignal.timeout(PLAZO_SESION_MS),
    });
    await respuesta.body?.cancel().catch(() => undefined);
    if (respuesta.status === 200) return 'valida';
    if (respuesta.status === 401 || respuesta.status === 403) return 'sin-sesion';
    return 'no-comprobable';
  } catch {
    return 'no-comprobable';
  }
}
