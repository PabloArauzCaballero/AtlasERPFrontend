'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { BotonPdf } from '@/components/atlas/BotonPdf';
import { tablaPdf } from '@/lib/pdf';
import { formatBob } from '@/lib/formatters';
import { merchantCreditService } from '@/services/merchantCreditService';
import { portalService } from '@/services/portalService';
import type { Cartera, CreditoDeCartera } from '@/services/merchantCreditService';

type Vista = 'panel' | 'creditos' | 'calendario' | 'comision';

const fecha = (valor: string) => new Date(`${valor}T12:00:00`).toLocaleDateString('es-BO', { weekday: 'short', day: '2-digit', month: 'short' });

/**
 * Qué le deben al comercio, quién y cuándo.
 *
 * Tres vistas sobre UNA lectura, porque las tres responden con los mismos datos: el panel resume,
 * los créditos abren el detalle cuota a cuota y el calendario dice qué entra cada día. Tres
 * consultas separadas habrían recorrido los mismos préstamos tres veces y se habrían
 * desincronizado en cuanto una cambiara su forma de contar.
 *
 * No aparece la identidad de ningún cliente. El comercio necesita saber que la cuota 3 de una
 * operación suya vence el martes, no quién es la persona: darle el nombre convertiría su cartera en
 * un padrón de deudores que nadie autorizó.
 */
/** Lo que el libro del ERP dice que se le ha facturado al comercio por comisión. */
type ComisionFacturada = Awaited<ReturnType<typeof portalService.commissions>>;

export function MerchantPortfolioScreen() {
  const [cartera, setCartera] = useState<Cartera | null>(null);
  /*
   * El SEGUNDO libro. Lo de arriba es lo devengado —lo que la comisión va generando según cobra el
   * comercio, y lo calcula AtlasBackend—; esto es lo facturado y cobrado, que vive en las cuentas
   * por cobrar del ERP. Son dos libros distintos y no cuadran solos: el comercio veía sólo el
   * primero y no tenía dónde mirar cuánto le queda por pagarle a Atlas.
   */
  const [facturado, setFacturado] = useState<ComisionFacturada | null>(null);
  const [nombre, setNombre] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>('panel');
  const [abierto, setAbierto] = useState<string | null>(null);
  const cargar = useCallback(async (partnerId: string) => {
    setCargando(true);
    try {
      setCartera(await merchantCreditService.cartera(partnerId));
      /* Falla aparte: que el libro de facturación no cargue no puede esconder la cartera. */
      setFacturado(await portalService.commissions().catch(() => null));
      setError(null);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible leer su cartera.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    let cancelado = false;
    merchantCreditService
      .misExpedientes()
      .then((resultado) => {
        if (cancelado) return;
        const propio = resultado.profiles?.[0];
        if (!propio) { setError('Su usuario no tiene un expediente de comercio asignado.'); setCargando(false); return; }
        setNombre(propio.tradeName ?? propio.legalName ?? '');
        void cargar(propio.partnerId);
      })
      .catch((fallo: unknown) => {
        if (cancelado) return;
        setError(fallo instanceof Error ? fallo.message : 'No fue posible identificar su comercio.');
        setCargando(false);
      });
    return () => { cancelado = true; };
  }, [cargar]);

  const resumen = cartera?.summary;
  const proximos = useMemo(() => (cartera?.calendar ?? []).slice(0, 30), [cartera]);

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Portal comercio' }, { label: 'Cartera' }]}
        title="Mi cartera"
        description={`Lo que le deben${nombre ? ` a ${nombre}` : ''}, con su detalle cuota a cuota y el calendario de cobros.`}
        actions={
          <div className="flex flex-wrap gap-1.5">
            <BotonPdf
              label="Descargar PDF"
              data-testid="pdf-cartera"
              disabled={cargando || !cartera}
              documento={() => ({
                title: 'Mi cartera',
                subtitle: nombre ? `Portal del comercio · ${nombre}` : 'Portal del comercio',
                summary: [
                  { label: 'Por cobrar', value: formatBob(Number(resumen?.outstanding ?? 0)) },
                  { label: 'Vencido', value: formatBob(Number(resumen?.overdueAmount ?? 0)) },
                  { label: 'Cobrado', value: formatBob(Number(resumen?.collected ?? 0)) },
                  { label: 'Comisión a Atlas', value: formatBob(Number(resumen?.commissionAccrued ?? 0)) },
                ],
                sections: [
                  {
                    title: 'Resumen de la cartera',
                    fields: [
                      { label: 'Créditos activos', value: String(resumen?.activeCredits ?? 0) },
                      { label: 'Cuotas en mora', value: String(resumen?.overdueInstallments ?? 0) },
                      { label: 'MDR aplicado', value: `${String(resumen?.mdrRatePercent ?? '0')} %` },
                    ],
                  },
                  {
                    title: 'Próximos cobros',
                    description: 'Calendario de cuotas por vencer tal y como se ve en pantalla.',
                    table: tablaPdf(
                      [
                        { key: 'dueDate', label: 'Vence' },
                        { key: 'customerName', label: 'Cliente' },
                        { key: 'amount', label: 'Importe' },
                        { key: 'status', label: 'Estado' },
                      ],
                      proximos as unknown as Array<Record<string, unknown>>,
                    ),
                  },
                ],
              })}
            />
            {(['panel', 'creditos', 'calendario', 'comision'] as Vista[]).map((opcion) => (
              <AtlasButton key={opcion} variant={vista === opcion ? 'primary' : 'secondary'} onClick={() => setVista(opcion)}>
                {opcion === 'panel' ? 'Panel' : opcion === 'creditos' ? 'Créditos' : opcion === 'calendario' ? 'Calendario' : 'Comisión'}
              </AtlasButton>
            ))}
          </div>
        }
      />

      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}

      <div data-tutorial-id="cartera-resumen" className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Por cobrar" value={cargando ? '…' : formatBob(Number(resumen?.outstanding ?? 0))} detail={`${resumen?.activeCredits ?? 0} créditos activos`} icon="account_balance_wallet" />
        <MetricCard label="Vencido" value={cargando ? '…' : formatBob(Number(resumen?.overdueAmount ?? 0))} detail={`${resumen?.overdueInstallments ?? 0} cuotas en mora`} icon="running_with_errors" tone={Number(resumen?.overdueAmount ?? 0) > 0 ? 'amber' : 'teal'} />
        <MetricCard label="Cobrado" value={cargando ? '…' : formatBob(Number(resumen?.collected ?? 0))} detail="Acumulado de la cartera" icon="payments" tone="teal" />
        <MetricCard label="Comisión a Atlas" value={cargando ? '…' : formatBob(Number(resumen?.commissionAccrued ?? 0))} detail={`${resumen?.mdrRatePercent ?? '0'} % sobre lo cobrado`} icon="percent" tone="purple" />
      </div>

      {vista === 'panel' ? (
        <Panel title="Los próximos cobros" description="Lo que debería entrar en los siguientes días." icon="event_upcoming">
          {cargando ? <p className="py-8 text-center text-xs text-slate-500">Cargando…</p>
            : proximos.length === 0 ? <p className="py-8 text-center text-xs text-slate-500">No hay cuotas pendientes de cobro.</p>
            : (
              <div className="space-y-2">
                {proximos.slice(0, 8).map((dia) => (
                  <div key={dia.date} className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <Icon name={dia.overdue ? 'warning' : 'event'} className={dia.overdue ? 'text-[17px] text-amber-600' : 'text-[17px] text-slate-500'} />
                      <span className="font-semibold">{fecha(dia.date)}</span>
                      {dia.overdue ? <StatusPill tone="warning">Vencido</StatusPill> : null}
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold">{formatBob(Number(dia.amount))}</p>
                      <p className="text-[10px] text-slate-500">{dia.installments} cuota(s)</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </Panel>
      ) : null}

      {vista === 'creditos' ? (
        <Panel data-tutorial-id="cartera-creditos" title="Créditos pendientes de pago" description="Abra uno para ver su detalle cuota a cuota." icon="request_quote">
          {cargando ? <p className="py-8 text-center text-xs text-slate-500">Cargando…</p>
            : (cartera?.credits ?? []).length === 0 ? <p className="py-8 text-center text-xs text-slate-500">No hay créditos originados en su comercio.</p>
            : (
              <div className="space-y-2">
                {(cartera?.credits ?? []).map((credito: CreditoDeCartera) => {
                  const abiertoAhora = abierto === credito.loanId;
                  return (
                    <div key={credito.loanId} className="rounded-md border border-slate-200">
                      <button type="button" onClick={() => setAbierto(abiertoAhora ? null : credito.loanId)} className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-slate-50">
                        <div>
                          <p className="text-xs font-bold">{credito.loanCode}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">{credito.installments.length} cuotas · {credito.status}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">Por cobrar</p>
                            <p className="text-sm font-extrabold">{formatBob(Number(credito.outstanding))}</p>
                          </div>
                          <Icon name={abiertoAhora ? 'expand_less' : 'expand_more'} className="text-[18px] text-slate-500" />
                        </div>
                      </button>
                      {abiertoAhora ? (
                        <div className="table-scroll border-t border-slate-100">
                          <table className="w-full min-w-[560px] text-left text-xs">
                            <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-2">Cuota</th><th className="p-2">Vence</th><th className="p-2 text-right">Debe</th><th className="p-2 text-right">Pagado</th><th className="p-2 text-right">Falta</th><th className="p-2">Estado</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">
                              {credito.installments.map((cuota) => (
                                <tr key={cuota.installmentId}>
                                  <td className="p-2 font-semibold">{cuota.installmentNumber}</td>
                                  <td className="p-2 text-slate-600">{fecha(cuota.dueDate)}</td>
                                  <td className="p-2 text-right">{formatBob(Number(cuota.amountDue))}</td>
                                  <td className="p-2 text-right text-slate-600">{formatBob(Number(cuota.amountPaid))}</td>
                                  <td className="p-2 text-right font-bold">{formatBob(Number(cuota.amountOutstanding))}</td>
                                  <td className="p-2"><StatusPill tone={cuota.overdue ? 'warning' : Number(cuota.amountOutstanding) === 0 ? 'success' : 'neutral'}>{cuota.overdue ? `Mora ${cuota.daysPastDue}d` : cuota.status}</StatusPill></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
        </Panel>
      ) : null}

      {vista === 'calendario' ? (
        <Panel data-tutorial-id="cartera-calendario" title="Calendario de cobros" description="Cuánto debería entrar cada día." icon="calendar_month">
          {cargando ? <p className="py-8 text-center text-xs text-slate-500">Cargando…</p>
            : proximos.length === 0 ? <p className="py-8 text-center text-xs text-slate-500">No hay cobros programados.</p>
            : (
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {proximos.map((dia) => (
                  <article key={dia.date} className={`rounded-md border p-3 ${dia.overdue ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold">{fecha(dia.date)}</p>
                      {dia.overdue ? <StatusPill tone="warning">Vencido</StatusPill> : null}
                    </div>
                    <p className="mt-2 text-lg font-extrabold">{formatBob(Number(dia.amount))}</p>
                    <p className="text-[11px] text-slate-500">{dia.installments} cuota(s)</p>
                  </article>
                ))}
              </div>
            )}
        </Panel>
      ) : null}

      {vista === 'comision' ? (
        <Panel data-tutorial-id="cartera-comision" title="Comisión por venta" description="Lo que Atlas le cobra por el servicio. Se devenga sólo sobre lo que usted cobra." icon="percent">
          <div className="mb-4 grid gap-3 grid-cols-1 sm:grid-cols-3">
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Tasa de comisión</p>
              <p className="mt-1 text-xl font-extrabold">{resumen?.mdrRatePercent ?? '0'} %</p>
              <p className="text-[11px] text-slate-500">Sobre cada venta financiada</p>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cobrado (base)</p>
              <p className="mt-1 text-xl font-extrabold">{formatBob(Number(resumen?.collected ?? 0))}</p>
              <p className="text-[11px] text-slate-500">Lo que sus clientes ya pagaron</p>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Comisión a Atlas</p>
              <p className="mt-1 text-xl font-extrabold">{formatBob(Number(resumen?.commissionAccrued ?? 0))}</p>
              <p className="text-[11px] text-slate-500">Devengada sobre lo cobrado</p>
            </div>
          </div>
          {(cartera?.credits ?? []).length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">Todavía no hay ventas financiadas en su comercio.</p>
          ) : (
            <div className="table-scroll rounded-lg border border-slate-200">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-2.5">Crédito</th><th className="p-2.5 text-right">Cobrado</th><th className="p-2.5 text-right">Comisión ({resumen?.mdrRatePercent ?? '0'} %)</th><th className="p-2.5">Estado</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {(cartera?.credits ?? []).map((credito: CreditoDeCartera) => (
                    <tr key={credito.loanId}>
                      <td className="p-2.5 font-semibold text-slate-700">{credito.loanCode}</td>
                      <td className="p-2.5 text-right text-slate-600">{formatBob(Number(credito.collected))}</td>
                      <td className="p-2.5 text-right font-bold">{formatBob(Number(credito.commissionAccrued))}</td>
                      <td className="p-2.5"><StatusPill tone={Number(credito.outstanding) === 0 ? 'success' : 'neutral'}>{credito.status}</StatusPill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <InlineNotice className="mt-4" tone="info" title="Cómo se cobra">
            La comisión se devenga a medida que sus clientes pagan: un crédito aprobado que aún no
            cobra no genera comisión, y una venta pagada al 100 % la genera completa. La tasa se pactó
            en su alta desde el ERP interno de Atlas.
          </InlineNotice>
          {facturado ? (
            <div className="mt-4 rounded-lg border border-slate-200 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Lo que Atlas ya le facturó</p>
              <div className="mt-2 grid gap-3 grid-cols-1 sm:grid-cols-3">
                <div>
                  <p className="text-lg font-extrabold">{formatBob(Number(facturado.summary?.chargedTotal ?? 0))}</p>
                  <p className="text-[11px] text-slate-500">Facturado ({Number(facturado.summary?.salesCharged ?? 0)} ventas)</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold">{formatBob(Number(facturado.summary?.settled ?? 0))}</p>
                  <p className="text-[11px] text-slate-500">Ya pagado por usted</p>
                </div>
                <div>
                  <p className="text-lg font-extrabold text-amber-700">{formatBob(Number(facturado.summary?.owedToAtlas ?? 0))}</p>
                  <p className="text-[11px] text-slate-500">Pendiente de pago a Atlas</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-slate-500">
                Devengado y facturado no son el mismo número y no tienen por qué coincidir: lo primero
                crece con cada cobro suyo, lo segundo sólo cuando Atlas emite el cargo. La diferencia
                es comisión ya generada que todavía no se le ha facturado.
              </p>
            </div>
          ) : null}
        </Panel>
      ) : null}

      <InlineNotice tone="info" title="Por qué no ve nombres">
        Su cartera dice qué operación vence y cuándo, no quién la debe. El comercio decide sobre la
        operación; el expediente del cliente es suyo y no de quien le vendió.
      </InlineNotice>
    </div>
  );
}
