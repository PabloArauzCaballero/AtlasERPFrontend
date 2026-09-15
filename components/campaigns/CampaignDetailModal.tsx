'use client';

import { useCallback, useEffect, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Modal } from '@/components/atlas/Modal';
import { StatusPill } from '@/components/atlas/StatusPill';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { toast } from '@/lib/toast';
import {
  newIdempotencyKey,
  notificationCampaignsService,
  type Campaign,
  type CampaignAction,
  type CampaignChannel,
  type TestSendResult,
} from '@/services/notificationCampaignsService';
import { CHANNEL_META, STATUS_META, describeRule, errorMessage, formatCount, formatDateTime } from './campaignCatalog';

/**
 * Detalle de una campaña: cómo le fue, qué se dijo, a quién, y lo que se puede hacer con ella.
 *
 * Mientras está programada o en curso se refresca sola cada 15 segundos: quien la lanzó quiere ver
 * los entregados subir sin pulsar nada, y quien la pausa necesita saber que dejó de salir.
 */

const MESSAGE_STATUS: Record<string, string> = {
  pending: 'Pendiente',
  sending: 'Enviando',
  sent: 'Enviado',
  delivered: 'Entregado',
  read: 'Leído',
  failed: 'Fallido',
  cancelled: 'Anulado',
};

interface CampaignDetailModalProps {
  campaignId: string;
  onClose: () => void;
  onChanged: () => void;
  onEdit: (campaign: Campaign) => void;
}

export function CampaignDetailModal({ campaignId, onClose, onChanged, onEdit }: CampaignDetailModalProps) {
  const detail = useAsyncResource(useCallback(() => notificationCampaignsService.get(campaignId), [campaignId]));
  const messages = useAsyncResource(useCallback(() => notificationCampaignsService.messages(campaignId, { limit: 20 }), [campaignId]));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [testCustomer, setTestCustomer] = useState('');
  const [testResult, setTestResult] = useState<TestSendResult | null>(null);
  const campaign = detail.data;
  const { reload: reloadDetail } = detail;
  const { reload: reloadMessages } = messages;
  const live = campaign?.status === 'running' || campaign?.status === 'scheduled';

  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => {
      void reloadDetail();
      void reloadMessages();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [live, reloadDetail, reloadMessages]);

  async function run(label: string, task: () => Promise<unknown>, success: string) {
    setBusy(label);
    setError(null);
    try {
      await task();
      toast.success(success);
      await Promise.all([reloadDetail(), reloadMessages()]);
      onChanged();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(null);
    }
  }

  const act = (action: CampaignAction, success: string) => run(action, () => notificationCampaignsService.action(campaignId, action, newIdempotencyKey()), success);

  if (!campaign) {
    return (
      <Modal open title="Campaña" onClose={onClose} icon="campaign">
        {detail.error ? <InlineNotice tone="danger" title="No se pudo cargar la campaña">{detail.error}</InlineNotice> : <p className="text-sm text-slate-500">Cargando…</p>}
      </Modal>
    );
  }

  const status = STATUS_META[campaign.status];
  const totals = campaign.metrics?.totals ?? { total: 0, pending: 0, delivered: 0, failed: 0, cancelled: 0, read: 0 };
  const canEdit = campaign.status === 'draft' || campaign.status === 'scheduled';
  const canCancel = ['draft', 'scheduled', 'running', 'paused'].includes(campaign.status);

  return (
    <Modal open title={campaign.name} description={status.hint} icon="campaign" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
          {campaign.channels.map((channel) => <StatusPill key={channel} tone="neutral" dot={false}>{CHANNEL_META[channel as CampaignChannel]?.label ?? channel}</StatusPill>)}
          <span className="text-xs text-slate-500">{campaign.purpose === 'marketing' ? 'Comercial (con consentimiento)' : 'Operativa'}</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {canEdit ? <AtlasButton variant="secondary" icon="edit" onClick={() => onEdit(campaign)}>Editar</AtlasButton> : null}
          {campaign.status === 'draft' ? <AtlasButton icon="schedule_send" loading={busy === 'schedule'} disabled={busy !== null} onClick={() => void act('schedule', 'Campaña programada')}>Programar</AtlasButton> : null}
          {campaign.status === 'scheduled' ? <AtlasButton variant="secondary" icon="undo" loading={busy === 'unschedule'} disabled={busy !== null} onClick={() => void act('unschedule', 'Vuelve a borrador')}>Desprogramar</AtlasButton> : null}
          {campaign.status === 'running' ? <AtlasButton variant="secondary" icon="pause" loading={busy === 'pause'} disabled={busy !== null} onClick={() => void act('pause', 'Campaña pausada')}>Pausar</AtlasButton> : null}
          {campaign.status === 'paused' ? <AtlasButton icon="play_arrow" loading={busy === 'resume'} disabled={busy !== null} onClick={() => void act('resume', 'Campaña reanudada')}>Reanudar</AtlasButton> : null}
          <AtlasButton variant="ghost" icon="content_copy" loading={busy === 'duplicate'} disabled={busy !== null} onClick={() => void act('duplicate', 'Copia creada como borrador')}>Duplicar</AtlasButton>
          {canCancel ? <AtlasButton variant="danger" icon="cancel" disabled={busy !== null} onClick={() => setCancelOpen(true)}>Cancelar</AtlasButton> : null}
        </div>

        {cancelOpen ? (
          <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/60 p-3">
            <FormField tooltip="Por qué se cancela; queda registrado en la campaña. Mínimo 8 caracteres." kind="textarea" label="Motivo de la cancelación" name="reason" required hint="Mínimo 8 caracteres. Queda registrado en la campaña." value={reason} onChange={(event) => setReason(event.target.value)} />
            <div className="flex gap-2">
              <AtlasButton variant="danger" loading={busy === 'cancel'} disabled={reason.trim().length < 8 || busy !== null} onClick={() => void run('cancel', () => notificationCampaignsService.cancel(campaignId, reason.trim()), 'Campaña cancelada').then(() => setCancelOpen(false))}>
                Confirmar cancelación
              </AtlasButton>
              <AtlasButton variant="ghost" onClick={() => setCancelOpen(false)}>Volver</AtlasButton>
            </div>
          </div>
        ) : null}

        {error ? <InlineNotice tone="danger" title="No se pudo completar">{error}</InlineNotice> : null}
        {campaign.lastError ? <InlineNotice tone="danger" title="La campaña se detuvo">{campaign.lastError}</InlineNotice> : null}
        {campaign.cancelReason ? <InlineNotice tone="warning" title="Motivo de la cancelación">{campaign.cancelReason}</InlineNotice> : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard label="Alcanzados" value={formatCount(campaign.targetedCount || campaign.audienceEstimate?.total)} detail={campaign.materializedAt ? 'Audiencia completa' : 'Audiencia estimada'} icon="groups" />
          <MetricCard label="Entregados" value={formatCount(totals.delivered)} detail={`de ${formatCount(totals.total)} avisos`} icon="done_all" tone="teal" />
          <MetricCard label="Leídos" value={formatCount(totals.read)} detail="Abiertos en la bandeja" icon="visibility" tone="purple" />
          <MetricCard label="Pendientes" value={formatCount(totals.pending)} detail="Esperan su turno" icon="schedule" tone="amber" />
          <MetricCard label="Fallidos" value={formatCount(totals.failed)} detail={totals.cancelled ? `${formatCount(totals.cancelled)} anulados` : 'Sin anulados'} icon="error" tone="red" />
        </div>

        {campaign.metrics?.channels.length ? (
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr><th className="px-3 py-2 text-left">Canal</th><th className="px-3 py-2 text-right">Avisos</th><th className="px-3 py-2 text-right">Entregados</th><th className="px-3 py-2 text-right">Leídos</th><th className="px-3 py-2 text-right">Pendientes</th><th className="px-3 py-2 text-right">Fallidos</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {campaign.metrics.channels.map((row) => (
                  <tr key={row.channel}>
                    <td className="px-3 py-2 font-bold">{CHANNEL_META[row.channel as CampaignChannel]?.label ?? row.channel}</td>
                    {[row.total, row.delivered, row.read, row.pending, row.failed].map((value, index) => <td key={index} className="px-3 py-2 text-right tabular-nums">{formatCount(value)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-slate-200 p-4 text-xs sm:grid-cols-2">
          {[
            ['Título', campaign.title],
            ['Mensaje', campaign.body],
            ['Audiencia', campaign.audience.rules.length ? campaign.audience.rules.map(describeRule).join(campaign.audience.match === 'any' ? ' o ' : ' y ') : 'Todos los clientes activos'],
            ['Al tocar', campaign.deepLink ?? 'Abre la app'],
            ['Ventana', `${formatDateTime(campaign.startsAt)} → ${campaign.endsAt ? formatDateTime(campaign.endsAt) : 'sin fin'}`],
            ['Cadencia', `${formatCount(campaign.ratePerMinute)} por minuto${campaign.maxRecipients ? ` · tope ${formatCount(campaign.maxRecipients)}` : ''}`],
            ['Programada', campaign.scheduledAt ? `${formatDateTime(campaign.scheduledAt)} por ${campaign.scheduledBy ?? '—'}` : '—'],
            ['Inicio real / fin', `${formatDateTime(campaign.startedAt)} / ${formatDateTime(campaign.finishedAt)}`],
          ].map(([label, value]) => <div key={label}><dt className="font-bold text-slate-500">{label}</dt><dd className="whitespace-pre-line text-slate-900">{value}</dd></div>)}
        </dl>

        <div className="space-y-2 rounded-lg border border-slate-200 p-3">
          <p className="text-xs font-bold text-slate-700">Enviar una prueba</p>
          <div className="flex flex-wrap items-end gap-2">
            <FormField tooltip="Identificador de tu cuenta de cliente en la app para recibir el aviso de prueba." label="ID de cliente de prueba" name="testCustomer" inputMode="numeric" className="w-56" hint="Tu cuenta de cliente en la app. Recibe el aviso marcado [PRUEBA]." value={testCustomer} onChange={(event) => setTestCustomer(event.target.value.replace(/[^0-9]/g, ''))} />
            <AtlasButton variant="secondary" icon="send" loading={busy === 'test'} disabled={!testCustomer || busy !== null} onClick={() => void run('test', async () => setTestResult(await notificationCampaignsService.testSend(campaignId, testCustomer)), 'Prueba enviada')}>
              Enviar prueba
            </AtlasButton>
          </div>
          {testResult ? (
            <ul className="space-y-1 text-xs">
              {testResult.results.map((result) => (
                <li key={result.messageId} className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={result.status === 'failed' ? 'danger' : 'success'}>{CHANNEL_META[result.channel as CampaignChannel]?.label ?? result.channel}: {MESSAGE_STATUS[result.status] ?? result.status}</StatusPill>
                  {result.errorMessage ? <span className="text-red-700">{result.errorMessage}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          <p className="mb-2 text-xs font-bold text-slate-700">Últimos avisos generados</p>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr><th className="px-3 py-2 text-left">Cliente</th><th className="px-3 py-2 text-left">Canal</th><th className="px-3 py-2 text-left">Estado</th><th className="px-3 py-2 text-left">Sale</th><th className="px-3 py-2 text-left">Entregado</th><th className="px-3 py-2 text-left">Leído</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(messages.data?.data ?? []).map((message) => (
                  <tr key={message.id}>
                    <td className="px-3 py-2 font-mono">{message.recipientId}</td>
                    <td className="px-3 py-2">{CHANNEL_META[message.channel as CampaignChannel]?.label ?? message.channel}</td>
                    <td className="px-3 py-2">{MESSAGE_STATUS[message.status] ?? message.status}</td>
                    <td className="px-3 py-2">{formatDateTime(message.scheduledAt)}</td>
                    <td className="px-3 py-2">{formatDateTime(message.deliveredAt)}</td>
                    <td className="px-3 py-2">{formatDateTime(message.readAt)}</td>
                  </tr>
                ))}
                {(messages.data?.data ?? []).length === 0 ? <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-500">Todavía no hay avisos: se generan cuando la campaña empieza.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}
