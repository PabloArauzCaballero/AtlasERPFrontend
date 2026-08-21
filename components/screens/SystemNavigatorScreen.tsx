import Link from 'next/link';
import { Icon } from '@/components/atlas/Icon';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { atlasViewLinks } from '@/lib/viewRegistry';

const groups = [
  { name: 'CRM B2B', icon: 'business_center', match: (phase: string) => phase.includes('CRM') },
  { name: 'Accounting', icon: 'account_balance_wallet', match: (phase: string) => phase.includes('Contabilidad') },
  { name: 'Advertising', icon: 'campaign', match: (phase: string) => phase.includes('Ads') },
  { name: 'Portal comercio', icon: 'storefront', match: (_phase: string, area: string) => area === 'Portal comercio' },
  { name: 'Operations & Control', icon: 'verified_user', match: (phase: string) => phase.includes('Brecha') || phase.includes('Auditoría') },
];

export function SystemNavigatorScreen() {
  return <div className="space-y-5"><WorkspaceHeader breadcrumbs={[{ label: 'Administración' }, { label: 'Navegación' }]} title="Mapa del sistema" description="Mapa funcional del ERP, accesos por módulo y estado de integración con backend." />
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_360px]"><div className="grid gap-4 md:grid-cols-2">{groups.map((group) => { const entries = atlasViewLinks.filter((item) => group.match(item.phase, item.area)); return <Panel key={group.name} title={group.name} icon={group.icon}><div className="space-y-1">{entries.map((item) => <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-slate-50"><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{item.title}</p><p className="mt-0.5 truncate text-[10px] text-slate-500">{item.backend}</p></div><StatusPill tone={item.status === 'integrada' ? 'success' : item.status === 'solo-accion' ? 'warning' : 'danger'} dot={false}>{item.status}</StatusPill><Icon name="chevron_right" className="text-[17px] text-slate-400" /></Link>)}</div></Panel>; })}</div><aside className="space-y-4"><Panel title="Cobertura de integración" icon="donut_large"><Progress label="Lectura integrada" count={atlasViewLinks.filter((item) => item.status === 'integrada').length} total={atlasViewLinks.length} color="bg-emerald-600" /><Progress label="Acción backend" count={atlasViewLinks.filter((item) => item.status === 'solo-accion').length} total={atlasViewLinks.length} color="bg-amber-500" /><Progress label="Brecha backend" count={atlasViewLinks.filter((item) => item.status === 'brecha-backend').length} total={atlasViewLinks.length} color="bg-red-500" /></Panel><Panel title="Legend" icon="info"><div className="space-y-3 text-xs"><Legend tone="success" label="Integrada" text="Consulta datos reales y conserva paginación del servidor." /><Legend tone="warning" label="Solo acción" text="El backend permite la operación, pero no existe GET para reconstruir historial." /><Legend tone="danger" label="Brecha" text="La pantalla se reconstruyó visualmente sin simular una capacidad inexistente." /></div></Panel></aside></div>
  </div>;
}
function Progress({ label, count, total, color }: { label: string; count: number; total: number; color: string }) { const percent = total ? Math.round(count / total * 100) : 0; return <div className="mb-4 last:mb-0"><div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold">{label}</span><span>{count}/{total}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} /></div></div>; }
function Legend({ tone, label, text }: { tone: 'success' | 'warning' | 'danger'; label: string; text: string }) { return <div><StatusPill tone={tone}>{label}</StatusPill><p className="mt-1.5 leading-5 text-slate-500">{text}</p></div>; }
