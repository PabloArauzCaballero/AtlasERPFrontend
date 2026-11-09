/**
 * Dos poblaciones, dos puertas.
 *
 * El comercio afiliado y el personal de Atlas entraban por la misma pantalla, con una pestaña para
 * elegir quién eras. La pestaña abría siempre en «Personal Atlas», así que el comercio —que es quien
 * llega de fuera, sin marcador y sin saber que existe un panel interno— veía primero el acceso que
 * no era el suyo. Ahora cada población tiene su dirección y `/login` sólo reparte.
 */
export type Audience = 'internal' | 'merchant';

export const RUTA_LOGIN: Record<Audience, string> = {
  internal: '/login/interno',
  merchant: '/login/comercios',
};

/** Las secciones del comercio cuelgan todas de aquí; el resto de la aplicación es del personal. */
const PREFIJO_COMERCIO = '/portal-comercio';

const CLAVE = 'atlas_last_audience';

/**
 * Por dónde entró este navegador la última vez. Es una comodidad, no un dato de sesión: sobrevive
 * al cierre de sesión a propósito (la clave de la sesión se borra al salir) para que quien sale
 * vuelva a SU puerta. El almacenamiento puede no estar (modo privado, datos bloqueados): sin él,
 * simplemente no se recuerda.
 */
export function recordarAudiencia(audience: Audience): void {
  try {
    window.localStorage.setItem(CLAVE, audience);
  } catch {
    /* Sin almacenamiento no hay recuerdo; el acceso funciona igual. */
  }
}

export function audienciaRecordada(): Audience | null {
  try {
    const valor = window.localStorage.getItem(CLAVE);
    return valor === 'internal' || valor === 'merchant' ? valor : null;
  } catch {
    return null;
  }
}

/**
 * A qué puerta va quien llega a `/login`.
 *
 * 1. Si venía de una pantalla (`next`, ya validado por `rutaInternaSegura`), manda la pantalla: una
 *    del portal del comercio lleva al acceso del comercio; cualquier otra, al interno, y se conserva
 *    para volver a ella tras entrar.
 * 2. Si no, la última puerta por la que entró este navegador.
 * 3. Si no hay nada, el comercio: el personal interno llega con su dirección guardada; el comercio no.
 */
export function resolverLogin(destinoPedido: string | null, recordada: Audience | null): string {
  if (destinoPedido) {
    const esDelComercio = destinoPedido === PREFIJO_COMERCIO || destinoPedido.startsWith(`${PREFIJO_COMERCIO}/`);
    return esDelComercio
      ? RUTA_LOGIN.merchant
      : `${RUTA_LOGIN.internal}?next=${encodeURIComponent(destinoPedido)}`;
  }
  return RUTA_LOGIN[recordada ?? 'merchant'];
}
