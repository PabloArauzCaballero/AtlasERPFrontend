'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { Panel } from '@/components/atlas/Panel';
import { ScreenExplainer } from '@/components/atlas/ScreenExplainer';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { atlasViewLinks, moduleOfView, viewStatusInfo, viewsByModule } from '@/lib/viewRegistry';

const SITE_MAP_HREF = '/operaciones/admin/mapa-sitio';

export function CommandCenterScreen() {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!normalized) return atlasViewLinks.slice(0, 8);
    return atlasViewLinks.filter((item) => `${item.title} ${item.phase} ${moduleOfView(item).name}`.toLowerCase().includes(normalized)).slice(0, 20);
  }, [normalized]);
  const modules = useMemo(() => viewsByModule(), []);

  return <div className="space-y-5"><WorkspaceHeader breadcrumbs={[{ label: 'Control' }, { label: 'Centro de comando' }]} title="Centro de comando" description="Un buscador para llegar rápido a cualquier pantalla del ERP." />
    <ScreenExplainer
      lead="Esta pantalla no muestra datos de la empresa: es un índice de todas las pantallas del ERP. Escribe lo que quieres hacer y te lleva a la pantalla donde se hace."
      points={[
        { title: 'Escribe qué necesitas', text: 'Por ejemplo «factura», «campaña», «usuarios» o «cierre». Basta con parte del nombre.' },
        { title: 'Abre el resultado', text: 'Cada fila es una pantalla. La etiqueta de color dice si ya funciona completa, si sólo sirve para registrar o si está en construcción.' },
        { title: 'No busca registros concretos', text: 'Para encontrar un NIT, una factura o una persona, entra al módulo y usa la búsqueda de su propia tabla.' },
      ]}
    />
    <Panel><div className="mx-auto max-w-3xl py-5 text-center"><Icon name="search" className="text-[40px] text-[#006a61]" /><h2 className="mt-2 text-lg font-extrabold">¿Qué necesitas hacer?</h2><p className="mt-1 text-xs text-slate-500">Busca por el nombre de la pantalla o del módulo del menú.</p><div className="mt-5"><FormField label="Buscar una pantalla" name="commandSearch" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ej.: factura, campaña, usuarios, cierre de periodo…" /></div></div></Panel>
    <div className="grid gap-4 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1.5fr)_360px]">
      <Panel title={normalized ? `Pantallas que coinciden con «${query.trim()}»` : 'Algunas pantallas para empezar'} description={normalized ? `${results.length} ${results.length === 1 ? 'pantalla encontrada' : 'pantallas encontradas'}` : 'Escribe arriba para ver todas las que coinciden.'} icon="manage_search">
        {results.length ? <div className="divide-y divide-slate-100">{results.map((item) => { const status = viewStatusInfo[item.status]; return <Link key={item.href} href={item.href} className="flex items-center gap-3 px-2 py-3 hover:bg-slate-50"><div className="grid h-9 w-9 shrink-0 place-items-center rounded bg-slate-100 text-[#006a61]"><Icon name={moduleOfView(item).icon} className="text-[19px]" /></div><div className="min-w-0 flex-1"><p className="text-pretty text-xs font-bold">{item.title}</p><p className="hidden truncate text-[11px] text-slate-500 sm:block">Módulo {moduleOfView(item).name} · {status.meaning}</p></div><StatusPill tone={status.tone}>{status.label}</StatusPill><Icon name="chevron_right" className="text-[18px] text-slate-500" /></Link>; })}</div>
          : <div className="px-2 py-8 text-center text-sm text-slate-600"><p className="font-semibold">Ninguna pantalla se llama así.</p><p className="mt-1 text-xs">Prueba con otra palabra, o mira la lista completa en el <Link href={SITE_MAP_HREF} className="font-semibold text-[#006a61] underline">Mapa del sistema</Link>.</p></div>}
      </Panel>
      <div className="space-y-4">
        <Panel title="Pantallas por módulo" description="Pulsa un módulo para ver sus pantallas." icon="category"><div className="space-y-2">{modules.map(({ module, views }) => <button key={module.name} type="button" onClick={() => setQuery(module.name)} className="flex w-full items-center gap-3 rounded bg-slate-50 px-3 py-2.5 text-left text-xs hover:bg-slate-100"><Icon name={module.icon} className="text-[18px] text-[#006a61]" /><span className="min-w-0 flex-1"><span className="block font-semibold">{module.name}</span><span className="block truncate text-[11px] text-slate-500">{module.purpose}</span></span><b>{views.length}</b></button>)}</div></Panel>
        <Panel title="¿Buscas un dato concreto?" icon="help"><p className="text-xs leading-5 text-slate-600">Este buscador encuentra pantallas, no clientes, facturas ni usuarios. Abre el módulo correspondiente y usa la búsqueda de su tabla. Para ver todas las pantallas de una vez, abre el <Link href={SITE_MAP_HREF} className="font-semibold text-[#006a61] underline">Mapa del sistema</Link>.</p></Panel>
      </div>
    </div>
  </div>;
}
