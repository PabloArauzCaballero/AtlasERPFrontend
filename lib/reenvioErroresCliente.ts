/**
 * Validación, límite y reenvío de `POST /errores-cliente` (ver `app/errores-cliente/route.ts`).
 * Vive aquí porque un `route.ts` de Next sólo puede exportar los métodos y su configuración.
 */
import { loadServedIdentity, UNKNOWN_COMMIT } from '@/lib/build-info';

export const SURFACE = 'erp-frontend';
export const DESTINO_POR_DEFECTO = 'http://atlas-backend:3005/api/v1/client-errors';
export const TAMANO_MAXIMO = 16 * 1024;
export const LIMITE_POR_MINUTO = 30;
const VENTANA_MS = 60_000;
export const PLAZO_MS = 3_000;
/** Si alguien recorre IPs para inflar el mapa, se vacía: peor un minuto sin límite que un servidor sin memoria. */
const MAXIMO_IPS = 5_000;

const TIPOS = new Set(['error', 'unhandledrejection', 'boundary']);

interface Reporte {
  surface: string;
  kind: string;
  message: string;
  stack?: string;
  route?: string;
  release?: string;
  userAgent?: string;
}

const cuentas = new Map<string, { desde: number; n: number }>();

/** Sólo para las pruebas. */
export function reiniciarLimiteParaPruebas(): void {
  cuentas.clear();
}

/**
 * La ÚLTIMA entrada de `x-forwarded-for`: la añade el proxy (Traefik) con la dirección real. Las de
 * delante las puede escribir el propio cliente, y con ellas se saltaría el límite.
 */
export function ipDe(request: Request): string {
  const reenviada = request.headers.get('x-forwarded-for')?.split(',').pop()?.trim();
  return reenviada || request.headers.get('x-real-ip')?.trim() || 'desconocida';
}

export function excedeLimite(ip: string, ahora = Date.now()): boolean {
  const cuenta = cuentas.get(ip);
  if (!cuenta || ahora - cuenta.desde >= VENTANA_MS) {
    if (cuentas.size >= MAXIMO_IPS) cuentas.clear();
    cuentas.set(ip, { desde: ahora, n: 1 });
    return false;
  }
  cuenta.n += 1;
  return cuenta.n > LIMITE_POR_MINUTO;
}

export function respuesta(status: number, cuerpo?: unknown): Response {
  return Response.json(cuerpo ?? { data: { accepted: status === 202 } }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Lee hasta `tope` bytes como texto; `null` si trae más. */
export async function leerConTope(flujo: ReadableStream<Uint8Array> | null, tope: number): Promise<string | null> {
  if (!flujo) return '';
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
  return Buffer.concat(trozos).toString('utf8');
}

function textoOpcional(valor: unknown, tope: number): string | undefined | false {
  if (valor === undefined || valor === null) return undefined;
  if (typeof valor !== 'string' || valor.length > tope) return false;
  return valor;
}

/** Quita query y hash; si viene una URL entera, se queda con su pathname. */
export function soloPathname(ruta: string): string {
  let r = ruta;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(r)) r = new URL(r).pathname;
  } catch {
    /* se recorta a mano abajo */
  }
  return (r.split(/[?#]/)[0] ?? '').slice(0, 500);
}

function releaseDelServidor(): string | undefined {
  const { commit } = loadServedIdentity();
  if (commit && commit !== UNKNOWN_COMMIT) return commit;
  const version = process.env.APP_VERSION?.trim();
  return version ? version.slice(0, 100) : undefined;
}

export function validar(crudo: unknown): Reporte | null {
  if (typeof crudo !== 'object' || crudo === null || Array.isArray(crudo)) return null;
  const c = crudo as Record<string, unknown>;
  if (typeof c.kind !== 'string' || !TIPOS.has(c.kind)) return null;
  if (typeof c.message !== 'string' || c.message.trim().length === 0 || c.message.length > 1000) return null;
  const stack = textoOpcional(c.stack, 8000);
  const route = textoOpcional(c.route, 2000);
  const userAgent = textoOpcional(c.userAgent, 400);
  if (stack === false || route === false || userAgent === false) return null;
  const reporte: Reporte = { surface: SURFACE, kind: c.kind, message: c.message };
  if (stack) reporte.stack = stack;
  const pathname = route ? soloPathname(route) : '';
  if (pathname) reporte.route = pathname;
  const release = releaseDelServidor();
  if (release) reporte.release = release;
  if (userAgent) reporte.userAgent = userAgent;
  return reporte;
}

