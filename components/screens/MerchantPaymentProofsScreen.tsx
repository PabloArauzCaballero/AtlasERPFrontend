'use client';

import { useCallback, useEffect, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { formatBob } from '@/lib/formatters';
import { merchantCreditService } from '@/services/merchantCreditService';
import type { ComprobanteDePago } from '@/services/merchantCreditService';

const MOTIVOS = [
  { label: '— Elija el motivo —', value: '' },
  { label: 'No encuentro la transferencia en mi cuenta', value: 'NO_APARECE_EN_CUENTA' },
  { label: 'El importe no coincide', value: 'IMPORTE_NO_COINCIDE' },
  { label: 'El comprobante no se lee o no corresponde', value: 'COMPROBANTE_ILEGIBLE' },
  { label: 'La transferencia es de otra operación', value: 'OTRA_OPERACION' },
  { label: 'Otro', value: 'OTRO' },
];

/**
 * Los comprobantes de transferencia que esperan la palabra del comercio.
 *
 * El cliente paga al QR bancario del comercio, así que ese dinero entra en SU cuenta y no en la de
 * Atlas. Es el único que puede mirar su extracto y decir si llegó: por eso la cuota no se da por
 * pagada hasta que él lo confirma, y por eso confirmarlo es lo que registra el pago de verdad.
 *
 * Rechazar exige motivo. Quien queda sin su pago reconocido tiene derecho a saber por qué, y sin
 * motivo no hay forma de distinguir un error del cliente de uno del comercio.
 */
export function MerchantPaymentProofsScreen() {
  const [partnerId, setPartnerId] = useState('');
  const [nombre, setNombre] = useState('');
  const [comprobantes, setComprobantes] = useState<ComprobanteDePago[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'success' | 'danger'; texto: string } | null>(null);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const recargar = useCallback(async (id: string) => {
    setCargando(true);
    try {
      const resultado = await merchantCreditService.listarComprobantes(id);
      setComprobantes(resultado.claims ?? []);
      setError(null);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible leer los comprobantes.');
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
        if (!propio) {
          setError('Su usuario no tiene un expediente de comercio asignado.');
          setCargando(false);
          return;
        }
        setPartnerId(propio.partnerId);
        setNombre(propio.tradeName ?? propio.legalName ?? '');
        void recargar(propio.partnerId);
      })
      .catch((fallo: unknown) => {
        if (cancelado) return;
        setError(fallo instanceof Error ? fallo.message : 'No fue posible identificar su comercio.');
        setCargando(false);
      });
    return () => { cancelado = true; };
  }, [recargar]);

  async function decidir(comprobante: ComprobanteDePago, verificado: boolean) {
    if (!verificado && !motivo) return;
    setOcupado(comprobante.claimId);
    try {
      await merchantCreditService.verificarComprobante(partnerId, comprobante.claimId, {
        verified: verificado,
        ...(verificado ? {} : { reason: motivo }),
      });
      setAviso({
        tono: verificado ? 'success' : 'danger',
        texto: verificado
          ? `Confirmaste el pago de ${formatBob(Number(comprobante.claimedAmount))}. La cuota queda saldada.`
          : `Rechazaste el comprobante ${comprobante.claimCode}.`,
      });
      setRechazando(null);
      setMotivo('');
      await recargar(partnerId);
    } catch (fallo) {
      setAviso({ tono: 'danger', texto: fallo instanceof Error ? fallo.message : 'No fue posible registrar la decisión.' });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Portal comercio' }, { label: 'Comprobantes' }]}
        title="Comprobantes por verificar"
        description="Sus clientes avisaron que transfirieron a su cuenta. Confirme lo que ya vio entrar; la cuota se da por pagada sólo entonces."
        actions={<AtlasButton variant="secondary" icon="refresh" disabled={!partnerId} loading={cargando} onClick={() => partnerId && void recargar(partnerId)}>Actualizar</AtlasButton>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Por verificar" value={cargando ? '…' : comprobantes.length} detail="Esperando su confirmación" icon="receipt_long" />
        <MetricCard label="Comercio" value={nombre || '—'} detail={partnerId ? `Expediente ${partnerId}` : 'Identificando…'} icon="storefront" tone="teal" />
        <MetricCard label="Quién confirma" value="Usted" detail="El dinero entra en su cuenta" icon="verified_user" tone="purple" />
      </div>

      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
      {aviso ? <InlineNotice tone={aviso.tono}>{aviso.texto}</InlineNotice> : null}

      <Panel
        data-tutorial-id="comprobantes-cola"
        title="Esperando su confirmación"
        description="Compruebe en su extracto que el dinero entró antes de confirmar."
        icon="fact_check"
      >
        {cargando ? (
          <p className="py-8 text-center text-xs text-slate-500">Cargando…</p>
        ) : comprobantes.length === 0 ? (
          <div className="py-10 text-center">
            <Icon name="check_circle" className="text-[28px] text-emerald-600" />
            <p className="mt-2 text-xs font-bold">No hay comprobantes esperando</p>
            <p className="mt-1 text-[11px] text-slate-500">Cuando un cliente avise que transfirió, aparecerá aquí con su comprobante.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comprobantes.map((comprobante) => (
              <article key={comprobante.claimId} className="rounded-md border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold">{comprobante.claimCode}</h3>
                      <StatusPill tone="warning">POR VERIFICAR</StatusPill>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Avisado el {new Date(comprobante.submittedAt).toLocaleString('es-BO')}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      Referencia del banco: <b>{comprobante.payerReference ?? 'sin referencia'}</b>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Importe declarado</p>
                    <p className="text-2xl font-extrabold">{formatBob(Number(comprobante.claimedAmount))}</p>
                    <p className="text-[11px] text-slate-500">{comprobante.currencyCode}</p>
                  </div>
                </div>

                {rechazando === comprobante.claimId ? (
                  <div className="mt-4 space-y-3 rounded-md bg-slate-50 p-3">
                    <FormField
                      kind="select"
                      label="Motivo del rechazo"
                      name="reason"
                      required
                      value={motivo}
                      onChange={(evento) => setMotivo(evento.target.value)}
                      options={MOTIVOS}
                      hint="El cliente verá que su aviso fue rechazado; el motivo es lo que le permite corregirlo."
                    />
                    <div className="flex gap-2">
                      <AtlasButton variant="danger" icon="close" disabled={!motivo} loading={ocupado === comprobante.claimId} onClick={() => void decidir(comprobante, false)}>Confirmar rechazo</AtlasButton>
                      <AtlasButton variant="secondary" onClick={() => { setRechazando(null); setMotivo(''); }}>Cancelar</AtlasButton>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex gap-2">
                    <AtlasButton variant="success" icon="check" loading={ocupado === comprobante.claimId} onClick={() => void decidir(comprobante, true)}>Verificar y dar por pagado</AtlasButton>
                    <AtlasButton variant="secondary" icon="close" onClick={() => setRechazando(comprobante.claimId)}>Rechazar</AtlasButton>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </Panel>

      <InlineNotice tone="info" title="Por qué lo confirma usted">
        El cliente transfiere al QR bancario de su comercio, así que ese dinero entra en su cuenta y
        no en la de Atlas. Un comprobante es evidencia de que alguien hizo una transferencia, no de
        que usted la recibió: por eso la cuota se salda cuando usted lo ve en su extracto.
      </InlineNotice>
    </div>
  );
}
