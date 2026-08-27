'use client';

import { useCallback, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { StructuredActionForm } from '@/components/screens/StructuredActionForm';
import { accountingService } from '@/services/accountingService';
import { loadAccountingPeriods, loadBillingEvents, loadBusinessPartners, loadContracts, loadGlAccounts, loadLedgers, loadLegalEntities, loadTaxCodes, withEmpty } from '@/services/optionLoaders';

export default function ArInvoicePage() {
  const [tab, setTab] = useState('listado');
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => accountingService.listArInvoices(), [version]);

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Contabilidad' }, { label: 'Factura AR' }]}
        title="Facturas por cobrar (AR)"
        description="Todas las facturas emitidas a clientes, su vencimiento y su estado de cobro."
      />
      <TabbedPanels
        activeId={tab}
        onChange={setTab}
        keepMounted
        tabs={[
          {
            id: 'listado',
            label: 'Facturas emitidas',
            icon: 'table_view',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="Contabilidad"
                title="Facturas emitidas"
                description="Historial de facturas por cobrar."
                load={load}
                labelKey="invoiceNo"
                searchPlaceholder="Buscar por número de factura o estado…"
                emptyHint="Usa la pestaña «Emitir factura» para registrar la primera."
                columns={[
                  { key: 'invoiceNo', label: 'Factura', kind: 'mono' },
                  { key: 'invoiceDate', label: 'Emisión', kind: 'date' },
                  { key: 'dueDate', label: 'Vencimiento', kind: 'date' },
                  { key: 'netAmount', label: 'Neto', kind: 'money', align: 'right' },
                  { key: 'taxAmount', label: 'Impuesto', kind: 'money', align: 'right' },
                  { key: 'currencyCode', label: 'Moneda' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'status', label: 'Estado' }, { key: 'currencyCode', label: 'Moneda' }]}
                create={{ label: 'Emitir factura', onClick: () => setTab('nueva') }}
                edit={{
                  description: 'Los importes no se editan: una factura emitida se corrige con una nota de crédito, no reescribiéndola.',
                  fields: [
                    { name: 'invoiceNo', label: 'Número de factura', required: true },
                    { name: 'dueDate', label: 'Fecha de vencimiento', type: 'date', required: true },
                    { name: 'status', label: 'Estado', type: 'select', required: true, options: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'].map((value) => ({ label: value.replaceAll('_', ' '), value })) },
                  ],
                  submit: (id, payload) => accountingService.updateArInvoice(id, payload),
                }}
                remove={{
                  submit: (id) => accountingService.deleteArInvoice(id),
                  warning: 'Si la factura ya tiene recibos aplicados, esos cobros quedan sin destino.',
                }}
              />
            ),
          },
          {
            id: 'nueva',
            label: 'Emitir factura',
            icon: 'add',
            content: (
              <StructuredActionForm
                embedded
                onDone={() => { setVersion((value) => value + 1); setTab('listado'); }}
                moduleLabel="Contabilidad"
                title="Emitir factura por cobrar (AR)"
                description="Emita una factura por cobrar y genere el asiento contable propuesto para cliente, ingresos e impuestos."
                submitLabel="Post & Emit SIAT"
                submitIcon="receipt_long"
                onSubmit={accountingService.createArInvoice}
                warning="Los datos SIAT deben provenir del proceso fiscal autorizado. No coloque identificadores simulados en producción."
                sections={[
                  { title: 'Customer & Document Info', icon: 'domain', fields: [
                    { name: 'legalEntityId', label: 'Entidad legal', type: 'select', required: true, optionsLoader: loadLegalEntities },
                    { name: 'customerBpId', label: 'Cliente (Business Partner)', type: 'select', required: true, optionsLoader: loadBusinessPartners },
                    { name: 'contractId', label: 'Contrato', type: 'select', optional: true, optionsLoader: async () => withEmpty(await loadContracts()) },
                    { name: 'invoiceNo', label: 'Número factura', required: true },
                    { name: 'invoiceDate', label: 'Fecha factura', type: 'date', required: true },
                    { name: 'dueDate', label: 'Fecha vencimiento', type: 'date', required: true },
                    { name: 'currencyCode', label: 'Moneda', defaultValue: 'BOB', required: true },
                    { name: 'description', label: 'Descripción', required: true, span: 2 },
                  ] },
                  { title: 'Financial & Accounting', icon: 'account_balance', fields: [
                    { name: 'netAmount', label: 'Importe neto', type: 'number', valueKind: 'number', required: true },
                    { name: 'taxAmount', label: 'Impuesto', type: 'number', valueKind: 'number', defaultValue: 0 },
                    { name: 'arAccountId', label: 'Cuenta por cobrar (AR)', type: 'select', required: true, optionsLoader: loadGlAccounts },
                    { name: 'revenueAccountId', label: 'Cuenta de ingreso', type: 'select', required: true, optionsLoader: loadGlAccounts },
                    { name: 'taxLiabilityAccountId', label: 'Cuenta de impuesto', type: 'select', optional: true, optionsLoader: async () => withEmpty(await loadGlAccounts()) },
                    { name: 'taxCodeId', label: 'Código tributario', type: 'select', optional: true, optionsLoader: async () => withEmpty(await loadTaxCodes()) },
                    { name: 'billingEventId', label: 'Evento de facturación', type: 'select', optional: true, optionsLoader: async () => withEmpty(await loadBillingEvents()) },
                    { name: 'accountingPeriodId', label: 'Período contable', type: 'select', required: true, optionsLoader: loadAccountingPeriods },
                    { name: 'ledgerId', label: 'Ledger', type: 'select', required: true, optionsLoader: loadLedgers },
                  ] },
                  { title: 'Electronic Invoicing (SIAT)', icon: 'fact_check', fields: [
                    { name: 'electronicTaxDocument.cuf', label: 'CUF', optional: true },
                    { name: 'electronicTaxDocument.cufd', label: 'CUFD', optional: true },
                    { name: 'electronicTaxDocument.siatStatus', label: 'Estado SIAT', defaultValue: 'PENDING' },
                    { name: 'electronicTaxDocument.xmlHash', label: 'Hash XML', optional: true },
                    { name: 'electronicTaxDocument.graphicRepresentationUrl', label: 'URL representación gráfica', type: 'url', optional: true, span: 2 },
                    { name: 'electronicTaxDocument.contingencyFlag', label: 'Contingencia', type: 'select', valueKind: 'boolean', defaultValue: 'false', options: [{ label: 'No', value: 'false' }, { label: 'Sí', value: 'true' }] },
                  ] },
                ]}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
