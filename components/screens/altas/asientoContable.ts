import type { ActionField } from '@/components/screens/StructuredActionForm';
import { loadBusinessPartners, loadCostCenters, loadGlAccounts, loadLegalEntities } from '@/services/optionLoaders';

/**
 * El asiento contable, descrito para la carga masiva.
 *
 * El alta de un asiento es un formulario hecho a mano (`AccountingDocumentScreen`): tiene una
 * tabla de líneas que se añaden y se quitan, y un marcador de debe y haber que sólo deja guardar
 * cuando cuadra. Eso no se declara con una lista de campos, así que aquí se describe lo MISMO que
 * ese formulario envía —ni un campo más— para poder generar la plantilla y validar las celdas.
 *
 * Es la única lista de este directorio que no comparte código con su formulario, así que al tocar
 * el envío de `AccountingDocumentScreen` hay que tocar también esta. Está aquí, y no dentro de la
 * pantalla del listado, para que se vea al lado de las demás.
 */
export const camposAsiento: ActionField[] = [
  { name: 'legalEntityId', label: 'Empresa', tooltip: 'Empresa (entidad legal) a cuyos libros entra el asiento.', type: 'select', required: true, optionsLoader: loadLegalEntities },
  { name: 'documentType', label: 'Tipo de documento', tooltip: 'Qué clase de asiento es: diario, factura, pago. Decide el libro y la numeración.', type: 'select', required: true, optionsSource: 'domain:accounting.documentType' },
  { name: 'documentDate', label: 'Fecha', tooltip: 'Fecha del documento. Es también la fecha con la que entra al libro: en un asiento tecleado a mano no hay dos.', type: 'date', required: true },
  { name: 'currencyCode', label: 'Moneda', tooltip: 'Moneda del asiento (ISO 4217). Ej.: BOB.', type: 'select', required: true, defaultValue: 'BOB', optionsSource: 'catalog:currency' },
];

/** Una línea del asiento: una fila de la hoja. El debe y el haber van en columnas distintas. */
export const camposLineaAsiento: ActionField[] = [
  { name: 'glAccountId', label: 'Cuenta contable', tooltip: 'Cuenta del plan a la que se imputa la línea. Vale el número de cuenta (1101) o su nombre completo.', type: 'select', required: true, optionsLoader: loadGlAccounts },
  { name: 'debit', label: 'Debe', tooltip: 'Importe al debe de esta línea. Una línea lleva debe o haber, no los dos.', type: 'number', valueKind: 'number', optional: true },
  { name: 'credit', label: 'Haber', tooltip: 'Importe al haber de esta línea. Una línea lleva debe o haber, no los dos.', type: 'number', valueKind: 'number', optional: true },
  { name: 'description', label: 'Glosa', tooltip: 'Descripción de la línea: qué concepto es. Aparece en el mayor.', optional: true },
  { name: 'partnerId', label: 'Socio de negocio', tooltip: 'Contraparte de la línea, si la tiene: el cliente o proveedor al que se imputa.', type: 'select', optional: true, optionsLoader: loadBusinessPartners },
  { name: 'costCenterId', label: 'Centro de costo', tooltip: 'Centro de costo al que se imputa la línea, si la contabilidad analítica lo exige.', type: 'select', optional: true, optionsLoader: loadCostCenters },
];

/**
 * El envío de una fila importada al mismo endpoint que usa el formulario.
 *
 * Completa lo que el formulario calcula y la hoja no trae: la fecha de contabilización (la misma
 * del documento) y, en cada línea, la moneda y el importe en moneda local. Sin esto el backend
 * rechaza el asiento por líneas incompletas, y el mensaje no diría que falta un campo que en la
 * pantalla nadie escribe.
 */
export function asientoDesdeExcel(payload: Record<string, unknown>): Record<string, unknown> {
  const currencyCode = String(payload.currencyCode ?? 'BOB');
  const lineas = Array.isArray(payload.lines) ? (payload.lines as Array<Record<string, unknown>>) : [];
  return {
    ...payload,
    postingDate: payload.documentDate,
    currencyCode,
    lines: lineas.map((linea) => {
      const debit = Number(linea.debit ?? 0);
      const credit = Number(linea.credit ?? 0);
      return { ...linea, debit, credit, currencyCode, amountLc: debit || credit };
    }),
  };
}
