'use client';

import { useCallback, useMemo, useState } from 'react';
import { b2bService } from '@/services/b2bService';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { formatBob } from '@/lib/formatters';
import type { JsonObject, ResourceRow } from '@/services/types';

const stages = ['DISCOVERY', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CONTRACTING', 'CLOSED_WON'] as const;
const stageLabels: Record<(typeof stages)[number], string> = { DISCOVERY: 'Discovery', QUALIFICATION: 'Qualification', PROPOSAL: 'Proposal', NEGOTIATION: 'Negotiation', CONTRACTING: 'Contracting', CLOSED_WON: 'Closed Won' };

export function OpportunityPipelineScreen() {
  const [cards, setCards] = useState<ResourceRow[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const createMutation = useAtlasMutation(useCallback((payload: JsonObject) => b2bService.createOpportunity(payload), []));
  const moveMutation = useAtlasMutation(useCallback(({ id, body }: { id: string; body: JsonObject }) => b2bService.moveOpportunity(id, body), []));
  const totalVolume = useMemo(() => cards.reduce((sum, card) => sum + Number(card.expectedMonthlyVolume ?? 0), 0), [cards]);

  async function createOpportunity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: JsonObject = {
      accountId: String(form.get('accountId') ?? ''), ownerUserId: String(form.get('ownerUserId') ?? ''),
      name: String(form.get('name') ?? ''), opportunityType: String(form.get('opportunityType') ?? 'NEW_MERCHANT'),
      expectedMonthlyVolume: Number(form.get('expectedMonthlyVolume') ?? 0), expectedMdrRate: Number(form.get('expectedMdrRate') ?? 0),
      probability: Number(form.get('probability') ?? 0), expectedCloseDate: String(form.get('expectedCloseDate') ?? '') || undefined,
    };
    try { const created = await createMutation.execute(payload); setCards((current) => [created, ...current]); setShowCreate(false); } catch { /* controlled */ }
  }

  async function moveCard(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = String(form.get('opportunityId') ?? '');
    const stage = String(form.get('stage') ?? 'DISCOVERY');
    const lossReason = String(form.get('lossReason') ?? '').trim();
    try {
      const updated = await moveMutation.execute({ id, body: { stage, ...(lossReason ? { lossReason } : {}) } });
      setCards((current) => current.map((card) => String(card.id) === id ? { ...card, ...updated } : card));
    } catch { /* controlled */ }
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader title="Opportunity Pipeline" description="Tablero comercial por etapa, probabilidad, volumen mensual y fecha estimada de cierre." breadcrumbs={[{ label: 'CRM' }, { label: 'Pipeline' }]} actions={<><AtlasButton variant="secondary" icon="file_download">Exportar</AtlasButton><AtlasButton icon="add" onClick={() => setShowCreate((value) => !value)}>Crear oportunidad</AtlasButton></>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Oportunidades en sesión" value={cards.length} detail="Creadas o actualizadas en esta sesión" icon="view_kanban" /><MetricCard label="Volumen proyectado" value={formatBob(totalVolume)} detail="Suma de oportunidades visibles" icon="payments" tone="teal" /><MetricCard label="En propuesta" value={cards.filter((card) => card.stage === 'PROPOSAL').length} detail="Requieren seguimiento" icon="request_quote" tone="amber" /><MetricCard label="Ganadas" value={cards.filter((card) => card.stage === 'CLOSED_WON').length} detail="Conversión de la sesión" icon="emoji_events" tone="purple" /></div>
      <InlineNotice tone="info" title="Contrato backend actual">El backend permite crear y mover oportunidades, pero todavía no expone un GET del pipeline. El tablero conserva únicamente las operaciones realizadas durante esta sesión; no inventa registros históricos.</InlineNotice>

      {showCreate ? <Panel title="Nueva oportunidad" icon="add_business" action={<button className="text-slate-500 hover:text-slate-900" onClick={() => setShowCreate(false)}><Icon name="close" /></button>}><form onSubmit={createOpportunity} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><FormField label="UUID cuenta" name="accountId" required /><FormField label="UUID responsable" name="ownerUserId" required /><FormField label="Nombre" name="name" required className="md:col-span-2" /><FormField kind="select" label="Tipo" name="opportunityType" options={[{ label: 'Nuevo comercio', value: 'NEW_MERCHANT' }, { label: 'Expansión', value: 'EXPANSION' }, { label: 'Renovación', value: 'RENEWAL' }]} /><FormField label="Volumen mensual" name="expectedMonthlyVolume" type="number" defaultValue="0" /><FormField label="MDR esperado (%)" name="expectedMdrRate" type="number" defaultValue="0" /><FormField label="Probabilidad (%)" name="probability" type="number" defaultValue="0" /><FormField label="Cierre esperado" name="expectedCloseDate" type="date" /><div className="flex items-end md:col-span-2 xl:col-span-3"><AtlasButton type="submit" icon="save" loading={createMutation.isLoading}>Crear oportunidad</AtlasButton></div></form>{createMutation.error ? <div className="mt-3"><InlineNotice tone="danger">{createMutation.error}</InlineNotice></div> : null}</Panel> : null}

      <div data-tutorial-id="kanban-board" className="table-scroll pb-2">
        <div className="grid min-w-[1400px] grid-cols-6 gap-3">
          {stages.map((stage) => {
            const stageCards = cards.filter((card) => String(card.stage ?? 'DISCOVERY') === stage);
            return <section key={stage} className="rounded-lg border border-slate-200 bg-slate-100/70 p-2"><header className="mb-2 flex items-center justify-between px-1 py-1"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#006a61]" /><h2 className="text-xs font-bold text-slate-800">{stageLabels[stage]}</h2></div><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">{stageCards.length}</span></header><div className="space-y-2">{stageCards.map((card) => <article key={String(card.id)} className="rounded-md border border-slate-200 bg-white p-3 shadow-sm"><div className="flex items-start justify-between gap-2"><p className="text-xs font-bold text-slate-900">{String(card.name ?? 'Oportunidad')}</p><button className="text-slate-500"><Icon name="more_horiz" className="text-[18px]" /></button></div><p className="mt-1 font-mono text-[9px] text-slate-500">{String(card.id ?? '').slice(0, 18)}</p><div className="mt-3 flex items-center justify-between"><span className="text-[11px] font-bold text-slate-700">{formatBob(Number(card.expectedMonthlyVolume ?? 0))}</span><StatusPill tone="info" dot={false}>{String(card.probability ?? 0)}%</StatusPill></div></article>)}{!stageCards.length ? <div className="rounded-md border border-dashed border-slate-300 bg-white/60 px-3 py-8 text-center text-[11px] text-slate-500">Sin oportunidades visibles</div> : null}</div></section>;
          })}
        </div>
      </div>

      <Panel title="Mover oportunidad" description="Actualice una oportunidad existente por UUID" icon="swap_horiz"><form onSubmit={moveCard} className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_240px_minmax(260px,1fr)_auto]"><FormField label="UUID oportunidad" name="opportunityId" required /><FormField kind="select" label="Nueva etapa" name="stage" options={[...stages.map((stage) => ({ label: stageLabels[stage], value: stage })), { label: 'Closed Lost', value: 'CLOSED_LOST' }]} /><FormField label="Motivo de pérdida" name="lossReason" placeholder="Obligatorio para Closed Lost" /><div className="flex items-end"><AtlasButton type="submit" icon="sync_alt" loading={moveMutation.isLoading}>Mover</AtlasButton></div></form>{moveMutation.error ? <div className="mt-3"><InlineNotice tone="danger">{moveMutation.error}</InlineNotice></div> : null}</Panel>
    </div>
  );
}
