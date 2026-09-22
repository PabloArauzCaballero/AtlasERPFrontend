import type { ActionField } from '@/components/screens/StructuredActionForm';
import { loadArInvoices, loadBankAccounts, loadBusinessPartners, loadLegalEntities } from '@/services/optionLoaders';

/**
 * El recibo de cobro, descrito para la carga masiva.
 *
 * El alta (`ReceiptScreen`) es un formulario a mano: filtra las facturas abiertas del pagador y
 * propone el saldo de cada una, así que no se declara con una lista de campos. Aquí se describe lo
 * MISMO que esa pantalla envía, para generar la plantilla y validar las celdas. Al cambiar el
 * envío de `ReceiptScreen` hay que cambiar también esta lista.
 */
export const camposRecibo: ActionField[] = [
  { name: 'legalEntityId', label: 'Empresa', tooltip: 'Empresa (entidad legal) que cobra.', type: 'select', required: true, optionsLoader: loadLegalEntities },
  { name: 'payerBpId', label: 'Pagador', tooltip: 'Socio de negocio que paga. Vale su código (BP-004) o su razón social.', type: 'select', required: true, optionsLoader: loadBusinessPartners },
  { name: 'receiptDate', label: 'Fecha del cobro', tooltip: 'Fecha en la que se recibió el dinero, según el comprobante.', type: 'date', required: true },
  { name: 'amount', label: 'Importe cobrado', tooltip: 'Importe total del recibo. Debe cuadrar con la suma de lo asignado a las facturas.', type: 'number', valueKind: 'number', required: true },
  { name: 'currencyCode', label: 'Moneda', tooltip: 'Moneda del cobro (ISO 4217). Ej.: BOB.', type: 'select', required: true, defaultValue: 'BOB', optionsSource: 'catalog:currency' },
  { name: 'bankAccountId', label: 'Cuenta bancaria', tooltip: 'Cuenta donde entró el dinero, si el cobro fue bancario.', type: 'select', optional: true, optionsLoader: loadBankAccounts },
];

/** Una asignación: qué parte del cobro se aplica a qué factura. Una fila de la hoja por factura. */
export const camposAsignacionRecibo: ActionField[] = [
  { name: 'arInvoiceId', label: 'Factura', tooltip: 'Factura por cobrar a la que se aplica esta parte del pago. Vale su número.', type: 'select', required: true, optionsLoader: loadArInvoices },
  { name: 'allocatedAmount', label: 'Importe aplicado', tooltip: 'Cuánto del cobro se aplica a esta factura.', type: 'number', valueKind: 'number', required: true },
];
