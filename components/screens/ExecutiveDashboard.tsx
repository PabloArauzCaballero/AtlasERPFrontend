'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { accountingService } from '@/services/accountingService';
import { adsService } from '@/services/adsService';
import { auditService } from '@/services/auditService';
import { b2bService } from '@/services/b2bService';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import type { PaginatedResult, ResourceRow } from '@/services/types';

interface DashboardData {
  accounts: PaginatedResult<ResourceRow> | null;
  partners: PaginatedResult<ResourceRow> | null;
  glAccounts: PaginatedResult<ResourceRow> | null;
  audit: PaginatedResult<ResourceRow> | null;
  ads: ResourceRow | null;
  failures: string[];
}

async function capture<T>(label: string, request: Promise<T>): Promise<{ label: string; value: T | null }> {
  try { return { label, value: await request }; } catch { return { label, value: null }; }
}
function totalOf(value: PaginatedResult<ResourceRow> | null): number { return typeof value?.total === 'number' ? value.total : value?.items?.length ?? value?.rows?.length ?? 0; }
function numeric(row: ResourceRow | null, key: string): number { const value = row?.[key]; return typeof value === 'number' ? value : Number(value ?? 0) || 0; }
function microsToBob(value: number): string { return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', maximumFractionDigits: 0 }).format(value / 1_000_000); }

export function ExecutiveDashboard() {
  const load = useCallback(async (): Promise<DashboardData> => {
    const [accounts, partners, glAccounts, audit, ads] = await Promise.all([
      capture('CRM B2B', b2bService.listAccounts({ page: 1, limit: 1 })),
      capture('Business Partners', accountingService.listBusinessPartners({ page: 1, pageSize: 1 })),
      capture('Cuentas GL', accountingService.listGlAccounts({ page: 1, pageSize: 1 })),
      capture('Auditoría', auditService.listBusinessActions({ page: 1, pageSize: 1 })),
      capture('Ads', adsService.getDashboard({})),
    ]);
    const results = [accounts, partners, glAccounts, audit, ads];
    return { accounts: accounts.value, partners: partners.value, glAccounts: glAccounts.value, audit: audit.value, ads: ads.value, failures: results.filter((item) => item.value === null).map((item) => item.label) };
  }, []);
  const resource = useAsyncResource(load);
  const data = resource.data;
  const counts = [
    { label: 'Cuentas B2B', value: totalOf(data?.accounts ?? null), color: 'bg-teal-600' },
    { label: 'Business Partners', value: totalOf(data?.partners ?? null), color: 'bg-blue-600' },
    { label: 'Cuentas GL', value: totalOf(data?.glAccounts ?? null), color: 'bg-indigo-600' },
    { label: 'Business Actions', value: totalOf(data?.audit ?? null), color: 'bg-amber-500' },
  ];
  const maxCount = Math.max(1, ...counts.map((item) => item.value));
  const alerts = Array.isArray(data?.ads?.alerts) ? data.ads.alerts : [];

  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Panel de control institucional" title="Resumen ejecutivo" description="Visión consolidada de la operación B2B, financiera, publicitaria y de control interno de ATLAS." actions={<><AtlasButton variant="secondary" icon="refresh" onClick={resource.reload}>Actualizar</AtlasButton><AtlasButton variant="secondary" icon="download">Exportar</AtlasButton></>} />
      {resource.error ? <InlineNotice tone="danger" title="No fue posible cargar el tablero">{resource.error}</InlineNotice> : null}
      {data?.failures.length ? <InlineNotice tone="warning" title="Carga parcial">Sin respuesta de: {data.failures.join(', ')}. Los demás módulos permanecen visibles.</InlineNotice> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Revenue Ads" value={data?.ads ? microsToBob(numeric(data.ads, 'revenueMicros')) : '—'} detail="Facturación reportada por Ads" icon="payments" />
        <MetricCard label="Cuentas B2B" value={data?.accounts ? totalOf(data.accounts) : '—'} detail="Directorio comercial" icon="business_center" tone="teal" />
        <MetricCard label="Campañas activas" value={data?.ads ? numeric(data.ads, 'activeCampaigns') : '—'} detail="Delivery publicitario" icon="campaign" tone="purple" />
        <MetricCard label="Acciones auditadas" value={data?.audit ? totalOf(data.audit) : '—'} detail="Business Action Log" icon="history_edu" tone="amber" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_360px]">
        <Panel title="Huella operativa" description="Volumen real disponible por módulo; no representa una serie histórica." icon="bar_chart" action={resource.status === 'loading' ? <StatusPill tone="warning">ACTUALIZANDO</StatusPill> : <StatusPill tone="success">SINCRONIZADO</StatusPill>}>
          <div className="space-y-5 py-3">{counts.map((item) => <div key={item.label}><div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold text-slate-700">{item.label}</span><span className="font-mono text-slate-500">{item.value}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full transition-all duration-500 ${item.color}`} style={{ width: `${Math.max(item.value ? 4 : 0, item.value / maxCount * 100)}%` }} /></div></div>)}</div>
        </Panel>
        <Panel title="Control Snapshot" description="Excepciones activas reportadas por Ads." icon="notifications_active"><div className="space-y-3"><Snapshot label="Moderación pendiente" value={data?.ads ? numeric(data.ads, 'pendingReviews') : '—'} tone="warning" /><Snapshot label="Facturas vencidas" value={data?.ads ? numeric(data.ads, 'overdueInvoices') : '—'} tone="danger" /><Snapshot label="Eventos inválidos" value={data?.ads ? `${(numeric(data.ads, 'invalidEventRate') * 100).toFixed(2)}%` : '—'} tone="neutral" /></div>{alerts.length ? <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">{alerts.length} alerta(s) calculada(s) por el backend Ads.</div> : null}</Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-3"><ModuleCard title="CRM B2B" icon="business_center" href="/operaciones/crm/cuentas" detail={`${totalOf(data?.accounts ?? null)} cuentas disponibles`} links={[['Pipeline','/operaciones/crm/oportunidades'],['Propuestas','/operaciones/crm/propuestas'],['Onboarding','/operaciones/crm/onboarding']]} /><ModuleCard title="Núcleo financiero" icon="account_balance_wallet" href="/operaciones/contabilidad/cuentas-gl" detail={`${totalOf(data?.glAccounts ?? null)} cuentas GL disponibles`} links={[['Business Partners','/operaciones/contabilidad/business-partners'],['Documentos','/operaciones/contabilidad/documentos'],['Cierres','/operaciones/contabilidad/cierres']]} /><ModuleCard title="Operación publicitaria" icon="campaign" href="/operaciones/ads/dashboard" detail={`${numeric(data?.ads ?? null, 'activeCampaigns')} campañas activas`} links={[['Anunciantes','/operaciones/ads/anunciantes'],['Moderación','/operaciones/ads/moderacion'],['Delivery','/operaciones/ads/delivery-monitor']]} /></div>
      <InlineNotice tone="info">El tablero solo presenta métricas disponibles en endpoints reales. Indicadores financieros no expuestos por backend quedan fuera, en lugar de simular valores.</InlineNotice>
    </div>
  );
}
function Snapshot({ label, value, tone }: { label: string; value: string | number; tone: 'warning' | 'danger' | 'neutral' }) { const className = tone === 'danger' ? 'bg-red-50 text-red-700' : tone === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-700'; return <div className={`flex items-center justify-between rounded-md px-3 py-3 text-xs ${className}`}><span className="font-semibold">{label}</span><b className="text-base">{value}</b></div>; }
function ModuleCard({ title, icon, href, detail, links }: { title: string; icon: string; href: string; detail: string; links: string[][] }) { return <Panel title={title} icon={icon} action={<Link href={href} className="text-xs font-bold text-[#006a61] hover:underline">Abrir →</Link>}><p className="rounded-md bg-slate-50 p-3 text-xs font-semibold text-slate-700">{detail}</p><div className="mt-3 divide-y divide-slate-100">{links.map(([label, route]) => route && label ? <Link key={route} href={route} className="flex items-center justify-between py-2 text-xs text-slate-600 hover:text-[#006a61]"><span>{label}</span><Icon name="chevron_right" className="text-[17px]" /></Link> : null)}</div></Panel>; }
