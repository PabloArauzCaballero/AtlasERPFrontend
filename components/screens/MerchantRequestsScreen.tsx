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
import { BotonPdf } from '@/components/atlas/BotonPdf';
import { tablaPdf } from '@/lib/pdf';
import { formatBob } from '@/lib/formatters';
import { merchantCreditService } from '@/services/merchantCreditService';
import type { SolicitudDeCompra } from '@/services/merchantCreditService';

const MOTIVOS = [
  { label: '— Elija el motivo —', value: '' },
  { label: 'El cliente se arrepintió', value: 'CLIENTE_DESISTIO' },
  { label: 'No tengo el producto disponible', value: 'SIN_STOCK' },
  { label: 'El importe no corresponde a esta venta', value: 'IMPORTE_NO_CORRESPONDE' },
  { label: 'Sospecha de suplantación', value: 'SOSPECHA_IDENTIDAD' },
  { label: 'Otro', value: 'OTRO' },
];

/**
 * Lo que el cliente pidió en el mostrador, esperando el sí o el no del comercio.
 *
 * El cliente escanea el QR del local, pide un importe, y el motor de decisión resuelve si lo
 * aprueba y con qué esquema de pagos. Aquí NO hay ningún campo editable, y esa ausencia es la
 * función de la pantalla: el comercio acepta o rechaza, nada más. Poder retocar el importe o el
 * calendario sería deshacer desde el mostrador la decisión que sostiene el riesgo de la operación.
 *
 * Tampoco se muestra quién es el cliente. El comercio decide si quiere la operación —importe,
 * plazo, que el motor la aprobó—, no sobre la persona: enseñarle el expediente convertiría cada
 * compra en una consulta de historial crediticio que nadie autorizó.
 */
export function MerchantRequestsScreen() {
  const [partnerId, setPartnerId] = useState('');
  const [nombre, setNombre] = useState('');
  const [solicitudes, setSolicitudes] = useState<SolicitudDeCompra[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tono: 'success' | 'danger'; texto: string } | null>(null);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);

  const recargar = useCallback(async (id: string) => {
    setCargando(true);
    try {
      const resultado = await merchantCreditService.listar(id);
      setSolicitudes(resultado.applications ?? []);
      setError(null);
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No fue posible leer las solicitudes.');
    } finally {
      setCargando(false);
    }
  }, []);

  /* Primero hay que saber cuál es mi expediente; sin él no hay nada que pedir. */
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

  async function decidir(solicitud: SolicitudDeCompra, aceptada: boolean) {
    if (!aceptada && !motivo) return;
    setOcupado(solicitud.applicationId);
    try {
      await merchantCreditService.decidir(partnerId, solicitud.applicationId, {
        accepted: aceptada,
        ...(aceptada ? {} : { reasonCode: motivo }),
      });
      setAviso({
        tono: aceptada ? 'success' : 'danger',
        texto: aceptada
          ? `Aceptaste la compra ${solicitud.applicationCode}. El cliente ya puede llevarse el producto.`
          : `Rechazaste la compra ${solicitud.applicationCode}.`,
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
        breadcrumbs={[{ label: 'Portal comercio' }, { label: 'Solicitudes' }]}
        title="Solicitudes de compra"
        description="Lo que sus clientes pidieron escaneando el QR del local. Usted acepta o rechaza; el importe y las cuotas los fijó el motor de decisión."
        actions={
          <>
            <BotonPdf
              label="Descargar PDF"
              data-testid="pdf-solicitudes"
              disabled={cargando || !solicitudes.length}
              documento={() => ({
                title: 'Solicitudes de compra',
                subtitle: nombre ? `Portal del comercio · ${nombre}` : 'Portal del comercio',
                summary: [{ label: 'Solicitudes', value: solicitudes.length }],
                sections: [
                  {
                    title: 'Solicitudes recibidas',
                    description: 'Lo que los clientes pidieron escaneando el QR del local.',
                    table: tablaPdf(
                      [
                        { key: 'applicationCode', label: 'Código' },
                        { key: 'submittedAt', label: 'Recibida' },
                        { key: 'requestedAmount', label: 'Importe' },
                        { key: 'requestedTermMonths', label: 'Cuotas' },
                        { key: 'branchName', label: 'Sucursal' },
                        { key: 'status', label: 'Estado' },
                      ],
                      solicitudes as unknown as Array<Record<string, unknown>>,
                    ),
                  },
                ],
              })}
            />
            <AtlasButton variant="secondary" icon="refresh" disabled={!partnerId} loading={cargando} onClick={() => partnerId && void recargar(partnerId)}>Actualizar</AtlasButton>
          </>
        }
      />

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Esperando respuesta" value={solicitudes.length} detail="Solicitudes pendientes" icon="pending_actions" />
        <MetricCard label="Comercio" value={nombre || '—'} detail={partnerId ? `Expediente ${partnerId}` : 'Identificando…'} icon="storefront" tone="teal" />
        <MetricCard label="Quién fija las cuotas" value="El motor" detail="Usted no puede editarlas" icon="verified" tone="purple" />
      </div>

      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
      {aviso ? <InlineNotice tone={aviso.tono}>{aviso.texto}</InlineNotice> : null}

      <Panel
        data-tutorial-id="solicitudes-cola"
        title="Esperando su respuesta"
        description="Sólo puede aceptar o rechazar. No hay ningún campo que se pueda modificar."
        icon="inbox"
      >
        {cargando ? (
          <p className="py-8 text-center text-xs text-slate-500">Cargando…</p>
        ) : solicitudes.length === 0 ? (
          <div className="py-10 text-center">
            <Icon name="check_circle" className="text-[28px] text-emerald-600" />
            <p className="mt-2 text-xs font-bold">No hay nada esperando</p>
            <p className="mt-1 text-[11px] text-slate-500">Cuando un cliente escanee el QR y el motor apruebe su compra, aparecerá aquí.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {solicitudes.map((solicitud) => (
              <article key={solicitud.applicationId} className="rounded-md border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold">{solicitud.applicationCode}</h3>
                      <StatusPill tone="warning">{solicitud.businessAcceptance ?? 'PENDIENTE'}</StatusPill>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Pedida el {new Date(solicitud.submittedAt).toLocaleString('es-BO')} · aprobada por el motor
                    </p>
                    {solicitud.branchName ? (
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                        <span className="material-symbols-rounded text-[14px] text-[#006a61]">store</span>
                        {solicitud.branchName}
                        {solicitud.terminalAlias ? ` · ${solicitud.terminalAlias}` : ''}
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] italic text-slate-400">Sin sucursal registrada en la compra</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Importe</p>
                    <p className="text-2xl font-extrabold">{formatBob(Number(solicitud.requestedAmount))}</p>
                    <p className="text-[11px] text-slate-500">{solicitud.requestedTermMonths} meses · {solicitud.currencyCode}</p>
                  </div>
                </div>

                {rechazando === solicitud.applicationId ? (
                  <div className="mt-4 space-y-3 rounded-md bg-slate-50 p-3">
                    <FormField
                      kind="select"
                      label="Motivo del rechazo"
                      name="reasonCode"
                      required
                      value={motivo}
                      onChange={(evento) => setMotivo(evento.target.value)}
                      options={MOTIVOS}
                      hint="Rechazar algo que el motor aprobó tiene que quedar explicado."
                    />
                    <div className="flex gap-2">
                      <AtlasButton variant="danger" icon="close" disabled={!motivo} loading={ocupado === solicitud.applicationId} onClick={() => void decidir(solicitud, false)}>Confirmar rechazo</AtlasButton>
                      <AtlasButton variant="secondary" onClick={() => { setRechazando(null); setMotivo(''); }}>Cancelar</AtlasButton>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex gap-2">
                    <AtlasButton variant="success" icon="check" loading={ocupado === solicitud.applicationId} onClick={() => void decidir(solicitud, true)}>Aceptar</AtlasButton>
                    <AtlasButton variant="secondary" icon="close" onClick={() => setRechazando(solicitud.applicationId)}>Rechazar</AtlasButton>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </Panel>

      <InlineNotice tone="info" title="Por qué no puede editar nada">
        El importe y el calendario de cuotas los decidió el motor al aprobar la solicitud, con el
        historial del cliente delante. Cambiarlos aquí sería rehacer esa decisión desde el mostrador.
      </InlineNotice>
    </div>
  );
}
