/**
 * «Ejecutar conciliación» de Cobertura y conciliación, dicho como es.
 *
 * NO cuadra contra el dinero recibido ni contra el banco: busca inconsistencias INTERNAS del
 * período y deja una partida por cada una. El ERP no tiene todavía una pantalla que liste esas
 * partidas, así que lo único que se ve es este resumen al terminar.
 */
export const DESCRIPCION_CONCILIACION =
  'Busca inconsistencias internas del período: compras confirmadas sin comisión, cobros a comercios vencidos sin pagar, ' +
  'cuotas vencidas sin cobertura programada y coberturas pagadas sin recuperación abierta. No cuadra contra el dinero recibido ni contra el banco.';

const TIPOS: Record<string, string> = {
  MDR: 'compras sin comisión',
  CXC_B2B: 'cobros a comercios vencidos',
  CXP_MERCHANT: 'cuotas vencidas sin cobertura',
  RECOVERY: 'coberturas pagadas sin recuperación',
};

export function resumenDeConciliacion(resultado: unknown): { title: string; body: string } {
  const run = (resultado ?? {}) as { items?: unknown; alreadyOpenItemCount?: unknown };
  const items = Array.isArray(run.items) ? (run.items as Array<Record<string, unknown>>) : [];
  const yaAbiertas = typeof run.alreadyOpenItemCount === 'number' ? run.alreadyOpenItemCount : null;
  const porTipo = new Map<string, number>();
  for (const item of items) {
    const tipo = TIPOS[String(item.itemType ?? item.type ?? '')] ?? 'otras';
    porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + 1);
  }
  const detalle = [...porTipo.entries()].map(([tipo, cantidad]) => `${cantidad} ${tipo}`).join(', ');
  const nuevas = items.length ? `${items.length} inconsistencia(s) nueva(s): ${detalle}.` : 'Ninguna inconsistencia nueva.';
  const previas = yaAbiertas ? ` ${yaAbiertas} ya estaban abiertas de corridas anteriores.` : '';
  return {
    title: 'Conciliación ejecutada',
    body: `${nuevas}${previas} El detalle de cada partida todavía no se puede consultar en el ERP.`,
  };
}
