import { NAVIGATION, PORTAL_COMERCIO_NAV, isActivePath } from '@/components/layout/navigation';
import { ApiError } from '@/lib/apiClient';

/**
 * Atlas Assist («el asistente») dentro del ERP: lo que no es pantalla.
 *
 * El mismo widget vive en dos sitios y habla con dos audiencias: el personal de Atlas en
 * `/operaciones` y el comercio en `/portal-comercio`. Lo que cambia entre los dos —qué catálogo le
 * contesta— NO lo decide este código: lo fija el backend del ERP según el tipo de sesión, para que
 * un comercio no pueda pedir el catálogo interno cambiando una cadena. Aquí la superficie sólo
 * decide lo que se ve: el nombre de la sección y a dónde lleva «hablar con una persona».
 */
export type SuperficieAsistente = 'erp-staff' | 'merchant-portal';

export const MAX_PREGUNTA = 2000;

export const AVISO_DATOS = 'No escribas contraseñas, códigos ni datos personales.';

export const MENSAJE_APAGADO = 'El asistente todavía no está encendido en este ambiente.';

/** Pantallas del personal que no están en el menú pero tienen nombre propio. */
const PANTALLAS_FUERA_DEL_MENU: ReadonlyArray<readonly [string, string]> = [
  ['/operaciones/tutoriales', 'Centro de Tutoriales'],
  ['/operaciones/cuenta', 'Mi cuenta'],
  ['/operaciones/crm/propuestas', 'CRM › Pipeline › Propuestas'],
  ['/operaciones/admin/busqueda-global', 'Centro de comando'],
  ['/operaciones/ads', 'Publicidad'],
];

/** Lo que el backend acepta en `screen`: letras, números, espacios y `›/·_-().,`, hasta 80. */
function limpiarPantalla(texto: string): string {
  return texto
    .replace(/[^\p{L}\p{N} ›/·_\-().,]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim();
}

/**
 * El nombre visible de la sección donde está la persona, sacado del MISMO menú que ve.
 *
 * Se lee del menú y no de una tabla aparte porque una tabla aparte se queda vieja en cuanto
 * alguien renombra una entrada: el asistente diría «Cuentas» mientras el menú dice «Cuentas B2B».
 */
export function pantallaDelAsistente(pathname: string, superficie: SuperficieAsistente): string {
  if (superficie === 'merchant-portal') {
    if (isActivePath(pathname, '/portal-comercio/cuenta')) return 'Mi cuenta';
    const item = PORTAL_COMERCIO_NAV.find((entrada) => isActivePath(pathname, entrada.href));
    return limpiarPantalla(item?.label ?? 'Portal del comercio');
  }

  if (pathname === '/operaciones') return 'Dashboard';
  for (const grupo of NAVIGATION) {
    const items = [...grupo.items, ...(grupo.subGroups?.flatMap((sub) => sub.items) ?? [])];
    const item = items.find((entrada) => isActivePath(pathname, entrada.href));
    if (item) return limpiarPantalla(`${grupo.label} › ${item.label}`);
  }
  const fuera = PANTALLAS_FUERA_DEL_MENU.find(([ruta]) => isActivePath(pathname, ruta));
  return limpiarPantalla(fuera?.[1] ?? 'Operaciones');
}

export interface ResultadoDeError {
  mensaje: string;
  /** `true` si el asistente está apagado en este ambiente: el campo se deshabilita. */
  apagado: boolean;
}

/**
 * Qué se le dice a la persona cuando el asistente no contesta.
 *
 * Cada código pide algo distinto: apagado no se arregla reintentando, «ocupado» sí, y un rechazo
 * trae ya su propio texto redactado para leerse. Un 404 sin código también cuenta como apagado:
 * es lo que contesta un backend del ERP que todavía no trae la pasarela del asistente.
 */
export function describirErrorDelAsistente(error: unknown): ResultadoDeError {
  if (!(error instanceof ApiError)) {
    return { mensaje: 'Algo falló al hablar con el asistente. Inténtalo otra vez.', apagado: false };
  }
  if (error.status === 404) return { mensaje: MENSAJE_APAGADO, apagado: true };
  if (error.code === 'ASSIST_REJECTED' && error.message) return { mensaje: error.message, apagado: false };
  if (error.status === 409) {
    return { mensaje: 'Tu pregunta anterior todavía se está respondiendo. Espera unos segundos y vuelve a enviarla.', apagado: false };
  }
  if (error.status === 429) {
    return { mensaje: 'El asistente está atendiendo muchas consultas. Espera un momento y vuelve a intentarlo.', apagado: false };
  }
  if (error.status === 401) return { mensaje: 'Tu sesión caducó. Vuelve a iniciar sesión.', apagado: false };
  if (error.status === 403) return { mensaje: 'Tu usuario no tiene acceso al asistente.', apagado: false };
  if (error.status === 400) {
    return { mensaje: 'No pudimos enviar tu pregunta así. Revisa el texto y vuelve a intentarlo.', apagado: false };
  }
  return { mensaje: 'El asistente no está disponible en este momento. Inténtalo en unos minutos.', apagado: false };
}

/**
 * Repite la MISMA pregunta mientras Core diga que sigue en curso (409 `ASSIST_IN_FLIGHT`).
 *
 * El 409 no es un error para la persona: es «la respuesta a esto ya se está generando». Se espera
 * lo que pide `Retry-After` y se vuelve a pedir con el mismo `clientMessageId`, que Core reconoce
 * y contesta con la respuesta guardada en vez de generar otra. Tres veces como mucho; después, el
 * 409 sube y la pantalla lo explica.
 */
export async function conReintentoEnCurso<T>(
  enviar: () => Promise<T>,
  opciones: { intentos?: number; dormir?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const intentos = opciones.intentos ?? 3;
  const dormir = opciones.dormir ?? ((ms: number) => new Promise<void>((listo) => setTimeout(listo, ms)));
  for (let n = 0; ; n++) {
    try {
      return await enviar();
    } catch (error) {
      const enCurso = error instanceof ApiError && error.status === 409;
      if (!enCurso || n >= intentos) throw error;
      const segundos = Math.min(Math.max(error.retryAfterSeconds ?? 2, 1), 10);
      await dormir(segundos * 1000);
    }
  }
}
