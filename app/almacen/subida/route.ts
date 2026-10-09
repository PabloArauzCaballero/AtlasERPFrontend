/**
 * Reenvía al almacén (MinIO) la subida firmada que el navegador hace a ESTE origen.
 *
 * Por qué existe: `lib/almacen.ts`. En corto, el navegador no puede depender del esquema ni del
 * dominio con que cada entorno publica el almacén; este servidor sí llega a él.
 *
 * ## Qué impide que sea un proxy abierto (falla CERRADO)
 *
 * Esta ruta no exige sesión, así que el único freno es este archivo. Hasta el 2026-10-09 aceptaba,
 * sin la variable, cualquier host que empezara por `minio.` o acabara en `.ts.net`, en cualquier
 * puerto, y devolvía entero lo que contestara el destino: con `minio.10.0.0.5.sslip.io` se llegaba a
 * cualquier IP de la red interna (auditoría de seguridad, ERP-02). Ahora:
 *
 *  - Sólo PUT, sólo con una firma AWS v4 prefirmada en la URL (lo único que emite AtlasBackend). La
 *    firma la valida el almacén, no este servidor: aquí sólo se exige que esté.
 *  - Sólo a los destinos EXACTOS de `ALMACEN_HOSTS_PERMITIDOS` (separados por comas, se lee en cada
 *    petición): `host` (con el puerto implícito del esquema) o `host:puerto`. Sin patrones. Los
 *    valores de TEST y DEV vienen por defecto en `docker-compose.coolify.yml`.
 *  - Lista vacía: 503 «almacén no configurado». Sólo fuera de producción (`next dev` en el equipo)
 *    se aceptan `localhost` y `127.0.0.1`, en cualquier puerto.
 *  - Sin usuario ni contraseña en la URL, sin seguir redirecciones, y sin la sesión del ERP: sólo
 *    pasan las cabeceras que la firma cubre.
 *  - `content-length` obligatorio y el cuerpo se lee con tope: nunca más de lo declarado ni de
 *    `TAMANO_MAXIMO`.
 *  - Al llamante vuelve el ESTADO del almacén. El cuerpo, sólo si es el XML de error de S3 y cabe en
 *    `CUERPO_MAXIMO_DEVUELTO`; cualquier otra cosa se descarta. `lib/almacen.ts` sólo mira el estado.
 *
 * La firma incluye el `Host`, y `fetch` lo pone a partir de la URL de destino, así que el almacén
 * recibe exactamente la petición que se firmó.
 */
import { CABECERA_DESTINO } from '@/lib/almacen';

export const dynamic = 'force-dynamic';

/** Por encima de lo que AtlasBackend autoriza para cualquier documento; frena cuerpos absurdos. */
const TAMANO_MAXIMO = 50 * 1024 * 1024;

/** Lo más que se devuelve al navegador de la respuesta del almacén (su XML de error cabe de sobra). */
const CUERPO_MAXIMO_DEVUELTO = 8 * 1024;

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1']);

const PUERTO_DEL_ESQUEMA: Record<string, string> = { 'http:': '80', 'https:': '443' };

const CABECERAS_REENVIADAS = new Set(['content-type', 'content-md5', 'cache-control', 'content-disposition']);

type Veredicto = 'permitido' | 'no-configurado' | 'prohibido';

function listaPermitida(): string[] {
  return (process.env.ALMACEN_HOSTS_PERMITIDOS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

/** Compara contra la lista EXACTA: `host` vale sólo con el puerto del esquema; `host:puerto`, con ése. */
function destinoPermitido(destino: URL): Veredicto {
  const lista = listaPermitida();
  const hostname = destino.hostname.toLowerCase();
  if (lista.length === 0) {
    if (process.env.NODE_ENV !== 'production' && HOSTS_LOCALES.has(hostname)) return 'permitido';
    return 'no-configurado';
  }
  const puerto = destino.port || PUERTO_DEL_ESQUEMA[destino.protocol];
  const conPuerto = `${hostname}:${puerto}`;
  const candidatos = destino.port ? [conPuerto] : [hostname, conPuerto];
  return candidatos.some((c) => lista.includes(c)) ? 'permitido' : 'prohibido';
}

function rechazo(status: number, message: string): Response {
  return Response.json({ success: false, error: { message } }, { status });
}

/** Lee hasta `tope` bytes; `null` si el flujo trae más. */
async function leerConTope(flujo: ReadableStream<Uint8Array> | null, tope: number): Promise<Uint8Array | null> {
  if (!flujo) return new Uint8Array(0);
  const lector = flujo.getReader();
  const trozos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > tope) {
      await lector.cancel().catch(() => undefined);
      return null;
    }
    trozos.push(value);
  }
  const cuerpo = new Uint8Array(total);
  let desplazamiento = 0;
  for (const trozo of trozos) {
    cuerpo.set(trozo, desplazamiento);
    desplazamiento += trozo.byteLength;
  }
  return cuerpo;
}

/** Sólo el XML de error de S3, y pequeño. Lo demás no sale de este servidor. */
async function respuestaParaElNavegador(respuesta: Response): Promise<Response> {
  const tipo = respuesta.headers.get('content-type') ?? '';
  const esXml = /^(application|text)\/xml\b/i.test(tipo);
  const cuerpo = esXml ? await leerConTope(respuesta.body, CUERPO_MAXIMO_DEVUELTO) : null;
  if (!esXml) await respuesta.body?.cancel().catch(() => undefined);
  const cabeceras = new Headers({ 'content-type': cuerpo ? tipo : 'text/plain' });
  const etag = respuesta.headers.get('etag');
  if (etag) cabeceras.set('etag', etag);
  return new Response(cuerpo && cuerpo.byteLength > 0 ? (cuerpo as BodyInit) : null, {
    status: respuesta.status,
    headers: cabeceras,
  });
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
  if (destino.username || destino.password) {
    return rechazo(400, 'La dirección de la subida no puede llevar usuario ni contraseña.');
  }
  const q = destino.searchParams;
  if (q.get('X-Amz-Algorithm') !== 'AWS4-HMAC-SHA256' || !q.get('X-Amz-Signature') || !q.get('X-Amz-Credential')) {
    return rechazo(400, 'La dirección de la subida no es un permiso firmado del almacén.');
  }
  const veredicto = destinoPermitido(destino);
  if (veredicto === 'no-configurado') {
    return rechazo(503, 'El almacén no está configurado en este entorno (ALMACEN_HOSTS_PERMITIDOS).');
  }
  if (veredicto === 'prohibido') {
    return rechazo(403, `El almacén ${destino.host} no está permitido (ALMACEN_HOSTS_PERMITIDOS).`);
  }

  const declarado = request.headers.get('content-length');
  if (declarado === null || !/^\d+$/.test(declarado.trim())) {
    return rechazo(411, 'Falta el tamaño del archivo (content-length).');
  }
  const tamano = Number(declarado);
  if (tamano > TAMANO_MAXIMO) return rechazo(413, 'El archivo es demasiado grande.');
  const cuerpo = await leerConTope(request.body, tamano);
  if (cuerpo === null) return rechazo(413, 'El archivo es más grande de lo que declara.');

  const cabeceras = new Headers();
  request.headers.forEach((valor, nombre) => {
    const n = nombre.toLowerCase();
    if (CABECERAS_REENVIADAS.has(n) || n.startsWith('x-amz-')) cabeceras.set(n, valor);
  });

  let respuesta: Response;
  try {
    respuesta = await fetch(destino, { method: 'PUT', headers: cabeceras, body: cuerpo as BodyInit, redirect: 'manual' });
  } catch {
    // Texto plano a propósito: `lib/reintentos.ts` lo lee como pasarela y repite la subida.
    return new Response('El almacén no respondió.', { status: 502, headers: { 'content-type': 'text/plain' } });
  }
  return respuestaParaElNavegador(respuesta);
}
