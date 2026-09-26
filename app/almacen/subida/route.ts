/**
 * Reenvía al almacén (MinIO) la subida firmada que el navegador hace a ESTE origen.
 *
 * Por qué existe: `lib/almacen.ts`. En corto, el navegador no puede depender del esquema ni del
 * dominio con que cada entorno publica el almacén; este servidor sí llega a él.
 *
 * ## Qué impide que sea un proxy abierto
 *
 *  - Sólo PUT, sólo con una firma AWS v4 prefirmada en la URL (lo único que emite AtlasBackend).
 *  - Sólo a hosts del almacén: los de `ALMACEN_HOSTS_PERMITIDOS` (separados por comas, se lee en
 *    cada petición) o, sin esa variable, los que empiezan por `minio.` y el propio equipo en local.
 *  - Sin seguir redirecciones, y sin la sesión del ERP: sólo pasan las cabeceras que la firma cubre.
 *
 * La firma incluye el `Host`, y `fetch` lo pone a partir de la URL de destino, así que el almacén
 * recibe exactamente la petición que se firmó.
 */
import { CABECERA_DESTINO } from '@/lib/almacen';

export const dynamic = 'force-dynamic';

/** Por encima de lo que AtlasBackend autoriza para cualquier documento; frena cuerpos absurdos. */
const TAMANO_MAXIMO = 50 * 1024 * 1024;

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1']);

const CABECERAS_REENVIADAS = new Set(['content-type', 'content-md5', 'cache-control', 'content-disposition']);

function hostPermitido(host: string): boolean {
  const lista = (process.env.ALMACEN_HOSTS_PERMITIDOS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  if (lista.length > 0) return lista.includes(host);
  return host.startsWith('minio.') || HOSTS_LOCALES.has(host);
}

function rechazo(status: number, message: string): Response {
  return Response.json({ success: false, error: { message } }, { status });
}

export async function PUT(request: Request): Promise<Response> {
  let destino: URL;
  try {
    destino = new URL(request.headers.get(CABECERA_DESTINO) ?? '');
  } catch {
    return rechazo(400, 'Falta la dirección firmada de la subida.');
  }
  if (destino.protocol !== 'http:' && destino.protocol !== 'https:') {
    return rechazo(400, 'La dirección de la subida no es http ni https.');
  }
  const q = destino.searchParams;
  if (q.get('X-Amz-Algorithm') !== 'AWS4-HMAC-SHA256' || !q.get('X-Amz-Signature') || !q.get('X-Amz-Credential')) {
    return rechazo(400, 'La dirección de la subida no es un permiso firmado del almacén.');
  }
  if (!hostPermitido(destino.hostname.toLowerCase())) {
    return rechazo(403, `El almacén ${destino.hostname} no está permitido (ALMACEN_HOSTS_PERMITIDOS).`);
  }
  if (Number(request.headers.get('content-length') ?? 0) > TAMANO_MAXIMO) {
    return rechazo(413, 'El archivo es demasiado grande.');
  }

  const cabeceras = new Headers();
  request.headers.forEach((valor, nombre) => {
    const n = nombre.toLowerCase();
    if (CABECERAS_REENVIADAS.has(n) || n.startsWith('x-amz-')) cabeceras.set(n, valor);
  });
  const cuerpo = await request.arrayBuffer();
  if (cuerpo.byteLength > TAMANO_MAXIMO) return rechazo(413, 'El archivo es demasiado grande.');

  let respuesta: Response;
  try {
    respuesta = await fetch(destino, { method: 'PUT', headers: cabeceras, body: cuerpo, redirect: 'manual' });
  } catch {
    // Texto plano a propósito: `lib/reintentos.ts` lo lee como pasarela y repite la subida.
    return new Response('El almacén no respondió.', { status: 502, headers: { 'content-type': 'text/plain' } });
  }
  return new Response(await respuesta.arrayBuffer(), {
    status: respuesta.status,
    headers: { 'content-type': respuesta.headers.get('content-type') ?? 'text/plain' },
  });
}
