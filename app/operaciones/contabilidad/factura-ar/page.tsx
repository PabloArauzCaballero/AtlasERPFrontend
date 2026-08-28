'use client';

import { useCallback, useState } from 'react';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { accountingService } from '@/services/accountingService';
import { descargarFactura, facturaAr } from '@/lib/facturaPdf';
import { loadAccountingPeriods, loadBillingEvents, loadBusinessPartners, loadContracts, loadGlAccounts, loadLedgers, loadLegalEntities, loadTaxCodes, withEmpty } from '@/services/optionLoaders';
import type { ResourceRow } from '@/services/types';

/**
 * Facturas por cobrar (AR): una sola tabla, con el alta arriba y las acciones en la fila.
 *
 * La vista tenía una pestaña «Emitir factura» al lado del listado, y el botón «Emitir factura» de
 * la propia tabla no emitía: llevaba a esa pestaña. Dos entradas al mismo formulario, ninguna donde
 * el resto del ERP la pone. Ahora el alta es el modal del botón de arriba, como en las demás
 * pantallas de contabilidad.
 *
 * El número de factura ya no está en el formulario: lo asigna el backend con su propio correlativo
 * por entidad legal, y por eso tampoco se puede modificar después.
 */
export default function ArInvoicePage() {
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(() => accountingService.listArInvoices(), [version]);

  async function descargar(row: ResourceRow) {
    const detalle = await accountingService.getArInvoice(String(row.id ?? ''));
    await descargarFactura(facturaAr(detalle));
  }

  /**
   * Registrar un evento de facturación.
   *
   * El desplegable de «Emitir factura» ofrece eventos de facturación para cobrarlos, y no había
   * ninguna pantalla que los CREARA: el endpoint existía con su método en el servicio, así que la
   * lista de la que se factura sólo se podía llenar por API. Se registra desde aquí porque es donde
   * se consume: un evento sin factura es trabajo pendiente y se ve en el mismo sitio.
   */
  const registrarEvento = {
    key: 'evento',
    label: 'Registrar evento facturable',
    icon: 'bolt',
    title: 'Nuevo evento de facturación',
    description: 'Lo que genera derecho de cobro sobre un contrato: comisión, suscripción, implantación o soporte. Después se factura desde «Emitir factura».',
    submitLabel: 'Registrar evento',
    fields: [
      { name: 'contractId', label: 'Contrato', type: 'select' as const, required: true, span: 2 as const, optionsLoader: loadContracts },
      {
        name: 'eventType',
        label: 'Tipo',
        type: 'select' as const,
        required: true,
        options: [
          { label: 'Comisión (MDR)', value: 'MDR' },
          { label: 'Suscripción', value: 'SAAS' },
          { label: 'Implantación', value: 'SETUP' },
          { label: 'Intercompañía', value: 'INTERCOMPANY' },
          { label: 'Soporte', value: 'SUPPORT' },
        ],
      },
      { name: 'eventTime', label: 'Cuándo ocurrió', type: 'datetime' as const, required: true },
      { name: 'baseAmount', label: 'Importe base', type: 'number' as const, required: true },
      { name: 'quantity', label: 'Cantidad', type: 'number' as const, optional: true, defaultValue: '1' },
      { name: 'currencyCode', label: 'Moneda', optional: true, defaultValue: 'BOB' },
      { name: 'externalRef', label: 'Referencia externa', optional: true, span: 2 as const },
    ],
    submit: async (payload: Record<string, unknown>) => {
      const creado = await accountingService.createBillingEvent(payload);
      setVersion((value) => value + 1);
      return creado;
    },
  };

  return (
    <CrudDirectory
      moduleLabel="Contabilidad"
      title="Facturas por cobrar (AR)"
      description="Todas las facturas emitidas a clientes, su vencimiento y su estado de cobro. Cada fila se descarga como documento."
      load={load}
      labelKey="invoiceNo"
      searchPlaceholder="Buscar por número de factura o estado…"
      toolbarActions={[registrarEvento]}
      emptyHint="Usa «Emitir factura» para registrar la primera."
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
      notice={{
        tone: 'info',
        title: 'El número de factura lo asigna el sistema',
        body: 'La serie es correlativa por entidad legal y año (FAC-AR-AAAA-NNNNNN). No se teclea al emitir ni se modifica después: renumerar una factura emitida deja un hueco en la serie donde estaba y un duplicado donde va.',
      }}
      create={{
        label: 'Emitir factura',
        title: 'Emitir factura por cobrar (AR)',
        description: 'Genera la factura y su asiento contable (cliente, ingresos e impuestos). Los datos SIAT deben venir del proceso fiscal autorizado.',
        submit: async (payload) => {
          const resultado = await accountingService.createArInvoice(payload);
          setVersion((value) => value + 1);
          return resultado;
        },
        fields: [
          { name: 'legalEntityId', label: 'Entidad legal', type: 'select', required: true, optionsLoader: loadLegalEntities },
          { name: 'customerBpId', label: 'Cliente (Business Partner)', type: 'select', required: true, optionsLoader: loadBusinessPartners },
          { name: 'contractId', label: 'Contrato', type: 'select', optional: true, optionsLoader: async () => withEmpty(await loadContracts()) },
          { name: 'invoiceDate', label: 'Fecha factura', type: 'date', required: true },
          { name: 'dueDate', label: 'Fecha vencimiento', type: 'date', required: true },
          { name: 'currencyCode', label: 'Moneda', defaultValue: 'BOB', required: true },
          { name: 'description', label: 'Descripción', required: true, span: 2 },
          { name: 'netAmount', label: 'Importe neto', type: 'number', valueKind: 'number', required: true },
          { name: 'taxAmount', label: 'Impuesto', type: 'number', valueKind: 'number', defaultValue: 0 },
          { name: 'arAccountId', label: 'Cuenta por cobrar (AR)', type: 'select', required: true, optionsLoader: loadGlAccounts },
          { name: 'revenueAccountId', label: 'Cuenta de ingreso', type: 'select', required: true, optionsLoader: loadGlAccounts },
          { name: 'taxLiabilityAccountId', label: 'Cuenta de impuesto', type: 'select', optional: true, optionsLoader: async () => withEmpty(await loadGlAccounts()) },
          { name: 'taxCodeId', label: 'Código tributario', type: 'select', optional: true, optionsLoader: async () => withEmpty(await loadTaxCodes()) },
          { name: 'billingEventId', label: 'Evento de facturación', type: 'select', optional: true, optionsLoader: async () => withEmpty(await loadBillingEvents()) },
          { name: 'accountingPeriodId', label: 'Período contable', type: 'select', required: true, optionsLoader: loadAccountingPeriods },
          { name: 'ledgerId', label: 'Ledger', type: 'select', required: true, optionsLoader: loadLedgers },
          { name: 'electronicTaxDocument.cuf', label: 'CUF', optional: true },
          { name: 'electronicTaxDocument.cufd', label: 'CUFD', optional: true },
          { name: 'electronicTaxDocument.siatStatus', label: 'Estado SIAT', defaultValue: 'PENDING' },
          { name: 'electronicTaxDocument.xmlHash', label: 'Hash XML', optional: true },
          { name: 'electronicTaxDocument.graphicRepresentationUrl', label: 'URL representación gráfica', type: 'url', optional: true, span: 2 },
          { name: 'electronicTaxDocument.contingencyFlag', label: 'Contingencia', type: 'select', valueKind: 'boolean', defaultValue: 'false', options: [{ label: 'No', value: 'false' }, { label: 'Sí', value: 'true' }] },
        ],
      }}
      extraActions={[{ key: 'descargar', label: 'Descargar factura', icon: 'download', run: descargar }]}
      edit={{
        description: 'Ni el número ni los importes se editan: el correlativo es del sistema y una factura emitida se corrige con una nota de crédito, no reescribiéndola.',
        fields: [
          { name: 'invoiceDate', label: 'Fecha de emisión', type: 'date', required: true },
          { name: 'dueDate', label: 'Fecha de vencimiento', type: 'date', required: true },
          { name: 'status', label: 'Estado', type: 'select', required: true, options: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CREDITED', 'VOID'].map((value) => ({ label: value.replaceAll('_', ' '), value })) },
        ],
        submit: (id, payload) => accountingService.updateArInvoice(id, payload),
      }}
      remove={{
        submit: (id) => accountingService.deleteArInvoice(id),
        warning: 'Si la factura ya tiene recibos aplicados, esos cobros quedan sin destino.',
      }}
    />
  );
}
