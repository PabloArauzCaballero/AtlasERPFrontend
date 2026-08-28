'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { portalService } from '@/services/portalService';
import { merchantCreditService } from '@/services/merchantCreditService';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useMerchantScope } from '@/hooks/useMerchantScope';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { BotonPdf } from '@/components/atlas/BotonPdf';
import { tablaPdf } from '@/lib/pdf';
import { descargarFactura, facturaDeComercio } from '@/lib/facturaPdf';
import { formatBob, formatDate } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import type { Cartera, ExpedientePropio, PagoDeCartera } from '@/services/merchantCreditService';
import type { ResourceRow } from '@/services/types';

/*
 * Consumo y facturación del comercio.
 *
 * La pantalla leía SÓLO la cuenta corriente del ERP (`atlas_sales.merchant_invoices` y
 * `merchant_receivables`), y ahí no aterriza ningún cobro: los pagos de los clientes se registran
 * contra el préstamo, en el núcleo. El resultado era una pantalla en blanco —«aún no tiene facturas
 * emitidas»— en un comercio que llevaba semanas cobrando. Ahora se leen las DOS cosas:
 *
 *   - los cobros reales y sus cuotas, que vienen de la cartera del comercio, y
 *   - los cargos y facturas que Atlas le emite, que siguen viniendo del portal.
 *
 * Se juntan aquí y no en el backend a propósito: son dos sistemas con dos ciclos de vida (un cobro
 * ocurre cuando el cliente paga; una factura, cuando Atlas la emite) y fundirlos en un solo
 * endpoint habría creado una tercera verdad que se desincroniza con las dos.
 */

/** Las tres cestas, con su color. Es la misma lectura en las cuotas y en los cargos del ERP. */
type Estado = 'mora' | 'pendiente' | 'pagado';

const ESTADOS: Record<Estado, { etiqueta: string; tone: 'danger' | 'warning' | 'success'; icono: string }> = {
  mora: { etiqueta: 'En mora', tone: 'danger', icono: 'running_with_errors' },
  pendiente: { etiqueta: 'Pendiente', tone: 'warning', icono: 'schedule' },
  pagado: { etiqueta: 'Pagado', tone: 'success', icono: 'task_alt' },
};

/**
 * El estado de un cargo del ERP traducido a las mismas tres cestas.
 *
 * El backend habla en mayúsculas y en inglés (`PARTIALLY_PAID`, `ISSUED`, `VOID`…). Pintar ese
 * texto crudo obligaba a quien mira a aprenderse un vocabulario que no es suyo, y sobre todo dejaba
 * un `OVERDUE` en ámbar: una deuda vencida y una por vencer se veían igual.
 */
function estadoDelCargo(status: string, saldoAbierto: number, vence?: string): Estado {
  const normalizado = status.toUpperCase();
  if (saldoAbierto <= 0 || normalizado === 'PAID' || normalizado === 'SETTLED' || normalizado === 'VOID') return 'pagado';
  if (normalizado === 'OVERDUE') return 'mora';
  /* Un cargo sin marcar como vencido pero con fecha pasada TAMBIÉN está en mora: la etiqueta la
     pone un proceso que corre una vez al día, y hasta que corre la pantalla mentía. */
  if (vence && vence.slice(0, 10) < new Date().toISOString().slice(0, 10)) return 'mora';
  return 'pendiente';
}

export function MerchantBillingScreen() {
  const scope = useMerchantScope();
  const { accountId, ready } = scope;

  /* Los cargos que Atlas emite: comisión de cada venta, publicidad y suscripciones. */
  const billing = useAsyncResource(
    useCallback(() => (ready ? portalService.getBilling(accountId) : Promise.resolve({} as ResourceRow)), [accountId, ready]),
    ready,
  );
  const data = (billing.data ?? {}) as ResourceRow;
  const summary = (data.summary ?? {}) as ResourceRow;
  const invoices = useMemo(() => (data.invoices ?? []) as ResourceRow[], [data.invoices]);
  const receivables = useMemo(() => (data.receivables ?? []) as ResourceRow[], [data.receivables]);

  /*
   * Los cobros reales. Van por el EXPEDIENTE del comercio, que es como los identifica el núcleo.
   *
   * Y el expediente se elige, no se supone. Quien administra dos negocios tiene dos expedientes, y
   * quedarse con el primero pintaba los cobros de uno junto a los cargos del otro sin decirlo: dos
   * empresas distintas en la misma pantalla, cada cifra correcta por separado y el conjunto
   * mintiendo. Con un solo expediente no se pregunta nada.
   */
  const [expedientes, setExpedientes] = useState<ExpedientePropio[]>([]);
  const [expedienteId, setExpedienteId] = useState<string | null>(null);
  const [cartera, setCartera] = useState<Cartera | null>(null);
  const [carteraError, setCarteraError] = useState<string | null>(null);
  const [cargandoCartera, setCargandoCartera] = useState(true);
  const [filtro, setFiltro] = useState<Estado | 'todas'>('todas');
  /* Identificador de la factura que se está imprimiendo: es lo que pone el botón en «generando». */
  const [descargando, setDescargando] = useState<string | null>(null);

  /**
   * La factura, como documento.
   *
   * El botón de la cabecera imprime la PANTALLA —el consumo, los cargos, el resumen—, que no es una
   * factura. Esto pide el detalle de una en concreto, con sus líneas, y lo imprime con el mismo
   * generador. Sin esto, desde el portal no había forma de descargar una factura emitida.
   */
  async function descargarFacturaEmitida(invoiceId: string) {
    setDescargando(invoiceId);
    try {
      const detalle = await portalService.getBillingInvoice(invoiceId, accountId);
      await descargarFactura(facturaDeComercio(detalle));
    } catch (error) {
      toast.error('No se pudo descargar la factura', error instanceof Error ? error.message : undefined);
    } finally {
      setDescargando(null);
    }
  }

  useEffect(() => {
    let cancelado = false;
    merchantCreditService
      .misExpedientes()
      .then((resultado) => {
        if (cancelado) return;
        const propios = resultado.profiles ?? [];
        if (propios.length === 0) {
          setCarteraError('Su usuario no tiene un expediente de comercio asignado.');
          setCargandoCartera(false);
          return;
        }
        setExpedientes(propios);
        setExpedienteId(propios[0]!.partnerId);
      })
      .catch((fallo: unknown) => {
        if (cancelado) return;
        setCarteraError(fallo instanceof Error ? fallo.message : 'No fue posible identificar su comercio.');
        setCargandoCartera(false);
      });
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    if (!expedienteId) return;
    let cancelado = false;
    setCargandoCartera(true);
    merchantCreditService
      .cartera(expedienteId)
      .then((leida) => {
        if (cancelado) return;
        setCartera(leida);
        setCarteraError(null);
      })
      .catch((fallo: unknown) => {
        if (cancelado) return;
        setCarteraError(fallo instanceof Error ? fallo.message : 'No fue posible leer sus cobros.');
      })
      .finally(() => { if (!cancelado) setCargandoCartera(false); });
    return () => { cancelado = true; };
  }, [expedienteId]);

  const expediente = expedientes.find((uno) => uno.partnerId === expedienteId);
  const nombreExpediente = expediente?.tradeName ?? expediente?.legalName ?? '';

  const resumen = cartera?.summary;
  const tasa = resumen?.mdrRatePercent ?? '0';
  const pagos = useMemo(() => cartera?.payments ?? [], [cartera]);

  /*
   * Las cuotas de todos los créditos en una sola lista, con el crédito al que pertenecen.
   *
   * El comercio pregunta «qué me falta cobrar», no «qué le falta al crédito 3»: agrupado por
   * crédito había que abrir uno a uno para encontrar las tres cuotas en mora.
   */
  const cuotas = useMemo(
    () =>
      (cartera?.credits ?? []).flatMap((credito) =>
        credito.installments.map((cuota) => ({
          ...cuota,
          loanCode: credito.loanCode,
          estado: (Number(cuota.amountOutstanding) === 0 ? 'pagado' : cuota.overdue ? 'mora' : 'pendiente') as Estado,
        })),
      ),
    [cartera],
  );
  const cuotasVisibles = useMemo(
    () => (filtro === 'todas' ? cuotas : cuotas.filter((cuota) => cuota.estado === filtro)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [cuotas, filtro],
  );

  /*
   * Lo que suma la tabla de cobros, y lo que falta para llegar al total.
   *
   * `collected` cuenta lo pagado EN LAS CUOTAS, y una cuota puede figurar saldada sin un pago
   * detrás: así entran las carteras migradas y lo que se sembró para demostrar. Cuando eso pasa, la
   * tabla suma menos que la tarjeta, y callarlo dejaba dos cifras distintas en la misma pantalla
   * sin explicación. Se dice qué parte del cobro no tiene pago registrado.
   */
  const comisionDePagos = useMemo(
    () => pagos.reduce((suma, pago) => suma + Number(pago.commissionAccrued), 0),
    [pagos],
  );
  const cobradoConPago = useMemo(
    () => pagos.reduce((suma, pago) => suma + Number(pago.appliedAmount), 0),
    [pagos],
  );
  const cobradoSinPago = Math.max(Number(resumen?.collected ?? 0) - cobradoConPago, 0);

  const error = scope.error ?? billing.error ?? carteraError;

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Portal comercio' }, { label: 'Consumo y facturación' }]}
        title="Consumo y facturación"
        description="Cada cobro con su comisión, lo que queda por cobrar y los cargos que Atlas le factura."
        actions={
          <BotonPdf
            label="Descargar PDF"
            data-testid="pdf-facturacion"
            disabled={cargandoCartera && !ready}
            documento={() => ({
              title: 'Consumo y facturación',
              subtitle: `Portal del comercio · ${pagos.length} cobro(s) · ${invoices.length} factura(s)`,
              summary: [
                { label: 'Cobrado', value: formatBob(Number(resumen?.collected ?? 0)) },
                { label: `Comisión (${tasa} %)`, value: formatBob(Number(resumen?.commissionAccrued ?? 0)) },
                { label: 'Pendiente', value: formatBob(Number(resumen?.pendingAmount ?? 0)) },
                { label: 'En mora', value: formatBob(Number(resumen?.overdueAmount ?? 0)) },
              ],
              sections: [
                {
                  title: 'Cobros recibidos',
                  description: 'Cada pago de sus clientes con la comisión que devengó.',
                  table: tablaPdf(
                    [
                      { key: 'receivedAt', label: 'Fecha' },
                      { key: 'loanCode', label: 'Crédito' },
                      { key: 'amount', label: 'Importe' },
                      { key: 'commissionAccrued', label: `Comisión ${tasa} %` },
                      { key: 'status', label: 'Estado' },
                    ],
                    pagos as unknown as Array<Record<string, unknown>>,
                  ),
                },
                {
                  title: 'Cuotas por cobrar',
                  description: 'Lo pendiente y lo vencido, cuota a cuota.',
                  table: tablaPdf(
                    [
                      { key: 'loanCode', label: 'Crédito' },
                      { key: 'installmentNumber', label: 'Cuota' },
                      { key: 'dueDate', label: 'Vence' },
                      { key: 'amountOutstanding', label: 'Falta' },
                      { key: 'estado', label: 'Estado' },
                    ],
                    cuotas as unknown as Array<Record<string, unknown>>,
                  ),
                },
                {
                  title: 'Cargos de Atlas',
                  table: tablaPdf(
                    [
                      { key: 'sourceType', label: 'Concepto' },
                      { key: 'dueDate', label: 'Vencimiento' },
                      { key: 'amountOpen', label: 'Saldo' },
                      { key: 'status', label: 'Estado' },
                    ],
                    receivables,
                  ),
                },
                {
                  title: 'Facturas emitidas',
                  table: tablaPdf(
                    [
                      { key: 'invoiceNumber', label: 'Factura' },
                      { key: 'invoiceDate', label: 'Emisión' },
                      { key: 'dueDate', label: 'Vencimiento' },
                      { key: 'totalAmount', label: 'Importe' },
                      { key: 'status', label: 'Estado' },
                    ],
                    invoices,
                  ),
                },
              ],
            })}
          />
        }
      />

      {/*
        El negocio es el que inició sesión: aquí no se elige comercio.

        Lo único que se pregunta —y sólo a quien administra VARIOS negocios propios— es con cuál
        de los suyos sigue. Antes se pintaba con `requiresAccountSelection`, que el backend
        también levanta para el staff interno, así que en local salía un desplegable con todos
        los comercios de la plataforma.
      */}
      {expedientes.length > 1 ? (
        <Panel compact>
          <FormField
            kind="select"
            label="Negocio"
            name="partnerProfileId"
            className="max-w-md"
            value={expedienteId ?? ''}
            onChange={(e) => setExpedienteId(e.target.value)}
            hint="Tiene más de un expediente: los cobros y las cuotas son los del que elija aquí."
            options={expedientes.map((uno) => ({ label: uno.tradeName ?? uno.legalName ?? uno.partnerId, value: uno.partnerId }))}
          />
        </Panel>
      ) : null}

      {scope.requiresSelection ? (
        <Panel compact>
          <FormField
            kind="select"
            label="Negocio"
            name="merchantAccountId"
            className="max-w-md"
            value={scope.accountId ?? ''}
            onChange={(e) => scope.setAccountId(e.target.value)}
            hint="Administras varios negocios: elige de cuál quieres ver el consumo."
            options={[{ label: '— Elige uno de tus negocios —', value: '' }, ...scope.accountOptions]}
          />
        </Panel>
      ) : null}

      {/* Un fallo al resolver el alcance se dice como lo que es, y no como «no se pudo cargar la
          facturación»: la facturación ni siquiera se llegó a pedir. */}
      {scope.error ? <InlineNotice tone="danger" title="No se pudo determinar tu negocio">{scope.error}</InlineNotice> : null}
      {carteraError ? <InlineNotice tone="danger" title="No se pudieron cargar sus cobros">{carteraError}</InlineNotice> : null}
      {billing.error ? <InlineNotice tone="danger" title="No se pudieron cargar los cargos de Atlas">{billing.error}</InlineNotice> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Cobrado"
          value={cargandoCartera ? '…' : formatBob(Number(resumen?.collected ?? 0))}
          detail={`${resumen?.paymentsCount ?? 0} pago(s) · ${resumen?.paidInstallments ?? 0} cuota(s) saldada(s)`}
          icon="payments"
          tone="teal"
        />
        <MetricCard
          label={`Comisión a Atlas (${tasa} %)`}
          value={cargandoCartera ? '…' : formatBob(Number(resumen?.commissionAccrued ?? 0))}
          detail="Devengada sobre lo que ya cobró"
          icon="percent"
          tone="purple"
        />
        <MetricCard
          label="Pendiente"
          value={cargandoCartera ? '…' : formatBob(Number(resumen?.pendingAmount ?? 0))}
          detail={`${resumen?.pendingInstallments ?? 0} cuota(s) por vencer`}
          icon="schedule"
          tone="amber"
        />
        <MetricCard
          label="En mora"
          value={cargandoCartera ? '…' : formatBob(Number(resumen?.overdueAmount ?? 0))}
          detail={`${resumen?.overdueInstallments ?? 0} cuota(s) vencida(s)`}
          icon="running_with_errors"
          tone={Number(resumen?.overdueAmount ?? 0) > 0 ? 'red' : 'teal'}
        />
      </div>

      <Panel
        title="Cobros recibidos"
        description="Cada pago de sus clientes, con la comisión que ese pago le devengó a Atlas."
        icon="receipt"
        action={nombreExpediente ? <StatusPill tone="neutral">{nombreExpediente}</StatusPill> : null}
      >
        {cargandoCartera ? (
          <p className="py-8 text-center text-xs text-slate-500">Cargando…</p>
        ) : pagos.length === 0 && cobradoSinPago === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">Todavía no se ha registrado ningún cobro en sus créditos.</p>
        ) : (
          <div className="table-scroll rounded-lg border border-slate-200">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="p-2.5">Fecha</th>
                  <th className="p-2.5">Crédito</th>
                  <th className="p-2.5">Cuota(s)</th>
                  <th className="p-2.5">Medio</th>
                  <th className="p-2.5 text-right">Importe</th>
                  <th className="p-2.5 text-right">Comisión ({tasa} %)</th>
                  <th className="p-2.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagos.map((pago: PagoDeCartera) => (
                  <tr key={pago.paymentId} className={pago.reversed ? 'bg-slate-50/60 text-slate-400' : undefined}>
                    <td className="p-2.5">{formatDate(pago.receivedAt)}</td>
                    <td className="p-2.5 font-mono text-[11px]">{pago.loanCode}</td>
                    <td className="p-2.5">{pago.installmentNumbers.length ? pago.installmentNumbers.join(', ') : '—'}</td>
                    <td className="p-2.5 text-slate-500">{pago.paymentMethod}</td>
                    <td className="p-2.5 text-right font-semibold">{formatBob(Number(pago.amount))}</td>
                    <td className="p-2.5 text-right font-bold">{formatBob(Number(pago.commissionAccrued))}</td>
                    <td className="p-2.5">
                      {/* Un pago revertido NO es un cobro: se enseña, porque ocurrió, pero en gris y
                          sin comisión. Ocultarlo dejaría un hueco inexplicable en la cuenta. */}
                      <StatusPill tone={pago.reversed ? 'neutral' : 'success'}>{pago.reversed ? 'Revertido' : 'Pagado'}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {cobradoSinPago > 0 ? (
          <InlineNotice className="mt-3" tone="warning" title="Hay cobros sin pago registrado">
            {formatBob(cobradoSinPago)} figuran como cobrados en las cuotas pero no tienen un pago
            anotado detrás, así que no aparecen en esta tabla. Por eso la comisión de arriba
            ({formatBob(Number(resumen?.commissionAccrued ?? 0))}) es mayor que la que suman estas
            filas ({formatBob(comisionDePagos)}).
          </InlineNotice>
        ) : null}
      </Panel>

      <Panel
        title="Estado de sus cuotas"
        description="Rojo en mora, ámbar pendiente y verde pagado."
        icon="fact_check"
        action={
          <div className="flex flex-wrap gap-1.5">
            {(['todas', 'mora', 'pendiente', 'pagado'] as const).map((opcion) => (
              <AtlasButton key={opcion} variant={filtro === opcion ? 'primary' : 'secondary'} onClick={() => setFiltro(opcion)}>
                {opcion === 'todas' ? `Todas (${cuotas.length})` : `${ESTADOS[opcion].etiqueta} (${cuotas.filter((cuota) => cuota.estado === opcion).length})`}
              </AtlasButton>
            ))}
          </div>
        }
      >
        {cargandoCartera ? (
          <p className="py-8 text-center text-xs text-slate-500">Cargando…</p>
        ) : cuotasVisibles.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">
            {cuotas.length === 0 ? 'No hay créditos originados en su comercio.' : 'Ninguna cuota en ese estado.'}
          </p>
        ) : (
          <div className="table-scroll rounded-lg border border-slate-200">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="p-2.5">Crédito</th>
                  <th className="p-2.5">Cuota</th>
                  <th className="p-2.5">Vence</th>
                  <th className="p-2.5 text-right">Importe</th>
                  <th className="p-2.5 text-right">Pagado</th>
                  <th className="p-2.5 text-right">Falta</th>
                  <th className="p-2.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cuotasVisibles.map((cuota) => (
                  <tr key={cuota.installmentId}>
                    <td className="p-2.5 font-mono text-[11px]">{cuota.loanCode}</td>
                    <td className="p-2.5 font-semibold">{cuota.installmentNumber}</td>
                    <td className="p-2.5">{formatDate(cuota.dueDate)}</td>
                    <td className="p-2.5 text-right">{formatBob(Number(cuota.amountDue))}</td>
                    <td className="p-2.5 text-right text-slate-600">{formatBob(Number(cuota.amountPaid))}</td>
                    <td className="p-2.5 text-right font-bold">{formatBob(Number(cuota.amountOutstanding))}</td>
                    <td className="p-2.5">
                      <StatusPill tone={ESTADOS[cuota.estado].tone}>
                        {cuota.estado === 'mora' && cuota.daysPastDue > 0 ? `En mora ${cuota.daysPastDue} d` : ESTADOS[cuota.estado].etiqueta}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {ready && !billing.error ? (
        <>
          <Panel
            title="Cargos de Atlas"
            description="Lo que Atlas le factura: la comisión de cada venta, la publicidad y su tarifa."
            icon="account_balance_wallet"
            action={<StatusPill tone="neutral">{`Tarifa: ${String(summary.planName ?? 'sin tarifa')}`}</StatusPill>}
          >
            {receivables.length ? (
              <div className="table-scroll rounded-lg border border-slate-200">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="p-2.5">Concepto</th>
                      <th className="p-2.5">Emitido</th>
                      <th className="p-2.5">Vencimiento</th>
                      <th className="p-2.5 text-right">Original</th>
                      <th className="p-2.5 text-right">Saldo</th>
                      <th className="p-2.5">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {receivables.map((receivable) => {
                      const estado = estadoDelCargo(
                        String(receivable.status ?? ''),
                        Number(receivable.amountOpen ?? 0),
                        typeof receivable.dueDate === 'string' ? receivable.dueDate : undefined,
                      );
                      return (
                        <tr key={String(receivable.id)}>
                          <td className="p-2.5">{String(receivable.sourceType ?? '—')}</td>
                          <td className="p-2.5">{formatDate(typeof receivable.issuedAt === 'string' ? receivable.issuedAt : undefined)}</td>
                          <td className="p-2.5">{formatDate(typeof receivable.dueDate === 'string' ? receivable.dueDate : undefined)}</td>
                          <td className="p-2.5 text-right">{formatBob(Number(receivable.amountOriginal ?? 0))}</td>
                          <td className="p-2.5 text-right font-semibold">{formatBob(Number(receivable.amountOpen ?? 0))}</td>
                          <td className="p-2.5"><StatusPill tone={ESTADOS[estado].tone}>{ESTADOS[estado].etiqueta}</StatusPill></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-6 text-center text-xs text-slate-500">Atlas todavía no le ha emitido ningún cargo.</p>
            )}
          </Panel>

          <Panel title="Facturas emitidas" icon="receipt_long" description={`${String(summary.invoiceCount ?? 0)} factura(s) · ${formatBob(Number(summary.invoicedTotal ?? 0))} facturado`}>
            {invoices.length ? (
              <div className="table-scroll rounded-lg border border-slate-200">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                    <tr>
                      <th className="p-2.5">Número</th>
                      <th className="p-2.5">Fecha</th>
                      <th className="p-2.5">Vencimiento</th>
                      <th className="p-2.5 text-right">Total</th>
                      <th className="p-2.5">Estado</th>
                      <th className="p-2.5 text-right">Documento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((invoice) => {
                      /* Una factura emitida no lleva saldo abierto en su fila: mientras no diga
                         PAID se debe entera, y por eso el saldo que se le pasa es su total. */
                      const pagada = String(invoice.status ?? '').toUpperCase() === 'PAID';
                      const estado = estadoDelCargo(
                        String(invoice.status ?? ''),
                        pagada ? 0 : Number(invoice.totalAmount ?? 0),
                        typeof invoice.dueDate === 'string' ? invoice.dueDate : undefined,
                      );
                      return (
                        <tr key={String(invoice.id)}>
                          <td className="p-2.5 font-mono text-[11px]">{String(invoice.invoiceNumber ?? '—')}</td>
                          <td className="p-2.5">{formatDate(typeof invoice.invoiceDate === 'string' ? invoice.invoiceDate : undefined)}</td>
                          <td className="p-2.5">{formatDate(typeof invoice.dueDate === 'string' ? invoice.dueDate : undefined)}</td>
                          <td className="p-2.5 text-right font-semibold">{formatBob(Number(invoice.totalAmount ?? 0))}</td>
                          <td className="p-2.5"><StatusPill tone={ESTADOS[estado].tone}>{ESTADOS[estado].etiqueta}</StatusPill></td>
                          <td className="p-2.5 text-right">
                            <AtlasButton
                              variant="secondary"
                              icon="download"
                              data-testid={`descargar-factura-${String(invoice.id)}`}
                              loading={descargando === String(invoice.id)}
                              onClick={() => void descargarFacturaEmitida(String(invoice.id))}
                            >
                              Descargar
                            </AtlasButton>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-6 text-center text-xs text-slate-500">Este comercio aún no tiene facturas emitidas.</p>
            )}
          </Panel>
        </>
      ) : null}

      {!ready && !error ? (
        <InlineNotice tone="info" title="Elige un negocio">
          Administras varios negocios: elige de cuál quieres ver los cargos que Atlas le factura.
        </InlineNotice>
      ) : null}

      <InlineNotice tone="info" title="Cómo se cobra la comisión">
        La comisión se devenga sobre lo que usted COBRA, no sobre lo que vende: una cuota impagada no
        genera comisión, y un pago revertido la devuelve. La tasa vigente es {tasa} % y se pactó en su
        alta desde el ERP interno de Atlas.
      </InlineNotice>
    </div>
  );
}
