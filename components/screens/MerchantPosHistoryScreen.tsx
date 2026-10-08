'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { formatBob } from '@/lib/formatters';
import { merchantCreditService } from '@/services/merchantCreditService';
import type { ComprobanteDePago, PagoInicial, SolicitudDeCompra } from '@/services/merchantCreditService';

type Tono = 'success' | 'danger' | 'warning' | 'neutral';

/** Una fila del historial de pagos: el inicial de una compra o una cuota, con el mismo aspecto. */
export interface MovimientoDePago {
  id: string;
  tipo: 'Pago inicial' | 'Cuota';
  codigo: string;
  importe: number;
  referencia: string | null;
  estado: string;
  tono: Tono;
  fecha: string | null;
}

const ESTADO_DE_PAGO: Record<string, { texto: string; tono: Tono }> = {
  confirmed: { texto: 'Confirmado', tono: 'success' },
  verified: { texto: 'Confirmado', tono: 'success' },
  rejected: { texto: 'Rechazado', tono: 'danger' },
  submitted: { texto: 'Esperando', tono: 'warning' },
  pending: { texto: 'Esperando', tono: 'warning' },
};

function estadoDePago(estado: string | null): { texto: string; tono: Tono } {
  return ESTADO_DE_PAGO[estado ?? ''] ?? { texto: estado ?? '—', tono: 'neutral' };
}

/**
 * Los pagos iniciales y los de cuota en UNA lista, más recientes primero, con su tipo.
 *
 * Pablo (2026-10-08): el comercio veía sólo lo que esperaba su confirmación; lo ya confirmado desaparecía y no
 * había forma de saber si un cliente pagó el inicial o una cuota. Aquí queda todo, y lo que espera también, para
 * que la lista sea el registro completo de la caja.
 */
export function movimientosDePago(iniciales: PagoInicial[], cuotas: ComprobanteDePago[]): MovimientoDePago[] {
  const deIniciales = iniciales
    .filter((pago) => pago.downPaymentStatus)
    .map((pago) => {
      const estado = estadoDePago(pago.downPaymentStatus);
      return {
        id: `inicial-${pago.applicationId}`,
        tipo: 'Pago inicial' as const,
        codigo: pago.applicationCode,
        importe: Number(pago.downPaymentAmount ?? 0),
        referencia: pago.payerReference,
        estado: estado.texto,
        tono: estado.tono,
        fecha: pago.decidedAt ?? pago.submittedAt,
      };
    });
  const deCuotas = cuotas.map((pago) => {
    const estado = estadoDePago(pago.status);
    return {
      id: `cuota-${pago.claimId}`,
      tipo: 'Cuota' as const,
      codigo: pago.claimCode,
      importe: Number(pago.claimedAmount),
      referencia: pago.payerReference,
      estado: estado.texto,
      tono: estado.tono,
      fecha: pago.decidedAt ?? pago.submittedAt,
    };
  });
  return [...deIniciales, ...deCuotas].sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
}

/** Las solicitudes que el comercio ya respondió: aceptadas o rechazadas. */
export function solicitudesDecididas(solicitudes: SolicitudDeCompra[]): SolicitudDeCompra[] {
  return solicitudes
    .filter((solicitud) => solicitud.businessAcceptance === 'accepted' || solicitud.businessAcceptance === 'declined')
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleString('es-BO') : '—');

/** El historial de la caja: solicitudes ya respondidas y todos los pagos, iniciales y de cuota. */
export function MerchantPosHistoryScreen({ partnerId }: Readonly<{ partnerId: string }>) {
  const [solicitudes, setSolicitudes] = useState<SolicitudDeCompra[]>([]);
  const [iniciales, setIniciales] = useState<PagoInicial[]>([]);
  const [cuotas, setCuotas] = useState<ComprobanteDePago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    if (!partnerId) return;
    setCargando(true);
    setError(null);
    try {
      const [s, i, c] = await Promise.all([
        merchantCreditService.listar(partnerId, false),
        merchantCreditService.listarPagosIniciales(partnerId, false),
        merchantCreditService.listarComprobantes(partnerId, false),
      ]);
      setSolicitudes(s.applications ?? []);
      setIniciales(i.downPayments ?? []);
      setCuotas(c.claims ?? []);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible cargar el historial.');
    } finally {
      setCargando(false);
    }
  }, [partnerId]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const decididas = useMemo(() => solicitudesDecididas(solicitudes), [solicitudes]);
  const pagos = useMemo(() => movimientosDePago(iniciales, cuotas), [iniciales, cuotas]);
  const actualizar = (
    <AtlasButton variant="secondary" icon="refresh" disabled={!partnerId} loading={cargando} onClick={() => void recargar()}>
      Actualizar
    </AtlasButton>
  );

  return (
    <div className="space-y-5">
      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}

      <Panel title="Solicitudes respondidas" description="Las compras que usted aceptó o rechazó, más recientes primero." icon="history" action={actualizar}>
        {cargando ? (
          <p className="py-8 text-center text-xs text-slate-500">Cargando…</p>
        ) : decididas.length === 0 ? (
          <Vacio texto="Todavía no respondió ninguna solicitud." />
        ) : (
          <table className="w-full text-left text-xs" data-testid="historial-solicitudes">
            <thead className="text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2">Fecha</th>
                <th>Código</th>
                <th>Importe</th>
                <th>Cuotas</th>
                <th>Sucursal</th>
                <th>Respuesta</th>
              </tr>
            </thead>
            <tbody>
              {decididas.map((solicitud) => (
                <tr key={solicitud.applicationId} className="border-t border-slate-100">
                  <td className="py-2">{fecha(solicitud.submittedAt)}</td>
                  <td className="font-semibold">{solicitud.applicationCode}</td>
                  <td>{formatBob(Number(solicitud.requestedAmount))}</td>
                  <td>{solicitud.requestedTermMonths}</td>
                  <td>{solicitud.branchName ?? '—'}</td>
                  <td>
                    <StatusPill tone={solicitud.businessAcceptance === 'accepted' ? 'success' : 'danger'}>
                      {solicitud.businessAcceptance === 'accepted' ? 'Aceptada' : 'Rechazada'}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel title="Pagos recibidos" description="Pagos iniciales y cuotas que sus clientes avisaron, con su estado." icon="payments">
        {cargando ? (
          <p className="py-8 text-center text-xs text-slate-500">Cargando…</p>
        ) : pagos.length === 0 ? (
          <Vacio texto="Todavía no hay pagos avisados." />
        ) : (
          <table className="w-full text-left text-xs" data-testid="historial-pagos">
            <thead className="text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2">Fecha</th>
                <th>Tipo</th>
                <th>Código</th>
                <th>Importe</th>
                <th>Referencia</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((pago) => (
                <tr key={pago.id} className="border-t border-slate-100">
                  <td className="py-2">{fecha(pago.fecha)}</td>
                  <td>
                    <StatusPill tone={pago.tipo === 'Pago inicial' ? 'info' : 'neutral'} dot={false}>
                      {pago.tipo}
                    </StatusPill>
                  </td>
                  <td className="font-semibold">{pago.codigo}</td>
                  <td>{formatBob(pago.importe)}</td>
                  <td>{pago.referencia ?? '—'}</td>
                  <td>
                    <StatusPill tone={pago.tono}>{pago.estado}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

function Vacio({ texto }: Readonly<{ texto: string }>) {
  return (
    <div className="py-10 text-center">
      <Icon name="inbox" className="text-[28px] text-slate-400" />
      <p className="mt-2 text-xs text-slate-500">{texto}</p>
    </div>
  );
}
