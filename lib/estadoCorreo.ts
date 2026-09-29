/**
 * Cómo se lee el estado de un correo (campañas de Ads y factura al comprador).
 *
 * Desde el 2026-09-29 el servidor distingue `SIMULATED`: el buzón del emulador o el modo de prueba
 * lo «entregan» sin que salga nada. Antes figuraba `SENT`, y quien miraba creía que el destinatario
 * lo había recibido.
 */
export const ETIQUETAS_ESTADO_CORREO: Readonly<Record<string, string>> = {
  SIMULATED: 'Simulado (no enviado)',
  SENT: 'Enviado',
  QUEUED: 'En cola',
  PENDING: 'Pendiente',
  FAILED: 'Falló',
  SUPPRESSED: 'Suprimido',
};

export function etiquetaEstadoCorreo(estado: string): string {
  return ETIQUETAS_ESTADO_CORREO[estado] ?? estado.replaceAll('_', ' ');
}
