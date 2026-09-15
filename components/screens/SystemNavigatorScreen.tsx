import Link from 'next/link';
import { Icon } from '@/components/atlas/Icon';
import { Panel } from '@/components/atlas/Panel';
import { ScreenExplainer } from '@/components/atlas/ScreenExplainer';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { atlasViewLinks, viewStatusInfo, viewsByModule, type ViewStatus } from '@/lib/viewRegistry';

const STATUS_ORDER: readonly ViewStatus[] = ['integrada', 'solo-accion', 'brecha-backend'];
const STATUS_BAR: Readonly<Record<ViewStatus, string>> = { integrada: 'bg-emerald-600', 'solo-accion': 'bg-amber-500', 'brecha-backend': 'bg-red-500' };

export function SystemNavigatorScreen() {
  return <div className="space-y-5"><WorkspaceHeader breadcrumbs={[{ label: 'Control' }, { label: 'Mapa del sistema' }]} title="Mapa del sistema" description="Todas las pantallas del ERP ordenadas por módulo, y cuáles ya funcionan por completo." />
    <ScreenExplainer
      lead="Es el índice completo del ERP. No muestra datos de la empresa: sirve para saber qué pantallas existen, en qué módulo del menú están y si ya funcionan del todo."
      points={[
        { title: 'Cada tarjeta es un módulo del menú', text: 'Dentro está la lista de sus pantallas. Haz clic en cualquiera para abrirla.' },
        { title: 'La etiqueta dice cuánto funciona', text: 'Verde es completa, ámbar sólo sirve para registrar y rojo está en construcción. El detalle está en «Qué significa cada etiqueta».' },
        { title: 'Antes de reportar un fallo, mira aquí', text: 'Si una pantalla figura como «En construcción», lo que le falta todavía no existe. No es una avería.' },
      ]}
    />
    <div className="grid gap-4 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1.5fr)_360px]"><div className="grid gap-4 grid-cols-1 md:grid-cols-2">{viewsByModule().map(({ module, views }) => <Panel key={module.name} title={`${module.name} · ${views.length} ${views.length === 1 ? 'pantalla' : 'pantallas'}`} description={module.purpose} icon={module.icon}><div className="space-y-1">{views.map((item) => { const status = viewStatusInfo[item.status]; return <Link key={item.href} href={item.href} title={status.meaning} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-slate-50"><p className="min-w-0 flex-1 text-pretty text-xs font-bold">{item.title}</p><StatusPill tone={status.tone} dot={false}>{status.label}</StatusPill><Icon name="chevron_right" className="text-[17px] text-slate-500" /></Link>; })}</div></Panel>)}</div><aside className="space-y-4"><Panel title="¿Cuánto del ERP ya funciona?" description={`De ${atlasViewLinks.length} pantallas en total`} icon="donut_large">{STATUS_ORDER.map((key) => <Progress key={key} label={viewStatusInfo[key].label} count={atlasViewLinks.filter((item) => item.status === key).length} total={atlasViewLinks.length} color={STATUS_BAR[key]} />)}</Panel><Panel title="Qué significa cada etiqueta" icon="info"><div className="space-y-3 text-xs">{STATUS_ORDER.map((key) => <div key={key}><StatusPill tone={viewStatusInfo[key].tone}>{viewStatusInfo[key].label}</StatusPill><p className="mt-1.5 leading-5 text-slate-600">{viewStatusInfo[key].meaning}</p></div>)}</div></Panel></aside></div>
  </div>;
}
function Progress({ label, count, total, color }: { label: string; count: number; total: number; color: string }) { const percent = total ? Math.round(count / total * 100) : 0; return <div className="mb-4 last:mb-0"><div className="mb-1.5 flex justify-between text-xs"><span className="font-semibold">{label}</span><span>{count} de {total}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} /></div></div>; }
