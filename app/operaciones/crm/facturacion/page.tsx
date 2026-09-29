'use client';

import { tope } from '@/lib/topes';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { b2bService } from '@/services/b2bService';
import { useOptions } from '@/hooks/useOptions';
import { toast } from '@/lib/toast';
import { domainLoader } from '@/services/domains';
import { describirModoFiscal } from '@/lib/modoFiscal';
import { fiscalService } from '@/services/fiscalService';
import { etiquetas, toneSiat } from '@/components/screens/facturacion-electronica/comun';
import { descargarFactura, facturaDeComercio } from '@/lib/facturaPdf';
import { loadAccountingPeriods, loadB2BAccounts, loadB2BContracts, loadBusinessPartners, loadGlAccounts, loadLedgers, loadLegalEntities, loadReceivablesPorFacturar, withEmpty } from '@/services/optionLoaders';
import type { JsonObject, ResourceRow } from '@/services/types';

/**
 * Facturación B2B: dos tablas y, sobre ellas, las acciones de la fila que se está mirando.
 *
 * La vista tenía cinco pestañas para dos tablas: cada operación —emitir, cobrar, postear— vivía en
 * una pestaña propia que volvía a pedir en un desplegable la factura o la CxC que el usuario ya
 * tenía delante, y el botón «Emitir factura» de la tabla no emitía nada: cambiaba de pestaña. Ahora
 * el alta es el botón de arriba y las operaciones son iconos en la fila, como en el resto del ERP.
 */
export default function B2BBillingPage() {
  const [tab, setTab] = useState('facturas');
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((value) => value + 1), []);
  /*
   * Con facturación electrónica encendida, la referencia fiscal la da Impuestos: no se escribe a
   * mano, y cada factura enseña su estado ante Impuestos. Si no se puede saber, se asume apagada.
   */
  const [fiscalActiva, setFiscalActiva] = useState(false);
  const [modoFiscal, setModoFiscal] = useState(() => describirModoFiscal(null));
  useEffect(() => {
    fiscalService.status()
      .then((estado) => { setFiscalActiva(estado.activo === true); setModoFiscal(describirModoFiscal(estado)); })
      .catch(() => setFiscalActiva(false));
  }, []);
  const estadosSiat = useOptions(domainLoader('domain:accounting.siatStatus'));
  const etiquetasSiat = useMemo<Record<string, string>>(() => ({ ...etiquetas(estadosSiat), SIN_DOCUMENTO: 'Sin documento fiscal' }), [estadosSiat]);
  const cargarFacturas = useCallback(async () => {
    const [facturas, cuentas, documentos] = await Promise.all([
      b2bService.listMerchantInvoices(),
      /* El nombre del comercio, no su uuid: sin permiso para listarlos, la columna queda en «—». */
      b2bService.listAccounts({ page: 1, limit: 100 }).catch(() => null),
      /* Quien no ve los documentos fiscales (otro rol) sigue viendo sus facturas, sin esa columna. */
      fiscalActiva ? fiscalService.listAllDocuments({ sourceType: 'MERCHANT_INVOICE' }).catch(() => []) : Promise.resolve([]),
    ]);
    const filasCuentas: ResourceRow[] = Array.isArray(cuentas) ? cuentas : ((cuentas as { items?: ResourceRow[] } | null)?.items ?? []);
    const nombres = new Map(filasCuentas.map((c) => [String(c.id ?? ''), String(c.tradeName || c.legalName || '')]));
    const porFactura = new Map(documentos.map((documento) => [String(documento.sourceId ?? ''), documento]));
    /* El contrato dice lista, pero se acepta también la forma paginada: una tabla vacía por eso no. */
    const filas: ResourceRow[] = Array.isArray(facturas) ? facturas : ((facturas as { items?: ResourceRow[] })?.items ?? []);
    return filas.map((fila) => {
      const cuenta = nombres.get(String(fila.accountId ?? '')) || '—';
      if (!fiscalActiva) return { ...fila, cuenta };
      const propio = (fila.fiscalDocument ?? null) as Record<string, unknown> | null;
      const documento = propio ?? porFactura.get(String(fila.id ?? ''));
      return { ...fila, cuenta, siatStatus: documento?.siatStatus ?? 'SIN_DOCUMENTO', numeroFiscal: documento?.numeroFactura ?? null };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, fiscalActiva]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cargarCxc = useCallback(() => b2bService.listReceivables(), [version]);

  async function emitir(payload: JsonObject) {
    const elegidos = payload.receivableIdsCsv;
    const receivableIds = (Array.isArray(elegidos) ? elegidos.map(String) : String(elegidos ?? '').split(','))
      .map((value) => value.trim())
      .filter(Boolean);
    const { receivableIdsCsv: _csv, ...body } = payload;
    const factura = await b2bService.createBillingInvoice({ ...body, receivableIds });
    const fiscal = (factura as Record<string, unknown>).fiscalDocument as Record<string, unknown> | null | undefined;
    if (fiscal) {
      /* El destino según el modo: con el emulador, decir «enviada a Impuestos» era falso. */
      toast.success(
        `Factura enviada ${modoFiscal.destino}`,
        `N° fiscal ${String(fiscal.numeroFactura ?? '—')}: ${etiquetasSiat[String(fiscal.siatStatus ?? '')] ?? String(fiscal.siatStatus ?? '')}.${modoFiscal.real ? '' : ' No tiene validez fiscal: no hay envío real a Impuestos.'} Su estado se sigue en Contabilidad › Facturación electrónica.`,
      );
    }
    recargar();
    return factura;
  }

  /** Un pago del comercio, aplicado a la CxC de la fila desde la que se abrió. */
  async function registrarPago(row: ResourceRow, payload: JsonObject) {
    const amountApplied = Number(payload.amountApplied ?? 0);
    const { amountApplied: _amount, ...body } = payload;
    const resultado = await b2bService.registerMerchantPayment({
      ...body,
      accountId: String(row.accountId ?? ''),
      allocations: [{ receivableId: String(row.id ?? ''), amountApplied }],
    });
    recargar();
    return resultado;
  }

  async function postearAlMayor(row: ResourceRow, payload: JsonObject) {
    const resultado = await b2bService.postInvoiceToGl(String(row.id ?? ''), payload);
    recargar();
    return resultado;
  }

  /** La factura como documento: se pide su detalle con líneas y se imprime. */
  async function descargar(row: ResourceRow) {
    const detalle = await b2bService.getMerchantInvoice(String(row.id ?? ''));
    await descargarFactura(facturaDeComercio(detalle));
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'CRM' }, { label: 'Facturación' }]}
        title="Facturación de comercios"
        description="Facturas emitidas por MDR y otros conceptos, cuentas por cobrar abiertas y su paso al mayor contable."
      />
      <TabbedPanels
        activeId={tab}
        onChange={setTab}
        keepMounted
        tabs={[
          {
            id: 'facturas',
            label: 'Facturas emitidas',
            icon: 'table_view',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="CRM"
                title="Facturas del comercio"
                description="Lo facturado a comercios, de lo más reciente a lo más antiguo, con su importe y su estado de cobro. Cada fila se puede descargar como documento."
                tope={tope('las 200 facturas más recientes')}
                load={cargarFacturas}
                labelKey="invoiceNumber"
                searchPlaceholder="Buscar por número de factura o estado…"
                emptyHint="Usa «Emitir factura» para agrupar cuentas por cobrar pendientes en la primera."
                columns={[
                  { key: 'invoiceNumber', label: 'Factura', kind: 'mono' },
                  { key: 'invoiceDate', label: 'Emisión', kind: 'date' },
                  { key: 'totalAmount', label: 'Importe', kind: 'money', align: 'right' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                  ...(fiscalActiva
                    ? [
                        { key: 'numeroFiscal', label: 'N° fiscal', kind: 'mono' as const },
                        { key: 'siatStatus', label: 'Ante Impuestos', kind: 'status' as const, labels: etiquetasSiat, tone: toneSiat },
                      ]
                    : []),
                  { key: 'cuenta', label: 'Comercio' },
                ]}
                filters={[{ key: 'status', label: 'Estado' }]}
                create={{
                  label: 'Emitir factura',
                  title: 'Emitir factura de comercio',
                  description: 'Agrupa cuentas por cobrar pendientes en una factura comercial. El número lo asigna el sistema.',
                  submit: emitir,
                  fields: [
                    { name: 'accountId', label: 'Cuenta B2B', tooltip: 'Cuenta B2B del comercio sobre la que se trabaja.', type: 'select', required: true, span: 2, optionsLoader: loadB2BAccounts },
                    { name: 'contractId', label: 'Contrato', tooltip: 'Contrato del comercio del que nace lo facturado; vacío si la factura no cuelga de ninguno.', type: 'select', optional: true, span: 2, optionsLoader: async () => withEmpty(await loadB2BContracts()) },
                    { name: 'invoiceDate', label: 'Fecha factura', tooltip: 'Fecha de emisión de la factura; desde ella se cuentan plazos e impuestos.', type: 'date', required: true },
                    { name: 'dueDate', label: 'Fecha vencimiento', tooltip: 'Fecha límite de pago; a partir de ella la factura entra en mora.', type: 'date', required: true },
                    { name: 'receivableIdsCsv', label: 'Cuentas por cobrar a facturar', tooltip: 'Cargos pendientes del comercio elegido que entran en esta factura; se pueden marcar varios.', type: 'multiselect', required: true, span: 2, dependsOn: 'accountId', optionsLoaderFor: (cuenta: string) => loadReceivablesPorFacturar(cuenta) },
                    ...(fiscalActiva
                      ? []
                      : [{ name: 'externalTaxRef', label: 'Referencia fiscal externa', tooltip: 'Número de la factura fiscal emitida fuera del ERP, para cruzarla.', optional: true, span: 2 as const }]),
                  ],
                }}
                extraActions={[
                  {
                    key: 'descargar',
                    label: 'Descargar factura',
                    description: 'Descarga la factura en PDF para enviarla o archivarla.',
                    icon: 'download',
                    run: descargar,
                  },
                  {
                    key: 'postear',
                    label: 'Postear al mayor',
                    description: 'Registra la venta en la contabilidad: genera el asiento de cuenta por cobrar, ingreso e IVA.',
                    icon: 'account_balance',
                    enabled: (row) => !row.accountingDocumentId,
                    form: {
                      title: (row) => `Postear al mayor la factura ${String(row.invoiceNumber ?? '')}`,
                      description: 'Genera el asiento de venta (Debe CxC / Haber Ingreso / Haber IVA) en atlas_accounting.',
                      submitLabel: 'Postear al mayor',
                      submit: postearAlMayor,
                      fields: [
                        { name: 'legalEntityId', label: 'Entidad legal', tooltip: 'Empresa del grupo que emite o recibe el documento; decide libro, moneda y numeración.', type: 'select', required: true, optionsLoader: loadLegalEntities },
                        { name: 'accountingPeriodId', label: 'Período contable', tooltip: 'Período contable abierto en el que se registra; uno cerrado rechaza el asiento.', type: 'select', required: true, optionsLoader: loadAccountingPeriods },
                        { name: 'ledgerId', label: 'Ledger', tooltip: 'Libro contable en el que se registra; el predeterminado suele ser el correcto.', type: 'select', required: true, optionsLoader: loadLedgers },
                        { name: 'arAccountId', label: 'Cuenta por cobrar (AR)', tooltip: 'Cuenta de cuentas por cobrar donde queda el saldo pendiente.', type: 'select', required: true, optionsLoader: loadGlAccounts },
                        { name: 'revenueAccountId', label: 'Cuenta de ingreso', tooltip: 'Cuenta de ingreso a la que se abona la venta.', type: 'select', required: true, optionsLoader: loadGlAccounts },
                        { name: 'taxAccountId', label: 'Cuenta de impuesto', tooltip: 'Cuenta contable del impuesto de la factura.', type: 'select', optional: true, optionsLoader: async () => withEmpty(await loadGlAccounts()) },
                        { name: 'partnerId', label: 'Business Partner (si el comercio no está vinculado)', tooltip: 'Socio de negocio al que se atribuye el documento cuando el comercio no está vinculado a uno.', type: 'select', optional: true, span: 2, optionsLoader: async () => withEmpty(await loadBusinessPartners()) },
                      ],
                    },
                  },
                ]}
                notice={{
                  tone: 'info',
                  title: 'Una factura emitida no se reescribe',
                  body: 'El número lo asigna el sistema con su propio correlativo, y una factura no se edita ni se borra: una factura emitida se corrige con una nota de crédito y se salda registrando el pago de su cuenta por cobrar.',
                }}
              />
            ),
          },
          {
            id: 'cxc',
            label: 'Cuentas por cobrar',
            icon: 'request_quote',
            content: (
              <CrudDirectory
                embedded
                moduleLabel="CRM"
                title="Cuentas por cobrar"
                tope={tope('los 200 cargos más recientes')}
                description="Lo devengado que sigue abierto: es lo que se agrupa al emitir una factura y contra lo que se aplica un pago."
                load={cargarCxc}
                labelKey="sourceType"
                searchPlaceholder="Buscar por origen o estado…"
                emptyHint="Las CxC nacen del devengo de MDR y de las facturas emitidas."
                columns={[
                  { key: 'sourceType', label: 'Origen' },
                  { key: 'amountOriginal', label: 'Importe', kind: 'money', align: 'right' },
                  { key: 'amountOpen', label: 'Saldo abierto', kind: 'money', align: 'right' },
                  { key: 'currency', label: 'Moneda' },
                  { key: 'issuedAt', label: 'Devengada', kind: 'date' },
                  { key: 'dueDate', label: 'Vence', kind: 'date' },
                  { key: 'status', label: 'Estado', kind: 'status' },
                ]}
                filters={[{ key: 'status', label: 'Estado' }, { key: 'sourceType', label: 'Origen' }]}
                extraActions={[
                  {
                    key: 'pago',
                    label: 'Registrar pago',
                    description: 'Anota un pago recibido y lo descuenta del saldo pendiente de esta cuenta por cobrar.',
                    icon: 'payments',
                    enabled: (row) => Number(row.amountOpen ?? 0) > 0,
                    form: {
                      title: (row) => `Registrar pago sobre ${String(row.sourceType ?? 'la cuenta por cobrar')}`,
                      description: 'El pago se aplica a esta cuenta por cobrar; el saldo abierto viene precargado.',
                      submitLabel: 'Registrar pago',
                      submit: registrarPago,
                      /* El importe por defecto es el saldo abierto de la fila: lo normal es saldarla entera. */
                      fields: (row) => [
                        { name: 'amount', label: 'Monto total', tooltip: 'Monto total cobrado en la moneda de la factura.', type: 'number', valueKind: 'number', required: true, defaultValue: String(row.amountOpen ?? '') },
                        { name: 'amountApplied', label: 'Monto aplicado a esta CxC', tooltip: 'Parte del monto que se aplica a esta cuenta por cobrar.', type: 'number', valueKind: 'number', required: true, defaultValue: String(row.amountOpen ?? '') },
                        { name: 'currency', label: 'Moneda', tooltip: 'Moneda en la que se factura y se consume el crédito (ISO 4217). Ej.: BOB.', defaultValue: String(row.currency ?? 'BOB'), optionsSource: 'catalog:currency' },
                        { name: 'paidAt', label: 'Fecha y hora del pago', tooltip: 'Fecha y hora exactas del pago según el comprobante.', type: 'datetime', required: true },
                        { name: 'paymentMethod', label: 'Método', tooltip: 'Medio por el que se paga: transferencia, QR, efectivo…; decide qué cuenta bancaria se exige.', optional: true, optionsSource: 'domain:accounting.paymentMethod' },
                        { name: 'externalRef', label: 'Referencia externa', tooltip: 'Referencia del hecho en el sistema de origen, para no facturarlo dos veces.', optional: true },
                      ],
                    },
                  },
                ]}
                notice={{
                  tone: 'info',
                  title: 'El cobro se registra sobre la cuenta por cobrar',
                  body: 'No hay un alta suelta de pagos: se abre desde la fila que se va a saldar, para que el pago no quede aplicado a otra por error.',
                }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
