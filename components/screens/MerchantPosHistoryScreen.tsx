'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { nombreDeCaja } from '@/components/atlas/OrigenDeCaja';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { formatBob } from '@/lib/formatters';
import { merchantCreditService } from '@/services/merchantCreditService';
import type { FiltroDeHistorial, HistorialDePos, MovimientoDePos } from '@/services/merchantCreditService';

type Tono = 'success' | 'danger' | 'warning' | 'neutral' | 'info';

const TIPO: Record<MovimientoDePos['kind'], { texto: string; tono: Tono }> = {
  purchase_request: { texto: 'Solicitud de compra', tono: 'info' },
  down_payment: { texto: 'Pago inicial', tono: 'neutral' },
  installment_payment: { texto: 'Cuota', tono: 'neutral' },
};

const ESTADO: Record<string, { texto: string; tono: Tono }> = {
  accepted: { texto: 'Aceptada', tono: 'success' },
  declined: { texto: 'Rechazada', tono: 'danger' },
  confirmed: { texto: 'Confirmado', tono: 'success' },
  verified: { texto: 'Confirmado', tono: 'success' },
  rejected: { texto: 'Rechazado', tono: 'danger' },
};

export function tipoDe(m: MovimientoDePos) {
  return TIPO[m.kind] ?? { texto: m.kind, tono: 'neutral' as const };
}

export function estadoDe(m: MovimientoDePos) {
  return ESTADO[m.status] ?? { texto: m.status, tono: 'neutral' as const };
}

/** Las cajas que se ofrecen en el filtro: las de la sucursal elegida, o todas. */
export function cajasDeSucursal(filtros: HistorialDePos['filters'] | null, branchId: string | undefined) {
  return (filtros?.terminals ?? []).filter((t) => !branchId || t.branchId === branchId);
}

/** Al cambiar de sucursal, una caja de OTRA sucursal deja de tener sentido: se suelta. Y cualquier cambio vuelve a la página 1. */
export function aplicarFiltro(
  actual: FiltroDeHistorial,
  cambio: Partial<FiltroDeHistorial>,
  filtros: HistorialDePos['filters'] | null,
): FiltroDeHistorial {
  const siguiente: FiltroDeHistorial = { ...actual, ...cambio, page: cambio.page ?? 1 };
  if ('branchId' in cambio && siguiente.terminalId) {
    const sigue = cajasDeSucursal(filtros, siguiente.branchId).some((t) => t.terminalId === siguiente.terminalId);
    if (!sigue) delete siguiente.terminalId;
  }
  return siguiente;
}

const fecha = (iso: string) => new Date(iso).toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
const POR_PAGINA = 20;

/**
 * El historial de la caja (Pablo, 2026-10-08): las solicitudes ya respondidas y los pagos ya verificados —iniciales y de
 * cuota— en UNA lista, de lo más reciente a lo más antiguo, con la sucursal y la caja de cada fila («pueden haber dos
 * montos iguales pero de cajas distintas»). Filtros de sucursal, caja y fechas; páginas de 20; el total es del filtro
 * entero, que es lo que se compara al cerrar la caja. Filtra y pagina el SERVIDOR: la lista crece cada día.
 */
export function MerchantPosHistoryScreen({ partnerId }: Readonly<{ partnerId: string }>) {
  const [filtro, setFiltro] = useState<FiltroDeHistorial>({ page: 1, pageSize: POR_PAGINA });
  const [datos, setDatos] = useState<HistorialDePos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!partnerId) return;
    setCargando(true);
    setError(null);
    try {
      setDatos(await merchantCreditService.historialPos(partnerId, filtro));
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible cargar el historial.');
    } finally {
      setCargando(false);
    }
  }, [partnerId, filtro]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const filtros = datos?.filters ?? null;
  const cambiar = (cambio: Partial<FiltroDeHistorial>) => setFiltro((actual) => aplicarFiltro(actual, cambio, filtros));
  const sucursales = useMemo(
    () => [{ value: '', label: 'Todas las sucursales' }, ...(filtros?.branches ?? []).map((b) => ({ value: b.branchId, label: b.branchName }))],
    [filtros],
  );
  const cajas = useMemo(
    () => [
      { value: '', label: 'Todas las cajas' },
      ...cajasDeSucursal(filtros, filtro.branchId).map((t) => ({
        value: t.terminalId,
        label: `${nombreDeCaja(t) ?? t.terminalSerial}${filtro.branchId ? '' : ` · ${t.branchName}`}`,
      })),
    ],
    [filtros, filtro.branchId],
  );
  const hayFiltros = Boolean(filtro.branchId || filtro.terminalId || filtro.from || filtro.to);

  return (
    <div className="space-y-5">
      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}

      <Panel
        title="Historial de la caja"
        description="Solicitudes respondidas y pagos verificados, de lo más reciente a lo más antiguo, con la sucursal y la caja de cada uno."
        icon="history"
        action={
          <AtlasButton variant="secondary" icon="refresh" disabled={!partnerId} loading={cargando} onClick={() => void recargar()}>
            Actualizar
          </AtlasButton>
        }
      >
        <div className="grid gap-3 border-b border-slate-100 pb-4 sm:grid-cols-2 lg:grid-cols-4" data-testid="historial-filtros">
          <FormField
            kind="select"
            label="Sucursal"
            name="branchId"
            tooltip="Muestra sólo lo que pasó en esa sucursal."
            value={filtro.branchId ?? ''}
            onChange={(e) => cambiar({ branchId: e.target.value || undefined })}
            options={sucursales}
          />
          <FormField
            kind="select"
            label="Caja"
            name="terminalId"
            tooltip="Muestra sólo lo que pasó en esa caja. Con una sucursal elegida, sólo aparecen sus cajas."
            value={filtro.terminalId ?? ''}
            onChange={(e) => cambiar({ terminalId: e.target.value || undefined })}
            options={cajas}
          />
          <FormField
            label="Fecha inicio"
            name="from"
            type="date"
            tooltip="Desde qué día (incluido), en hora de Bolivia."
            value={filtro.from ?? ''}
            max={filtro.to}
            onChange={(e) => cambiar({ from: e.target.value || undefined })}
          />
          <FormField
            label="Fecha fin"
            name="to"
            type="date"
            tooltip="Hasta qué día (incluido), en hora de Bolivia."
            value={filtro.to ?? ''}
            min={filtro.from}
            onChange={(e) => cambiar({ to: e.target.value || undefined })}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs" data-testid="historial-total">
          <p className="text-slate-600">
            <b className="text-slate-900">{datos?.totals.count ?? 0}</b> {datos?.totals.count === 1 ? 'operación' : 'operaciones'}
            {' · '}confirmado <b className="text-slate-900">{formatBob(Number(datos?.totals.amount ?? 0))}</b>
            {hayFiltros ? ' con estos filtros' : ''}
          </p>
          {hayFiltros ? (
            <AtlasButton variant="ghost" icon="filter_alt_off" onClick={() => setFiltro({ page: 1, pageSize: POR_PAGINA })}>
              Quitar filtros
            </AtlasButton>
          ) : null}
        </div>

        {cargando && !datos ? (
          <p className="py-8 text-center text-xs text-slate-500">Cargando…</p>
        ) : !datos || datos.items.length === 0 ? (
          <div className="py-10 text-center">
            <Icon name="inbox" className="text-[28px] text-slate-400" />
            <p className="mt-2 text-xs text-slate-500">{hayFiltros ? 'No hay nada con estos filtros.' : 'Todavía no hay movimientos en la caja.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs" data-testid="historial-pos">
              <thead className="text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2">Fecha</th>
                  <th>Tipo</th>
                  <th>Código</th>
                  <th>Sucursal</th>
                  <th>Caja</th>
                  <th className="text-right">Importe</th>
                  <th>Referencia</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody className={cargando ? 'opacity-60' : ''}>
                {datos.items.map((m) => (
                  <tr key={m.id} className="border-t border-slate-100">
                    <td className="py-2 whitespace-nowrap">{fecha(m.happenedAt)}</td>
                    <td>
                      <StatusPill tone={tipoDe(m).tono} dot={false}>
                        {tipoDe(m).texto}
                      </StatusPill>
                    </td>
                    <td className="font-semibold">{m.code}</td>
                    <td>{m.branchName ?? '—'}</td>
                    <td className="font-semibold text-[#006a61]">{nombreDeCaja(m) ?? '—'}</td>
                    <td className="text-right font-semibold">{formatBob(m.amount)}</td>
                    <td>{m.reference ?? '—'}</td>
                    <td>
                      <StatusPill tone={estadoDe(m).tono}>{estadoDe(m).texto}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {datos && datos.pages > 1 ? (
          <nav className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs" aria-label="Páginas del historial">
            <AtlasButton variant="secondary" icon="chevron_left" disabled={datos.page <= 1 || cargando} onClick={() => cambiar({ page: datos.page - 1 })}>
              Anterior
            </AtlasButton>
            <span className="text-slate-600" data-testid="historial-pagina">
              Página <b>{datos.page}</b> de <b>{datos.pages}</b> · {datos.total} en total
            </span>
            <AtlasButton
              variant="secondary"
              icon="chevron_right"
              disabled={datos.page >= datos.pages || cargando}
              onClick={() => cambiar({ page: datos.page + 1 })}
            >
              Siguiente
            </AtlasButton>
          </nav>
        ) : null}
      </Panel>
    </div>
  );
}
