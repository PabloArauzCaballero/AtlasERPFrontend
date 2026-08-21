'use client';

import { useCallback } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { ScreenState } from '@/components/ui/ScreenState';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { adsService } from '@/services/adsService';
import type { ResourceRow } from '@/services/types';

function numeric(row: ResourceRow | null, key: string): number { const value = row?.[key]; return typeof value === 'number' ? value : Number(value ?? 0) || 0; }
function microsToBob(value: number): string { return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', maximumFractionDigits: 2 }).format(value / 1_000_000); }

export function AdsDashboardScreen() {
  const loader = useCallback(() => adsService.getDashboard({}), []);
  const { data, error, reload, status } = useAsyncResource(loader);
  const alerts = Array.isArray(data?.alerts) ? data.alerts as unknown[] : [];
  const invalidRate = numeric(data, 'invalidEventRate');

  return (
    <div className="space-y-5">
      <WorkspaceHeader breadcrumbs={[{ label: 'Ads' }, { label: 'Dashboard' }]} title="Gestión de campañas" description="Monitoree facturación, delivery, moderación y señales de fraude con datos del backend Ads." actions={<><AtlasButton variant="secondary" icon="calendar_today">Últimos 30 días</AtlasButton><AtlasButton variant="secondary" icon="refresh" onClick={reload}>Actualizar</AtlasButton></>} />
      <ScreenState error={error} onRetry={reload} status={status} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Revenue" value={microsToBob(numeric(data, 'revenueMicros'))} detail="Facturas emitidas y cobradas" icon="payments" />
        <MetricCard label="Billable Spend" value={microsToBob(numeric(data, 'billableSpendMicros'))} detail="Cargos en spend ledger" icon="account_balance_wallet" tone="teal" />
        <MetricCard label="Active Campaigns" value={numeric(data, 'activeCampaigns')} detail="Campañas en delivery" icon="campaign" tone="purple" />
        <MetricCard label="Invalid Event Rate" value={`${(invalidRate * 100).toFixed(2)}%`} detail="Fraude o evento no facturable" icon="security" tone={invalidRate > .02 ? 'red' : 'amber'} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_360px]">
        <Panel title="Salud de facturación y entrega" description="Indicadores de control operativo obtenidos de GET /admin/ads/dashboard." icon="monitoring">
          <div className="grid gap-4 md:grid-cols-3"><Health label="Revisiones pendientes" value={numeric(data, 'pendingReviews')} icon="fact_check" tone="amber" /><Health label="Facturas vencidas" value={numeric(data, 'overdueInvoices')} icon="receipt_long" tone="red" /><Health label="Delivery válido" value={`${Math.max(0, (1 - invalidRate) * 100).toFixed(2)}%`} icon="verified" tone="teal" /></div>
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between"><div><p className="text-xs font-bold">Calidad de eventos facturables</p><p className="mt-1 text-[11px] text-slate-500">Relación calculada a partir del indicador de eventos inválidos.</p></div><StatusPill tone={invalidRate > .02 ? 'danger' : 'success'}>{invalidRate > .02 ? 'REQUIERE REVISIÓN' : 'DENTRO DE CONTROL'}</StatusPill></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${Math.max(0, Math.min(100, (1 - invalidRate) * 100))}%` }} /></div></div>
        </Panel>
        <Panel title="Alertas operativas" description="Alertas calculadas por el servicio Ads." icon="notifications_active"><div className="space-y-3">{alerts.length ? alerts.map((alert, index) => { const item = alert as { type?: string; severity?: string; message?: string }; return <div key={`${item.type ?? 'alert'}-${index}`} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-slate-700"><div className="flex gap-2"><Icon name="warning" className="text-[18px] text-amber-600" /><div><p className="font-bold">{item.type?.replaceAll('_', ' ') ?? 'Alerta operativa'}</p><p className="mt-1 leading-5">{item.message ?? 'El backend reportó una condición que requiere revisión.'}</p></div></div></div>; }) : <div className="grid min-h-40 place-items-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-center"><div><Icon name="check_circle" className="text-[30px] text-emerald-500" /><p className="mt-2 text-xs font-bold">Sin alertas activas</p><p className="mt-1 text-[11px] text-slate-500">El backend no reportó excepciones.</p></div></div>}</div></Panel>
      </div>
      <InlineNotice tone="info">Este dashboard no inventa métricas: todos los valores visibles provienen del endpoint administrativo Ads.</InlineNotice>
    </div>
  );
}
function Health({ label, value, icon, tone }: { label: string; value: string | number; icon: string; tone: 'amber' | 'red' | 'teal' }) { const color = tone === 'red' ? 'bg-red-50 text-red-700' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-teal-50 text-teal-700'; return <div className={`rounded-lg p-4 ${color}`}><div className="flex items-center justify-between"><Icon name={icon} className="text-[22px]" /><span className="text-2xl font-extrabold">{value}</span></div><p className="mt-3 text-[11px] font-bold uppercase tracking-wide">{label}</p></div>; }
