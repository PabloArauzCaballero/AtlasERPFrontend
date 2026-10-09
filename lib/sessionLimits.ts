/**
 * Cierre de sesión por inactividad en el navegador.
 *
 * Mismo diseño que el portal del Motor de decisiones (`AtlasDecisionEngineFrontend/src/auth/
 * session-limits.ts` y `useSessionLimits.ts`): un sondeo por segundo que compara relojes, aviso
 * previo con «Seguir trabajando», y sólo los gestos de verdad cuentan como actividad. Cambian las
 * cifras y una cosa más:
 *
 * - **15 minutos, no 30.** El ERP lo usan la caja de un comercio y puestos compartidos de oficina,
 *   y el RGSI de ASFI pide bloquear la sesión inactiva del personal; 15 min es la cifra que se
 *   eligió para las dos poblaciones.
 * - **Aviso de 1 minuto.** Basta para pulsar una tecla, que ya cuenta como actividad.
 * - **La actividad se comparte entre pestañas.** El Motor no lo necesita; el ERP sí, porque la
 *   cookie de refresco es UNA para todas las pestañas: si una pestaña olvidada cerrase la sesión
 *   mientras se trabaja en otra, tiraría también la de trabajo. Cada pestaña apunta su último
 *   gesto en `localStorage` y todas miran el más reciente.
 *
 * Sin tope absoluto en el cliente, a diferencia del Motor: aquí `bootstrapSession()` renueva la
 * sesión en cada recarga, así que un reloj de «12 h desde el login» que vive en memoria se
 * reiniciaría con un F5 y no protegería de nada. Ese tope es del backend, que es quien fija la
 * vida de la cookie de refresco.
 *
 * Esto NO sustituye al control del servidor. Es la mitad que le toca al navegador, que es donde
 * queda la pantalla encendida.
 */

/** Quince minutos sin interacción. */
export const IDLE_LIMIT_MS = 15 * 60_000;

/** Cuánto antes del cierre aparece el aviso. */
export const WARNING_BEFORE_MS = 60_000;

/**
 * Eventos que cuentan como «hay alguien delante».
 *
 * NO incluye `mousemove` ni `scroll`: un ratón rozado o una página que se desplaza sola
 * mantendrían viva una sesión que nadie usa. `visibilitychange` sí, pero sólo al VOLVER a la
 * pestaña (ver el hook): ocultarla no es actividad.
 */
export const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'visibilitychange'] as const;

/** Donde cada pestaña deja su último gesto para las demás. */
export const CLAVE_ULTIMA_ACTIVIDAD = 'atlas:erp:ultima-actividad';

/** Milisegundos hasta el cierre por inactividad, nunca negativos. */
export function msHastaElCierre(ultimaActividad: number, ahora: number): number {
  return Math.max(0, ultimaActividad + IDLE_LIMIT_MS - ahora);
}

export type FaseDeSesion = { fase: 'activa' } | { fase: 'aviso'; segundos: number } | { fase: 'cerrar' };

/** Qué toca hacer en este instante, a partir del último gesto en cualquier pestaña. */
export function faseDeSesion(ultimaActividad: number, ahora: number): FaseDeSesion {
  const restante = msHastaElCierre(ultimaActividad, ahora);
  if (restante === 0) return { fase: 'cerrar' };
  if (restante <= WARNING_BEFORE_MS) return { fase: 'aviso', segundos: Math.ceil(restante / 1000) };
  return { fase: 'activa' };
}

/** El último gesto que otra pestaña apuntó, o 0 si no hay o no se puede leer. */
export function actividadCompartida(): number {
  try {
    const valor = Number(window.localStorage.getItem(CLAVE_ULTIMA_ACTIVIDAD));
    return Number.isFinite(valor) && valor > 0 ? valor : 0;
  } catch {
    return 0;
  }
}

export function apuntarActividadCompartida(instante: number): void {
  try {
    window.localStorage.setItem(CLAVE_ULTIMA_ACTIVIDAD, String(instante));
  } catch {
    // Sin almacenamiento, cada pestaña cuenta sólo lo suyo: el cierre sigue funcionando.
  }
}
