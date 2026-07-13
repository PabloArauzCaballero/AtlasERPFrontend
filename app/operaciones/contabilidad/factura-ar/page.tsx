'use client';
import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { CrudTable } from '@/components/ui/CrudTable';
import { accountingService } from '@/services/accountingService';
import { loadAccountingPeriods, loadBillingEvents, loadBusinessPartners, loadContracts, loadGlAccounts, loadLedgers, loadLegalEntities, loadTaxCodes, withEmpty } from '@/services/optionLoaders';
export default function ArInvoicePage() {
  return <div className="space-y-6"><StructuredActionForm moduleLabel="Contabilidad" title="Issue AR Invoice" description="Emita una factura por cobrar y genere el asiento contable propuesto para cliente, ingresos e impuestos." submitLabel="Post & Emit SIAT" submitIcon="receipt_long" onSubmit={accountingService.createArInvoice} sections={[
    { title: 'Customer & Document Info', icon: 'domain', fields: [
      { name: 'legalEntityId', label: 'Entidad legal', type: 'select', required: true, optionsLoader: loadLegalEntities }, { name: 'customerBpId', label: 'Cliente (Business Partner)', type: 'select', required: true, optionsLoader: loadBusinessPartners }, { name: 'contractId', label: 'Contrato', type: 'select', optional: true, optionsLoader: async () => withEmpty(await loadContracts()) },
      { name: 'invoiceNo', label: 'Número factura', required: true }, { name: 'invoiceDate', label: 'Fecha factura', type: 'date', required: true }, { name: 'dueDate', label: 'Fecha vencimiento', type: 'date', required: true },
      { name: 'currencyCode', label: 'Moneda', defaultValue: 'BOB', required: true }, { name: 'description', label: 'Descripción', required: true, span: 2 },
    ] },
    { title: 'Financial & Accounting', icon: 'account_balance', fields: [
      { name: 'netAmount', label: 'Importe neto', type: 'number', valueKind: 'number', required: true }, { name: 'taxAmount', label: 'Impuesto', type: 'number', valueKind: 'number', defaultValue: 0 },
      { name: 'arAccountId', label: 'Cuenta por cobrar (AR)', type: 'select', required: true, optionsLoader: loadGlAccounts }, { name: 'revenueAccountId', label: 'Cuenta de ingreso', type: 'select', required: true, optionsLoader: loadGlAccounts }, { name: 'taxLiabilityAccountId', label: 'Cuenta de impuesto', type: 'select', optional: true, optionsLoader: async () => withEmpty(await loadGlAccounts()) },
      { name: 'taxCodeId', label: 'Código tributario', type: 'select', optional: true, optionsLoader: async () => withEmpty(await loadTaxCodes()) }, { name: 'billingEventId', label: 'Evento de facturación', type: 'select', optional: true, optionsLoader: async () => withEmpty(await loadBillingEvents()) },
      { name: 'accountingPeriodId', label: 'Período contable', type: 'select', required: true, optionsLoader: loadAccountingPeriods }, { name: 'ledgerId', label: 'Ledger', type: 'select', required: true, optionsLoader: loadLedgers },
    ] },
    { title: 'Electronic Invoicing (SIAT)', icon: 'fact_check', fields: [
      { name: 'electronicTaxDocument.cuf', label: 'CUF', optional: true }, { name: 'electronicTaxDocument.cufd', label: 'CUFD', optional: true },
      { name: 'electronicTaxDocument.siatStatus', label: 'Estado SIAT', defaultValue: 'PENDING' }, { name: 'electronicTaxDocument.xmlHash', label: 'Hash XML', optional: true },
      { name: 'electronicTaxDocument.graphicRepresentationUrl', label: 'URL representación gráfica', type: 'url', optional: true, span: 2 },
      { name: 'electronicTaxDocument.contingencyFlag', label: 'Contingencia', type: 'select', valueKind: 'boolean', defaultValue: 'false', options: [{ label: 'No', value: 'false' }, { label: 'Sí', value: 'true' }] },
    ] },
  ]} warning="Los datos SIAT deben provenir del proceso fiscal autorizado. No coloque identificadores simulados en producción." /><CrudTable title="Facturas AR emitidas" description="Historial de facturas por cobrar emitidas." columns={['invoiceNo', 'invoiceDate', 'dueDate', 'netAmount', 'taxAmount', 'currencyCode', 'status']} editable={['invoiceNo', 'dueDate', 'status']} list={accountingService.listArInvoices} update={accountingService.updateArInvoice} remove={accountingService.deleteArInvoice} /></div>;
}
