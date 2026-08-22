'use client';

import { useCallback, useMemo, useState } from 'react';
import { adsService } from '@/services/adsService';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import type { JsonObject, ResourceRow } from '@/services/types';

function rowsFrom(data: { items?: ResourceRow[]; rows?: ResourceRow[] } | null): ResourceRow[] { return data?.items ?? data?.rows ?? []; }
export function ModerationQueueScreen() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [selected, setSelected] = useState<ResourceRow | null>(null);
  const loader = useCallback(() => adsService.listModerationQueue({ page, limit: 8, status }), [page, status]);
  const resource = useAsyncResource(loader);
  const mutation = useAtlasMutation(useCallback(({ id, body }: { id: string; body: JsonObject }) => adsService.decideModeration(id, body), []));
  const rows = useMemo(() => rowsFrom(resource.data), [resource.data]);
  const total = typeof resource.data?.total === 'number' ? resource.data.total : rows.length;

  async function decide(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected?.id) return; const form = new FormData(event.currentTarget);
    const body: JsonObject = { reviewStatus: String(form.get('reviewStatus') ?? ''), reasonCode: String(form.get('reasonCode') ?? ''), notes: String(form.get('notes') ?? '') || undefined, requiresAdvertiserChanges: form.get('requiresAdvertiserChanges') === 'on' };
    try { await mutation.execute({ id: String(selected.id), body }); setSelected(null); await resource.reload(); } catch { /* shown */ }
  }

  return <div className="space-y-5"><WorkspaceHeader breadcrumbs={[{ label: 'Ads' }, { label: 'Moderación' }]} title="Cola de moderación" description="Revise creatividades, aplique políticas y registre decisiones trazables." actions={<AtlasButton variant="secondary" icon="refresh" onClick={resource.reload}>Actualizar</AtlasButton>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Pendientes" value={total} detail="Cola filtrada" icon="fact_check" /><MetricCard label="Alta prioridad" value={rows.filter((row) => ['HIGH','CRITICAL'].includes(String(row.severity))).length} detail="Página actual" icon="priority_high" tone="red" /><MetricCard label="Seleccionada" value={selected ? 1 : 0} detail="Lista para decisión" icon="ads_click" tone="teal" /><MetricCard label="Página" value={page} detail="8 revisiones por página" icon="menu_book" tone="amber" /></div>
    {resource.error ? <InlineNotice tone="danger">{resource.error}</InlineNotice> : null}{mutation.error ? <InlineNotice tone="danger">{mutation.error}</InlineNotice> : null}
    <div className="flex flex-wrap gap-2">{['PENDING_REVIEW','APPROVED','REJECTED','CHANGES_REQUESTED','ESCALATED'].map((item) => <button key={item} type="button" className={`rounded-full border px-3 py-1.5 text-[11px] font-bold ${status === item ? 'border-[#006a61] bg-[#006a61] text-white' : 'border-slate-300 bg-white text-slate-600'}`} onClick={() => { setPage(1); setStatus(item); }}>{item.replaceAll('_',' ')}</button>)}</div>
    <div className="grid items-start gap-4 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1.4fr)_390px]"><Panel title="Creatividades por revisar" description="Seleccione una pieza para registrar la decisión." icon="collections"><div className="grid gap-3 md:grid-cols-2">{rows.map((row) => <button type="button" key={String(row.id)} onClick={() => setSelected(row)} className={`overflow-hidden rounded-lg border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${selected?.id === row.id ? 'border-[#006a61] ring-2 ring-primary/15' : 'border-slate-200'}`}><div className="grid h-32 place-items-center bg-gradient-to-br from-slate-100 to-slate-200"><Icon name={String(row.creativeType).includes('VIDEO') ? 'smart_display' : 'image'} className="text-[38px] text-slate-400" /></div><div className="p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold">{String(row.creativeName ?? row.name ?? 'Creatividad')}</p><p className="mt-1 text-[10px] text-slate-500">{String(row.advertiserName ?? row.advertiserId ?? 'Anunciante')}</p></div><StatusPill tone={String(row.severity).includes('HIGH') ? 'danger' : 'warning'}>{String(row.severity ?? status)}</StatusPill></div><p className="mt-3 line-clamp-2 text-[11px] leading-4 text-slate-500">{String(row.policySummary ?? row.notes ?? 'Pendiente de evaluación conforme a políticas Ads.')}</p></div></button>)}{resource.status === 'loading' && !rows.length ? Array.from({ length: 4 }, (_, index) => <div key={index} className="h-56 animate-pulse rounded-lg bg-slate-100" />) : null}{resource.status !== 'loading' && !rows.length ? <div className="md:col-span-2 grid min-h-64 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-center"><div><Icon name="task_alt" className="text-[36px] text-emerald-500" /><p className="mt-2 text-xs font-bold">Sin revisiones en este estado</p></div></div> : null}</div><div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-[11px] text-slate-500">{total} registros</span><div className="flex gap-2"><AtlasButton variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</AtlasButton><AtlasButton variant="secondary" disabled={page * 8 >= total} onClick={() => setPage((value) => value + 1)}>Siguiente</AtlasButton></div></div></Panel>
      <Panel title="Review Decision" description={selected ? `Revisión ${String(selected.id).slice(0, 12)}…` : 'Seleccione una creatividad'} icon="gavel"><form onSubmit={decide} className="space-y-3"><FormField kind="select" label="Decisión" name="reviewStatus" disabled={!selected} options={[{ label: 'Aprobar', value: 'APPROVED' }, { label: 'Rechazar', value: 'REJECTED' }, { label: 'Solicitar cambios', value: 'CHANGES_REQUESTED' }, { label: 'Escalar', value: 'ESCALATED' }]} /><FormField label="Código de motivo" name="reasonCode" required disabled={!selected} placeholder="POLICY_OK / CLAIM_UNVERIFIED" /><FormField kind="textarea" label="Notas del moderador" name="notes" disabled={!selected} /><label className="flex items-center gap-2 rounded border border-slate-200 bg-slate-50 p-3 text-xs"><input type="checkbox" name="requiresAdvertiserChanges" disabled={!selected} /><span>Requiere cambios del anunciante</span></label><AtlasButton className="w-full" type="submit" icon="fact_check" disabled={!selected} loading={mutation.isLoading}>Guardar decisión</AtlasButton></form></Panel></div>
  </div>;
}
