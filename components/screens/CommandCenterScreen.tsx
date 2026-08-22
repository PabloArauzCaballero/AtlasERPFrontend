'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { atlasViewLinks } from '@/lib/viewRegistry';

export function CommandCenterScreen() {
  const [query, setQuery] = useState('');
  const results = useMemo(() => { const normalized = query.trim().toLowerCase(); if (!normalized) return atlasViewLinks.slice(0, 8); return atlasViewLinks.filter((item) => `${item.title} ${item.phase} ${item.backend}`.toLowerCase().includes(normalized)).slice(0, 20); }, [query]);
  const grouped = useMemo(() => ['CRM B2B', 'Contabilidad', 'Ads', 'Portal comercio'].map((label) => ({ label, count: atlasViewLinks.filter((item) => item.phase === label || (label === 'Portal comercio' && item.area === label)).length })), []);
  return <div className="space-y-5"><WorkspaceHeader breadcrumbs={[{ label: 'Administración' }, { label: 'Command Center' }]} title="Centro de comando" description="Encuentre pantallas, módulos y operaciones disponibles en el frontend ATLAS." />
    <Panel><div className="mx-auto max-w-3xl py-5 text-center"><Icon name="search" className="text-[40px] text-[#006a61]" /><h2 className="mt-2 text-lg font-extrabold">¿Qué necesita gestionar?</h2><p className="mt-1 text-xs text-slate-500">La búsqueda local navega por módulos existentes. La búsqueda de datos empresariales requiere un endpoint federado todavía no disponible.</p><div className="mt-5"><FormField label="Búsqueda de navegación" name="commandSearch" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cuentas, campañas, documentos, auditoría..." /></div></div></Panel>
    <div className="grid gap-4 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1.5fr)_360px]"><Panel title="Resultados de la búsqueda" description={`${results.length} accesos encontrados`} icon="manage_search"><div className="divide-y divide-slate-100">{results.map((item) => <Link key={item.href} href={item.href} className="flex items-center gap-3 px-2 py-3 hover:bg-slate-50"><div className="grid h-9 w-9 place-items-center rounded bg-slate-100 text-[#006a61]"><Icon name={item.area === 'Portal comercio' ? 'storefront' : 'apps'} className="text-[19px]" /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{item.title}</p><p className="truncate text-[10px] text-slate-500">{item.phase} · {item.backend}</p></div><StatusPill tone={item.status === 'integrada' ? 'success' : item.status === 'solo-accion' ? 'warning' : 'danger'}>{item.status}</StatusPill><Icon name="chevron_right" className="text-[18px] text-slate-500" /></Link>)}</div></Panel><div className="space-y-4"><Panel title="Explorador de módulos" icon="category"><div className="space-y-3">{grouped.map((item) => <div key={item.label} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2.5 text-xs"><span className="font-semibold">{item.label}</span><b>{item.count}</b></div>)}</div></Panel><Panel title="Brecha de backend" icon="lan"><p className="text-xs leading-5 text-slate-600">La búsqueda de registros por NIT, UUID, factura o usuario no se simula. Requiere un contrato global seguro con autorización por módulo.</p></Panel></div></div>
  </div>;
}
