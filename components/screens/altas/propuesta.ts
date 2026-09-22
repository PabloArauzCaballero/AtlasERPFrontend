import type { ActionField } from '@/components/screens/StructuredActionForm';
import { loadOpportunities } from '@/services/optionLoaders';

/**
 * La propuesta comercial, descrita para la carga masiva.
 *
 * El alta (`ProposalManagerScreen`) es un constructor con líneas dinámicas y columna lateral, así
 * que no se declara con una lista de campos. Aquí se describe lo MISMO que esa pantalla envía. Sin
 * `proposalNumber`: el backend asigna el correlativo, igual que en el alta a mano.
 */
export const camposPropuesta: ActionField[] = [
  { name: 'opportunityId', label: 'Oportunidad', tooltip: 'Oportunidad del pipeline a la que responde la propuesta.', type: 'select', required: true, optionsLoader: loadOpportunities },
  { name: 'validUntil', label: 'Válida hasta', tooltip: 'Fecha hasta la que el precio se sostiene. Pasada, la propuesta caduca.', type: 'date', optional: true },
  { name: 'totalEstimatedMonthlyRevenue', label: 'Ingreso mensual estimado', tooltip: 'Ingreso mensual que se espera del trato si se cierra, en bolivianos.', type: 'number', valueKind: 'number', optional: true },
  { name: 'pricingExceptionReason', label: 'Motivo de excepción de precio', tooltip: 'Por qué se sale de la tarifa estándar. Si se rellena, la propuesta pasa por aprobación.', optional: true },
];

/** Una condición de la propuesta: una fila de la hoja por condición. */
export const camposLineaPropuesta: ActionField[] = [
  { name: 'termType', label: 'Tipo de condición', tooltip: 'Qué se cobra: comisión por transacción (MDR), cuota fija, alquiler de terminal…', type: 'select', required: true, defaultValue: 'MDR', optionsSource: 'domain:crm.termType' },
  { name: 'description', label: 'Descripción', tooltip: 'Cómo se le explica la condición al comercio.', required: true },
  { name: 'ratePercent', label: 'Porcentaje', tooltip: 'Porcentaje de la condición, si se cobra como comisión. Una condición lleva porcentaje o importe fijo.', type: 'number', valueKind: 'number', optional: true },
  { name: 'fixedAmount', label: 'Importe fijo', tooltip: 'Importe fijo de la condición, si no se cobra como porcentaje.', type: 'number', valueKind: 'number', optional: true },
  { name: 'billingTiming', label: 'Cuándo se cobra', tooltip: 'En qué momento se cobra la condición: por transacción, mensual…', type: 'select', required: true, defaultValue: 'PER_TRANSACTION', optionsSource: 'domain:crm.billingTiming' },
  { name: 'minimumMonthlyAmount', label: 'Mínimo mensual', tooltip: 'Importe mínimo que se factura al mes por esta condición, aunque no se alcance con el volumen.', type: 'number', valueKind: 'number', optional: true },
];

/** La moneda de las líneas la pone la pantalla de alta y no se pide: todas las propuestas van en BOB. */
export function propuestaDesdeExcel(payload: Record<string, unknown>): Record<string, unknown> {
  const lineas = Array.isArray(payload.lines) ? (payload.lines as Array<Record<string, unknown>>) : [];
  return { ...payload, lines: lineas.map((linea) => ({ ...linea, currency: 'BOB' })) };
}
