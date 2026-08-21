'use client';
import { MultiActionWorkspace } from '@/components/screens/MultiActionWorkspace';
import { b2bService } from '@/services/b2bService';
import { loadAccountingPeriods, loadB2BAccounts, loadB2BContracts, loadBusinessPartners, loadGlAccounts, loadLedgers, loadLegalEntities, loadReceivables, withEmpty } from '@/services/optionLoaders';
import type { JsonObject } from '@/services/types';
export default function B2BBillingPage() {
  async function issue(payload: JsonObject) { const csv = String(payload.receivableIdsCsv ?? ''); const { receivableIdsCsv: _csv, ...body } = payload; return b2bService.createBillingInvoice({ ...body, receivableIds: csv.split(',').map((value) => value.trim()).filter(Boolean) }); }
  async function payment(payload: JsonObject) { const receivableId = String(payload.receivableId ?? ''); const amountApplied = Number(payload.amountApplied ?? 0); const { receivableId: _id, amountApplied: _amount, ...body } = payload; return b2bService.registerMerchantPayment({ ...body, allocations: [{ receivableId, amountApplied }] }); }
  async function postToGl(payload: JsonObject) { const invoiceId = String(payload.invoiceId ?? ''); const { invoiceId: _i, ...body } = payload; return b2bService.postInvoiceToGl(invoiceId, body); }
  return <MultiActionWorkspace moduleLabel="CRM" title="Nueva factura B2B" description="Emita facturas por MDR u otros conceptos y registre pagos con aplicación explícita a cuentas por cobrar." actions={[
    { id: 'invoice', title: 'Invoice Details', description: 'Agrupa CxC pendientes en una factura comercial.', icon: 'receipt_long', submitLabel: 'Issue Invoice', submitIcon: 'send', onSubmit: issue, fields: [
      { name: 'accountId', label: 'Cuenta B2B', type: 'select', required: true, span: 2, optionsLoader: loadB2BAccounts }, { name: 'contractId', label: 'Contrato', type: 'select', optional: true, span: 2, optionsLoader: async () => withEmpty(await loadB2BContracts()) }, { name: 'invoiceNumber', label: 'Número factura', required: true },
      { name: 'invoiceDate', label: 'Fecha factura', type: 'date', required: true }, { name: 'dueDate', label: 'Fecha vencimiento', type: 'date', required: true },
      { name: 'receivableIdsCsv', label: 'UUID CxC separados por coma', required: true, span: 2 }, { name: 'externalTaxRef', label: 'Referencia fiscal externa', optional: true, span: 2 },
    ] },
    { id: 'payment', title: 'Merchant Payment', description: 'Registra un pago y su aplicación a una CxC.', icon: 'payments', submitLabel: 'Registrar pago', onSubmit: payment, fields: [
      { name: 'accountId', label: 'Cuenta B2B', type: 'select', required: true, span: 2, optionsLoader: loadB2BAccounts }, { name: 'amount', label: 'Monto total', type: 'number', valueKind: 'number', required: true }, { name: 'currency', label: 'Moneda', defaultValue: 'BOB' },
      { name: 'paidAt', label: 'Fecha/hora pago', required: true, placeholder: '2026-07-10T15:00:00-04:00', span: 2 }, { name: 'paymentMethod', label: 'Método', optional: true }, { name: 'externalRef', label: 'Referencia externa', optional: true },
      { name: 'receivableId', label: 'Cuenta por cobrar aplicada', type: 'select', required: true, optionsLoader: loadReceivables }, { name: 'amountApplied', label: 'Monto aplicado', type: 'number', valueKind: 'number', required: true },
    ] },
    { id: 'post-gl', title: 'Postear al mayor (contabilidad)', description: 'Genera el asiento de venta (Debe CxC / Haber Ingreso / Haber IVA) de una factura merchant en atlas_accounting.', icon: 'account_balance', submitLabel: 'Postear al mayor', submitIcon: 'sync_alt', onSubmit: postToGl, fields: [
      { name: 'invoiceId', label: 'UUID factura merchant', required: true, span: 2 },
      { name: 'legalEntityId', label: 'Entidad legal', type: 'select', required: true, optionsLoader: loadLegalEntities }, { name: 'accountingPeriodId', label: 'Período contable', type: 'select', required: true, optionsLoader: loadAccountingPeriods }, { name: 'ledgerId', label: 'Ledger', type: 'select', required: true, optionsLoader: loadLedgers },
      { name: 'arAccountId', label: 'Cuenta por cobrar (AR)', type: 'select', required: true, optionsLoader: loadGlAccounts }, { name: 'revenueAccountId', label: 'Cuenta de ingreso', type: 'select', required: true, optionsLoader: loadGlAccounts }, { name: 'taxAccountId', label: 'Cuenta de impuesto', type: 'select', optional: true, optionsLoader: async () => withEmpty(await loadGlAccounts()) },
      { name: 'partnerId', label: 'Business Partner (opcional, si el comercio no está vinculado)', type: 'select', optional: true, span: 2, optionsLoader: async () => withEmpty(await loadBusinessPartners()) },
    ] },
  ]} />;
}
