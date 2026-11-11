/**
 * Capturador de errores del navegador (tarea «observabilidad», 2026-11-11).
 *
 * Un error de JavaScript en el portal no deja rastro en ningún servidor: el usuario ve la pantalla
 * rota y nosotros no. Este módulo escucha `error` y `unhandledrejection` de la ventana —y lo que le
 * pase `app/global-error.tsx`— y manda un resumen MÍNIMO a `POST /errores-cliente` de este mismo
 * origen. Desde allí el servidor de Next lo valida y lo reenvía al núcleo (ver
 * `app/errores-cliente/route.ts`): el navegador nunca llama al núcleo directamente (CSP, CORS y el
 * filtro web de la red de Pablo).
 *
 * Qué se manda y qué NO: tipo, mensaje, pila, la RUTA sin query ni hash, y el `userAgent`. Nunca
 * cuerpos de petición, cabeceras, tokens, datos de formulario ni datos del usuario. `release` y
 * `surface` los pone el servidor.
 *
 * Reglas del contrato: idempotente, deduplica por `kind + mensaje + primera línea de la pila`, tope
 * de 10 reportes por carga de página, ignora extensiones, «ResizeObserver loop…», «Script error.» sin
 * pila y abortos, y NUNCA lanza: un fallo del envío se traga en silencio y no se reporta (sin bucles).
 */

export const RUTA_ERRORES_CLIENTE = '/errores-cliente';
export const MAXIMO_REPORTES_POR_PAGINA = 10;

export type TipoDeError = 'error' | 'unhandledrejection' | 'boundary';

export interface ReporteDeError {
  kind: TipoDeError;
  message: string;
  stack?: string;
  route?: string;
  userAgent?: string;
}

const TOPE_MENSAJE = 1000;
const TOPE_PILA = 8000;
const TOPE_RUTA = 500;
const TOPE_AGENTE = 400;

const EXTENSION = /(?:chrome|moz|safari(?:-web)?)-extension:\/\//i;

const vistos = new Set<string>();
let enviados = 0;
let instalado = false;
let enviando = false;

/** Sólo para las pruebas: olvida lo visto y desinstala. */
export function reiniciarCapturadorParaPruebas(): void {
  vistos.clear();
  enviados = 0;
  instalado = false;
  enviando = false;
}

function recortar(texto: string, tope: number): string {
  return texto.length > tope ? texto.slice(0, tope) : texto;
}

/** Sólo el pathname: la query y el hash pueden llevar identificadores, códigos o tokens. */
export function rutaSinQuery(): string | undefined {
  try {
    const ruta = window.location.pathname;
    return ruta ? recortar(ruta, TOPE_RUTA) : undefined;
  } catch {
    return undefined;
  }
}

function comoTexto(valor: unknown): string {
  if (typeof valor === 'string') return valor;
  try {
    return String(valor);
  } catch {
    return 'Error sin mensaje';
  }
}

/** Mensaje y pila de lo que sea que se lanzó (un Error, un texto, un objeto cualquiera). */
export function describir(motivo: unknown): { message: string; stack?: string | undefined; name?: string | undefined } {
  if (motivo instanceof Error || (typeof motivo === 'object' && motivo !== null && 'message' in motivo)) {
    const e = motivo as { message?: unknown; stack?: unknown; name?: unknown };
    return {
      message: comoTexto(e.message ?? ''),
      stack: typeof e.stack === 'string' ? e.stack : undefined,
      name: typeof e.name === 'string' ? e.name : undefined,
    };
  }
  return { message: comoTexto(motivo) };
}

/** Lo que no es nuestro o no dice nada: extensiones, ruido conocido del navegador y abortos. */
export function debeIgnorarse(message: string, stack?: string | undefined, name?: string | undefined, filename?: string | undefined): boolean {
  if (filename && EXTENSION.test(filename)) return true;
  if (stack && EXTENSION.test(stack)) return true;
  if (/^ResizeObserver loop/i.test(message.trim())) return true;
  if (/^Script error\.?$/i.test(message.trim()) && !stack) return true;
  if (name === 'AbortError' || /\bAbortError\b/.test(message)) return true;
  return false;
}

function primeraLinea(stack?: string | undefined): string {
  if (!stack) return '';
  return stack.split('\n').find((l) => l.trim().length > 0)?.trim() ?? '';
}

function mandar(reporte: ReporteDeError): void {
  const cuerpo = JSON.stringify(reporte);
  if (typeof fetch === 'function') {
    void fetch(RUTA_ERRORES_CLIENTE, {
      method: 'POST',
      keepalive: true,
      credentials: 'omit',
      headers: { 'content-type': 'application/json' },
      body: cuerpo,
    }).catch(() => undefined);
    return;
  }
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(RUTA_ERRORES_CLIENTE, new Blob([cuerpo], { type: 'application/json' }));
  }
}

/**
 * Reporta un error. Devuelve `true` si salió (útil en las pruebas). Nunca lanza.
 * `filename` es el de `ErrorEvent`, sólo para descartar extensiones; no se manda.
 */
export function reportarError(kind: TipoDeError, motivo: unknown, filename?: string | undefined): boolean {
  // Un error que nace mientras se reporta otro no se reporta: así no hay bucle.
  if (enviando) return false;
  enviando = true;
  try {
    const { message: crudo, stack: pilaCruda, name } = describir(motivo);
    const message = recortar(crudo.trim() || 'Error sin mensaje', TOPE_MENSAJE);
    if (debeIgnorarse(message, pilaCruda, name, filename)) return false;
    const clave = `${kind}|${message}|${primeraLinea(pilaCruda)}`;
    if (vistos.has(clave)) return false;
    if (enviados >= MAXIMO_REPORTES_POR_PAGINA) return false;
    vistos.add(clave);
    enviados += 1;
    const reporte: ReporteDeError = { kind, message };
    if (pilaCruda) reporte.stack = recortar(pilaCruda, TOPE_PILA);
    const route = rutaSinQuery();
    if (route) reporte.route = route;
    if (typeof navigator !== 'undefined' && navigator.userAgent) reporte.userAgent = recortar(navigator.userAgent, TOPE_AGENTE);
    mandar(reporte);
    return true;
  } catch {
    return false;
  } finally {
    enviando = false;
  }
}

function alError(evento: ErrorEvent): void {
  try {
    // Un recurso que no cargó (`<img>`, `<script>`) también dispara `error`, sin `ErrorEvent`: no es un fallo de código.
    if (!(evento instanceof ErrorEvent)) return;
    reportarError('error', evento.error ?? evento.message, evento.filename);
  } catch {
    /* nunca lanza */
  }
}

function alRechazo(evento: PromiseRejectionEvent): void {
  try {
    reportarError('unhandledrejection', evento.reason);
  } catch {
    /* nunca lanza */
  }
}

/** Instala los oyentes una sola vez por carga de página. */
export function instalarCapturadorDeErrores(): void {
  if (instalado || typeof window === 'undefined') return;
  instalado = true;
  window.addEventListener('error', alError);
  window.addEventListener('unhandledrejection', alRechazo);
}
