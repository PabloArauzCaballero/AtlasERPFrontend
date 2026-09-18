'use client';

import { useCallback, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Resumen } from '@/components/atlas/Resumen';
import { StatusPill } from '@/components/atlas/StatusPill';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { notificationCampaignsService, type Campaign, type CampaignChannel, type CampaignStatus } from '@/services/notificationCampaignsService';
import { CampaignDetailModal } from './CampaignDetailModal';
import { CampaignWizard } from './CampaignWizard';
import { CHANNEL_META, STATUS_META, formatCount, formatDateTime } from './campaignCatalog';
import { SegmentsPanel } from './SegmentsPanel';

/**
 * Notificaciones masivas: campañas a clientes de la app con fecha, vigencia, segmento y canales.
 *
 * Sustituye al «Centro de notificaciones» que decía «BACKEND PENDIENTE» y no hacía nada, y a la
 * costumbre de usar el correo de campaña de Ads —que sólo sabe mandar correos a direcciones
 * tecleadas— para hablarle a los clientes. Aquí se elige a quién por sus datos, se programa y se ve
 * cuántos lo recibieron y leyeron.
 */

const STATUS_FILTER = [
  { value: '', label: 'Todos los estados' },
  ...(Object.keys(STATUS_META) as CampaignStatus[]).map((status) => ({ value: status, label: STATUS_META[status].label })),
];

export function NotificationCampaignsScreen() {
  const [tab, setTab] = useState('campanas');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [wizard, setWizard] = useState<Campaign | 'new' | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 400);

  const list = useAsyncResource(
    useCallback(() => notificationCampaignsService.list({ page, limit: 20, status, search: debouncedSearch }), [page, status, debouncedSearch]),
  );
  const counts = useAsyncResource(
    useCallback(async () => {
      const statuses = ['scheduled', 'running', 'draft', 'completed'] as const;
      const results = await Promise.all(statuses.map((value) => notificationCampaignsService.list({ status: value, limit: 1 })));
      const total = (index: number) => results[index]?.pagination?.total ?? 0;
      return { scheduled: total(0), running: total(1), draft: total(2), completed: total(3) };
    }, []),
  );
  const refresh = () => {
    void list.reload();
    void counts.reload();
  };
  const rows = list.data?.data ?? [];
  const pagination = list.data?.pagination;

  const campaignsTab = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <FormField tooltip="Filtra las campañas por estado." kind="select" label="Estado" name="status" hint="Filtra la tabla." className="w-52" value={status} options={STATUS_FILTER} onChange={(event) => { setStatus(event.target.value); setPage(1); }} />
        <FormField tooltip="Texto que se busca en las columnas visibles." label="Buscar" name="search" hint="Por nombre o título." className="w-72" placeholder="Recordatorio de cuota…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
      </div>
      {list.error ? <InlineNotice tone="danger" title="No se pudieron cargar las campañas">{list.error}</InlineNotice> : null}
      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="w-full min-w-[860px] text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr><th className="px-3 py-2 text-left">Campaña</th><th className="px-3 py-2 text-left">Estado</th><th className="px-3 py-2 text-left">Canales</th><th className="px-3 py-2 text-right">Audiencia</th><th className="px-3 py-2 text-left">Inicio</th><th className="px-3 py-2 text-left">Fin</th><th className="px-3 py-2 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((campaign) => (
              <tr key={campaign.id} className="hover:bg-slate-50/70">
                <td className="px-3 py-2"><button type="button" className="text-left" onClick={() => setOpenId(campaign.id)}><p className="font-bold text-slate-900 hover:underline">{campaign.name}</p><p className="truncate text-slate-500">{campaign.title}</p></button></td>
                <td className="px-3 py-2"><StatusPill tone={STATUS_META[campaign.status].tone}>{STATUS_META[campaign.status].label}</StatusPill></td>
                <td className="px-3 py-2"><div className="flex gap-1">{campaign.channels.map((channel) => <span key={channel} title={CHANNEL_META[channel as CampaignChannel]?.label}><Icon name={CHANNEL_META[channel as CampaignChannel]?.icon ?? 'send'} className="text-[18px] text-slate-600" /></span>)}</div></td>
                <td className="px-3 py-2 text-right tabular-nums">{campaign.targetedCount ? formatCount(campaign.targetedCount) : campaign.audienceEstimate ? `≈ ${formatCount(campaign.audienceEstimate.total)}` : '—'}</td>
                <td className="px-3 py-2">{campaign.startsAt ? formatDateTime(campaign.startsAt) : campaign.status === 'draft' ? 'Al programar' : '—'}</td>
                <td className="px-3 py-2">{campaign.endsAt ? formatDateTime(campaign.endsAt) : 'Sin fin'}</td>
                <td className="px-3 py-2"><div className="flex justify-end gap-1">
                  {campaign.status === 'draft' || campaign.status === 'scheduled' ? <AtlasButton variant="ghost" icon="edit" onClick={() => setWizard(campaign)}>Editar</AtlasButton> : null}
                  <AtlasButton variant="secondary" icon="insights" onClick={() => setOpenId(campaign.id)}>Ver</AtlasButton>
                </div></td>
              </tr>
            ))}
            {rows.length === 0 && list.status !== 'loading' ? (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">{status || debouncedSearch ? 'Ninguna campaña coincide con el filtro.' : 'Todavía no hay campañas. Crea la primera con «Nueva campaña».'}</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {pagination && pagination.totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-xs text-slate-600">
          <span>Página {pagination.page} de {pagination.totalPages} · {formatCount(pagination.total)} campañas</span>
          <AtlasButton variant="secondary" icon="chevron_left" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</AtlasButton>
          <AtlasButton variant="secondary" icon="chevron_right" disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}>Siguiente</AtlasButton>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Control' }, { label: 'Notificaciones masivas' }]}
        title="Campañas de notificación"
        description="Avisos a clientes de la app por bandeja, push y correo: con segmento, fecha de inicio, fin y cadencia, y con el resultado por canal."
        actions={<AtlasButton icon="add" onClick={() => setWizard('new')}>Nueva campaña</AtlasButton>}
      />
      <Resumen
        datos={[
          { label: 'En curso', value: counts.data ? formatCount(counts.data.running) : '—' },
          { label: 'Programadas', value: counts.data ? formatCount(counts.data.scheduled) : '—' },
          { label: 'Borradores', value: counts.data ? formatCount(counts.data.draft) : '—' },
          { label: 'Terminadas', value: counts.data ? formatCount(counts.data.completed) : '—' },
        ]}
      />
      <InlineNotice tone="info" title="Cómo llega">
        La bandeja de la app llega a toda la audiencia; el push, sólo a quien tiene la app con avisos activados; el correo, sólo a quien tiene uno
        verificado. Las campañas comerciales descuentan a quien no aceptó recibir promociones. Los clientes bloqueados nunca reciben.
      </InlineNotice>
      <TabbedPanels
        activeId={tab}
        onChange={setTab}
        tabs={[
          { id: 'campanas', label: 'Campañas', icon: 'campaign', badge: pagination?.total, content: campaignsTab },
          { id: 'segmentos', label: 'Segmentos de audiencia', icon: 'groups', content: <SegmentsPanel /> },
        ]}
      />
      {wizard ? (
        <CampaignWizard
          campaign={wizard === 'new' ? null : wizard}
          onClose={() => setWizard(null)}
          onSaved={(saved) => {
            setWizard(null);
            refresh();
            setOpenId(saved.id);
          }}
        />
      ) : null}
      {openId ? (
        <CampaignDetailModal
          key={openId}
          campaignId={openId}
          onClose={() => setOpenId(null)}
          onChanged={refresh}
          onEdit={(campaign) => {
            setOpenId(null);
            setWizard(campaign);
          }}
        />
      ) : null}
    </div>
  );
}
