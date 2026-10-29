/**
 * Una propuesta sólo puede marcarse como aceptada si ya se envió: el servidor responde 409
 * «Solo una propuesta enviada puede aceptarse». La acción se ofrecía en los borradores y, al
 * pulsarla, devolvía ese error (QA 2026-10-29, OBS-28).
 */
export function puedeAceptarse(estado: unknown): boolean {
  return String(estado ?? '').toUpperCase() === 'SENT';
}
