'use client';

import { useCallback, useMemo, useState } from 'react';
import { b2bService } from '@/services/b2bService';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { formatBob } from '@/lib/formatters';
import type { ResourceRow } from '@/services/types';

const STAGES = [
  { key: 'DISCOVERY', label: 'Descubrimiento', accent: 'bg-slate-400' },
  { key: 'QUALIFICATION', label: 'Calificación', accent: 'bg-sky-500' },
  { key: 'PROPOSAL', label: 'Propuesta', accent: 'bg-indigo-500' },
  { key: 'NEGOTIATION', label: 'Negociación', accent: 'bg-amber-500' },
  { key: 'CONTRACTING', label: 'Contratación', accent: 'bg-violet-500' },
  { key: 'CLOSED_WON', label: 'Ganada', accent: 'bg-emerald-500' },
  { key: 'CLOSED_LOST', label: 'Perdida', accent: 'bg-red-500' },
];

export function OpportunityKanbanScreen() {
  const load = useCallback(() => b2bService.listOpportunities(), []);
  const resource = useAsyncResource(load);
  const opportunities = useMemo(() => (resource.data ?? []) as ResourceRow[], [resource.data]);
  const [error, setError] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const byStage = useMemo(() => {
    const map: Record<string, ResourceRow[]> = {};
    STAGES.forEach((stage) => { map[stage.key] = []; });
    opportunities.forEach((op) => {
      const stage = String(op.stage ?? 'DISCOVERY');
      (map[stage] ??= []).push(op);
    });
    return map;
  }, [opportunities]);

  async function move(op: ResourceRow, stage: string) {
    const id = String(op.id);
    setError(null);
    const body: Record<string, unknown> = { stage };
    if (stage === 'CLOSED_LOST') {
      const reason = typeof window !== 'undefined' ? window.prompt('Motivo de pérdida (requerido):') : null;
      if (!reason) return;
      body.lossReason = reason;
    }
    setMovingId(id);
    try {
      await b2bService.moveOpportunity(id, body);
      await resource.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo mover la oportunidad.');
    } finally {
      setMovingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'CRM' }, { label: 'Pipeline' }]}
        title="Pipeline de oportunidades"
        description="Tablero kanban del embudo comercial. Cambie la etapa de cada oportunidad desde su tarjeta."
        actions={<AtlasButton variant="secondary" icon="refresh" loading={resource.status === 'loading'} onClick={resource.reload}>Actualizar</AtlasButton>}
      />

      {error ? <InlineNotice tone="danger" title="No se pudo actualizar">{error}</InlineNotice> : null}
      {resource.error && !opportunities.length ? <InlineNotice tone="warning" title="No se pudo cargar el pipeline">{resource.error}</InlineNotice> : null}

      <div className="table-scroll pb-2">
        <div className="flex min-w-max gap-3">
          {STAGES.map((stage) => {
            const items = byStage[stage.key] ?? [];
            const totalVolume = items.reduce((sum, op) => sum + Number(op.expectedMonthlyVolume ?? 0), 0);
            return (
              <section key={stage.key} className="flex w-72 shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-50">
                <header className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5">
                  <span className={`h-2 w-2 rounded-full ${stage.accent}`} />
                  <span className="text-xs font-bold text-slate-700">{stage.label}</span>
                  <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 ring-1 ring-slate-200">{items.length}</span>
                </header>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400">{formatBob(totalVolume)} / mes</div>
                <div className="flex-1 space-y-2 p-2">
                  {items.map((op) => {
                    const id = String(op.id);
                    return (
                      <article key={id} className="rounded-md border border-slate-200 bg-white p-2.5 shadow-sm">
                        <p className="truncate text-xs font-bold text-slate-800">{String(op.name ?? 'Oportunidad')}</p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                          <Icon name="payments" className="text-[13px]" />{formatBob(Number(op.expectedMonthlyVolume ?? 0))}
                          <Icon name="percent" className="ml-1 text-[13px]" />{String(op.probability ?? '0')}%
                        </div>
                        {op.expectedMonthlyRevenue ? <p className="mt-0.5 text-[10px] text-emerald-700">Ingreso est.: {formatBob(Number(op.expectedMonthlyRevenue))}</p> : null}
                        <select
                          className="mt-2 h-8 w-full rounded border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 disabled:opacity-50"
                          value={stage.key}
                          disabled={movingId === id}
                          onChange={(e) => { if (e.target.value !== stage.key) void move(op, e.target.value); }}
                        >
                          {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                        </select>
                      </article>
                    );
                  })}
                  {!items.length ? <p className="px-1 py-4 text-center text-[10px] text-slate-400">Sin oportunidades</p> : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
