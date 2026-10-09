'use client';

import { useCallback, useEffect, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { OrigenDeCaja } from '@/components/atlas/OrigenDeCaja';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { formatBob } from '@/lib/formatters';
import { merchantCreditService, type PagoInicial } from '@/services/merchantCreditService';
import { ComprobanteImagen } from './MerchantPaymentProofsScreen';

const MOTIVOS = [
  { label: '— Elija el motivo —', value: '' },
  { label: 'No encuentro la transferencia en mi cuenta', value: 'No encuentro la transferencia en mi cuenta' },
  { label: 'El importe no coincide', value: 'El importe no coincide' },
  { label: 'El comprobante no se lee o no corresponde', value: 'El comprobante no se lee o no corresponde' },
  { label: 'La transferencia es de otra operación', value: 'La transferencia es de otra operación' },
];

/** A nivel de módulo: ver el comentario de `ComprobanteImagen` (un valor nuevo por render repite la petición). */
const imagenDePagoInicial = (socio: string, id: string) => merchantCreditService.pagoInicialImagen(socio, id);

/**
 * Los pagos INICIALES de las compras: el 60 % que el cliente le pagó directo al comercio al comprar.
 *
 * Ese dinero entra en la cuenta del comercio, no en la de Atlas, así que sólo él puede decir si llegó. Hasta ahora el
 * comprobante se quedaba en el teléfono del cliente: la app decía «esperando al comercio» y el comercio no veía nada.
 * Confirmarlo es lo que el cliente ve como «pagado» en su app; rechazarlo exige motivo y también se lo enseña.
 */
export function MerchantDownPaymentsPanel({ partnerId, onCount }: Readonly<{ partnerId: string; onCount?: ((total: number) => void) | undefined }>) {
  const [pagos, setPagos] = useState<PagoInicial[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'success' | 'danger'; texto: string } | null>(null);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const resultado = await merchantCreditService.listarPagosIniciales(partnerId);
      const filas = resultado.downPayments ?? [];
      setPagos(filas);
      onCount?.(filas.length);
      setError(null);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible leer los pagos iniciales.');
    } finally {
      setCargando(false);
    }
  }, [partnerId, onCount]);

  useEffect(() => {
    if (partnerId) void recargar();
    else setCargando(false);
  }, [partnerId, recargar]);

  async function decidir(pago: PagoInicial, verificado: boolean) {
    if (!verificado && !motivo) return;
    setOcupado(pago.applicationId);
    try {
      await merchantCreditService.verificarPagoInicial(partnerId, pago.applicationId, {
        verified: verificado,
        ...(verificado ? {} : { reason: motivo }),
      });
      setAviso({
        tono: verificado ? 'success' : 'danger',
        texto: verificado
          ? `Confirmaste el pago inicial de ${formatBob(Number(pago.downPaymentAmount))}. El cliente ya lo ve pagado en su app.`
          : `Rechazaste el pago inicial de la compra ${pago.applicationCode}. El cliente verá el motivo.`,
      });
      setRechazando(null);
      setMotivo('');
      await recargar();
    } catch (fallo) {
      setAviso({ tono: 'danger', texto: fallo instanceof Error ? fallo.message : 'No fue posible registrar la decisión.' });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-3" data-testid="pagos-iniciales">
      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
      {aviso ? <InlineNotice tone={aviso.tono}>{aviso.texto}</InlineNotice> : null}
      <Panel
        title="Pagos iniciales de compras"
        description="El 60 % que sus clientes le pagaron directo al comprar. Compruebe en su cuenta que el dinero entró antes de confirmar."
        icon="payments"
        action={<AtlasButton variant="secondary" icon="refresh" loading={cargando} onClick={() => void recargar()}>Actualizar</AtlasButton>}
      >
        {cargando ? (
          <p className="py-6 text-center text-xs text-slate-500">Cargando…</p>
        ) : pagos.length === 0 ? (
          <div className="py-8 text-center">
            <Icon name="check_circle" className="text-[28px] text-emerald-600" />
            <p className="mt-2 text-xs font-bold">No hay pagos iniciales esperando</p>
            <p className="mt-1 text-[11px] text-slate-500">Cuando un cliente avise que pagó el inicial de su compra, aparecerá aquí con su comprobante.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pagos.map((pago) => (
              <article key={pago.applicationId} className="rounded-md border border-slate-200 p-4" data-testid={`pago-inicial-${pago.applicationId}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold">Compra {pago.applicationCode}</h3>
                      <StatusPill tone="warning">PAGO INICIAL POR CONFIRMAR</StatusPill>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {pago.submittedAt ? `Avisado el ${new Date(pago.submittedAt).toLocaleString('es-BO')}` : 'Sin fecha'}
                    </p>
                    <OrigenDeCaja origen={pago} />
                    <p className="mt-1 text-[11px] text-slate-600">
                      Referencia del banco: <b>{pago.payerReference ?? 'sin referencia'}</b>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Importe declarado</p>
                    <p className="text-2xl font-extrabold">{formatBob(Number(pago.downPaymentAmount))}</p>
                    <p className="text-[11px] text-slate-500">{pago.currencyCode}</p>
                  </div>
                </div>

                {pago.hasProof ? (
                  <div className="mt-4">
                    <ComprobanteImagen partnerId={partnerId} claimId={pago.applicationId} cargar={imagenDePagoInicial} />
                  </div>
                ) : (
                  <div className="mt-4">
                    <InlineNotice tone="warning" title="Sin comprobante adjunto">
                      El cliente avisó del pago pero no subió ninguna imagen. Búsquelo en su cuenta por la referencia antes de confirmar.
                    </InlineNotice>
                  </div>
                )}

                {rechazando === pago.applicationId ? (
                  <div className="mt-4 space-y-3 rounded-md bg-slate-50 p-3">
                    <FormField
                      tooltip="Por qué se rechaza el pago inicial; el cliente lo lee en su app."
                      kind="select"
                      label="Motivo del rechazo"
                      name="reason"
                      required
                      value={motivo}
                      onChange={(evento) => setMotivo(evento.target.value)}
                      options={MOTIVOS}
                      hint="El cliente verá que su aviso fue rechazado y por qué; podrá avisar de nuevo."
                    />
                    <div className="flex gap-2">
                      <AtlasButton variant="danger" icon="close" disabled={!motivo} loading={ocupado === pago.applicationId} onClick={() => void decidir(pago, false)}>Rechazar pago inicial</AtlasButton>
                      <AtlasButton variant="secondary" onClick={() => { setRechazando(null); setMotivo(''); }}>Cancelar</AtlasButton>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex gap-2">
                    <AtlasButton variant="success" icon="check" loading={ocupado === pago.applicationId} onClick={() => void decidir(pago, true)}>Confirmar que recibí el pago</AtlasButton>
                    <AtlasButton variant="secondary" icon="close" onClick={() => setRechazando(pago.applicationId)}>Rechazar</AtlasButton>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
