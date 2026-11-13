/**
 * «Hoy» es la fecha de La Paz, no la de UTC.
 *
 * `new Date().toISOString().slice(0, 10)` da la fecha en UTC. Bolivia es UTC−4 todo el año, así que
 * desde las 20:00 de La Paz esa expresión ya dice MAÑANA: una cuota que vence hoy salía «en mora» y
 * un rango «hasta hoy» pedía un día que no ha empezado. Toda comparación de «hoy» con una fecha de
 * vencimiento (`AAAA-MM-DD`) pasa por aquí.
 */
export const ZONA_DEL_NEGOCIO = 'America/La_Paz';

const formato = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_DEL_NEGOCIO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** La fecha `AAAA-MM-DD` de un instante, en La Paz. */
export function fechaEnLaPaz(instante: Date): string {
  const partes = Object.fromEntries(formato.formatToParts(instante).map((parte) => [parte.type, parte.value]));
  return `${partes.year}-${partes.month}-${partes.day}`;
}

/** La fecha de hoy en La Paz, `AAAA-MM-DD`. */
export function hoyEnLaPaz(ahora: Date = new Date()): string {
  return fechaEnLaPaz(ahora);
}

/** La fecha de La Paz `dias` días antes (o después, si es negativo) de `ahora`. */
export function diasAntesEnLaPaz(dias: number, ahora: Date = new Date()): string {
  const [anio, mes, dia] = hoyEnLaPaz(ahora).split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(anio, mes - 1, dia - dias)).toISOString().slice(0, 10);
}

/** ¿Venció ya una fecha `AAAA-MM-DD`? Vence al terminar ese día en La Paz, no antes. */
export function vencioEnLaPaz(vence: string, ahora: Date = new Date()): boolean {
  return vence.slice(0, 10) < hoyEnLaPaz(ahora);
}
