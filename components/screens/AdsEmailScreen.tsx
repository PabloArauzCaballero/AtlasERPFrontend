'use client';

import { useCallback, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { CrudDirectory } from '@/components/screens/CrudDirectory';
import { InlineActionForm } from '@/components/screens/InlineActionForm';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { formatDate, statusTone } from '@/lib/formatters';
import { adsService } from '@/services/adsService';
import { loadCampaigns } from '@/services/optionLoaders';
import type { JsonObject, ResourceRow } from '@/services/types';

/**
 * Correo de campaña: envío, seguimiento y supresiones.
 *
 * Los cuatro endpoints existían desde que se añadió la mensajería —encolar, consultar el
 * seguimiento, suprimir una dirección y listar las supresiones— y no los llamaba ninguna pantalla:
 * la única forma de suprimir una dirección que había pedido la baja era un `curl`, y el estado de
 * un envío no se podía mirar en ningún sitio.
 *
 * Dos cosas que la pantalla hace explícitas porque el backend las impone y de otro modo sorprenden:
 *
 * 1. **El envío es idempotente por clave.** Reintentar con la misma clave devuelve el seguimiento
 *    del primer envío en vez de mandar los correos otra vez. La clave se genera aquí, una por
 *    formulario abierto; no la teclea nadie.
 * 2. **Las supresiones ganan siempre.** Un destinatario suprimido no se encola, y el resultado lo
 *    dice: «encolados N, suprimidos M». Sin ese número, un envío a una lista con bajas parecería
 *    haber salido entero.
 */

const RAZONES = [
  { label: 'Baja voluntaria', value: 'UNSUBSCRIBE' },
  { label: 'Rebote duro', value: 'HARD_BOUNCE' },
  { label: 'Reporte de spam', value: 'SPAM_REPORT' },
  { label: 'Alta manual', value: 'MANUAL' },
];

function s(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function n(value: unknown): number {
  return Number(value ?? 0);
}

export function AdsEmailScreen() {
  const [tab, setTab] = useState('envio');
  const [trackingId, setTrackingId] = useState('');
  const [version, setVersion] = useState(0);

  const tracking = useAsyncResource(
    useCallback(
      async () => (trackingId ? adsService.getEmailTracking(trackingId).catch(() => null) : null),
      [trackingId],
    ),
  );

  async function enviar(payload: JsonObject) {
    const destinatarios = String(payload.recipients ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((email) => ({ email }));

    /*
     * La clave de idempotencia se genera por envío, no por formulario montado: dos envíos distintos
     * desde la misma pantalla son dos envíos, y compartir clave haría que el segundo devolviera el
     * seguimiento del primero sin mandar nada.
     */
    const idempotencyKey = globalThis.crypto.randomUUID();
    const result = (await adsService.sendCampaignEmail(
      {
        campaignId: payload.campaignId,
        subject: payload.subject,
        htmlBody: payload.htmlBody,
        ...(payload.textBody ? { textBody: payload.textBody } : {}),
        ...(payload.scheduledAt ? { scheduledAt: new Date(String(payload.scheduledAt)).toISOString() } : {}),
        recipients: destinatarios,
      },
      idempotencyKey,
    )) as Record<string, unknown>;

    if (result.trackingId) setTrackingId(s(result.trackingId));
    return result;
  }

  const seguimiento = tracking.data as Record<string, unknown> | null;
  const mensajes = (seguimiento?.messages as ResourceRow[] | undefined) ?? [];
  const porEstado = (seguimiento?.byStatus as Record<string, number> | undefined) ?? {};

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Ads' }, { label: 'Correo' }]}
        title="Correo de campaña"
        description="Encolar un envío, seguir en qué estado está cada mensaje y mantener la lista de direcciones suprimidas."
      />
      <TabbedPanels
        activeId={tab}
        onChange={setTab}
        keepMounted
        tabs={[
          {
            id: 'envio',
            label: 'Envío y seguimiento',
            icon: 'outgoing_mail',
            content: (
              <div className="space-y-4">
                <InlineActionForm
                  title="Encolar un envío"
                  description="Los destinatarios van separados por coma. Quien esté suprimido no se encola, y el resultado dice cuántos quedaron fuera."
                  icon="send"
                  submitLabel="Encolar envío"
                  successMessage="El envío quedó encolado. Abajo aparece su seguimiento."
                  onSubmit={enviar}
                  onDone={() => void tracking.reload()}
                  fields={[
                    { name: 'campaignId', label: 'Campaña', type: 'select', required: true, span: 2, optionsLoader: loadCampaigns },
                    { name: 'subject', label: 'Asunto', required: true, span: 2 },
                    { name: 'recipients', label: 'Destinatarios', required: true, span: 3, placeholder: 'ana@comercio.bo, luis@comercio.bo', hint: 'Hasta 500 direcciones, separadas por coma.' },
                    { name: 'htmlBody', label: 'Cuerpo HTML', type: 'textarea', required: true, span: 3 },
                    { name: 'textBody', label: 'Cuerpo en texto plano', type: 'textarea', optional: true, span: 3, hint: 'Para los clientes de correo que no pintan HTML.' },
                    { name: 'scheduledAt', label: 'Programar para', type: 'datetime', optional: true, hint: 'Vacío = ahora.' },
                  ]}
                />

                <Panel
                  title="Seguimiento"
                  description={trackingId ? `Envío ${trackingId}` : 'Aquí aparece el envío recién encolado; también se puede pegar un identificador de seguimiento.'}
                  icon="mark_email_read"
                  action={
                    <AtlasButton variant="secondary" icon="refresh" loading={tracking.status === 'loading'} disabled={!trackingId} onClick={tracking.reload}>
                      Actualizar
                    </AtlasButton>
                  }
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="flex-1 min-w-64">
                        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">Identificador de seguimiento</span>
                        <input
                          value={trackingId}
                          onChange={(event) => setTrackingId(event.target.value.trim())}
                          placeholder="UUID del envío"
                          className="h-9 w-full rounded-md border border-slate-300 px-3 text-xs"
                        />
                      </label>
                    </div>

                    {!trackingId ? null : !seguimiento ? (
                      <InlineNotice tone="info">Sin datos para ese identificador todavía.</InlineNotice>
                    ) : (
                      <>
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                          <MetricCard label="Mensajes" value={n(seguimiento.total)} detail="Encolados en este envío" icon="mail" />
                          {Object.entries(porEstado).map(([estado, cantidad]) => (
                            <MetricCard key={estado} label={estado.replaceAll('_', ' ')} value={cantidad} detail="Mensajes en este estado" icon="inventory" tone={estado === 'SENT' ? 'teal' : estado === 'FAILED' ? 'red' : 'amber'} />
                          ))}
                        </div>
                        <div className="overflow-hidden rounded-md border border-slate-200">
                          <div className="grid grid-cols-[1.4fr_1fr_0.6fr_1fr_1.4fr] bg-slate-50 px-4 py-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                            <span>Referencia</span><span>Estado</span><span className="text-right">Intentos</span><span>Enviado</span><span>Error</span>
                          </div>
                          <div className="divide-y divide-slate-100">
                            {mensajes.map((row) => (
                              <div key={s(row.id)} className="grid grid-cols-[1.4fr_1fr_0.6fr_1fr_1.4fr] items-center px-4 py-2 text-xs">
                                <span className="truncate font-mono text-[11px] text-slate-600">{s(row.recipientReference) || '—'}</span>
                                <span><StatusPill tone={statusTone(row.status)}>{s(row.status)}</StatusPill></span>
                                <span className="text-right tabular-nums text-slate-600">{n(row.attempts)}</span>
                                <span className="text-slate-600">{row.sentAt ? formatDate(s(row.sentAt)) : '—'}</span>
                                <span className="truncate text-slate-500">{s(row.error) || '—'}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </Panel>
              </div>
            ),
          },
          {
            id: 'supresiones',
            label: 'Supresiones',
            icon: 'unsubscribe',
            content: (
              <CrudDirectory
                key={version}
                embedded
                moduleLabel="Ads"
                title="Direcciones suprimidas"
                description="Quien está en esta lista no recibe correo de campaña, aunque venga en los destinatarios del envío."
                load={() => adsService.listEmailSuppressions()}
                labelKey="emailMasked"
                searchPlaceholder="Buscar por dirección o motivo…"
                emptyHint="Sin supresiones: todos los destinatarios de un envío se encolan."
                notice={{
                  tone: 'info',
                  title: 'La dirección no se muestra entera',
                  body: 'El backend devuelve sólo los últimos caracteres. Es una lista de bajas y reportes de spam: para operarla basta con reconocer la dirección, no hace falta exponerla.',
                }}
                columns={[
                  { key: 'emailMasked', label: 'Dirección', kind: 'mono' },
                  { key: 'reason', label: 'Motivo', kind: 'status' },
                  { key: 'details', label: 'Detalle' },
                ]}
                filters={[{ key: 'reason', label: 'Motivo', options: RAZONES }]}
                create={{
                  label: 'Suprimir dirección',
                  title: 'Suprimir una dirección',
                  description: 'Volver a suprimir una dirección ya suprimida no la duplica: actualiza el motivo y la reactiva si estaba dada de baja.',
                  fields: [
                    { name: 'email', label: 'Dirección', type: 'email', required: true, span: 2 },
                    { name: 'reason', label: 'Motivo', type: 'select', required: true, options: RAZONES },
                    { name: 'details', label: 'Detalle', optional: true, span: 3, placeholder: 'Pidió la baja por teléfono el 12/03' },
                  ],
                  submit: async (payload) => {
                    const created = await adsService.suppressEmail(payload);
                    setVersion((value) => value + 1);
                    return created;
                  },
                }}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
