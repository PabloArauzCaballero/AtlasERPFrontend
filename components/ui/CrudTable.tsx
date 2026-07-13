'use client';

import { useCallback, useEffect, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { DataTable } from './DataTable';
import type { JsonObject, PaginatedResult, ResourceRow } from '@/services/types';

interface Props {
  title: string;
  description: string;
  columns: string[];
  list: () => Promise<PaginatedResult<ResourceRow>>;
  update?: (id: string, body: JsonObject) => Promise<ResourceRow>;
  remove?: (id: string) => Promise<ResourceRow>;
  editable?: string[];
}

export function CrudTable({ title, description, columns, list, update, remove, editable }: Props) {
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { const result = await list(); setRows(result.items ?? []); } catch (e) { setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos.'); } finally { setLoading(false); } }, [list]);
  useEffect(() => { void load(); }, [load]);

  async function edit(row: ResourceRow) {
    if (!update) return;
    const body: JsonObject = {};
    for (const field of editable ?? []) {
      const value = window.prompt(`Nuevo valor para ${field}`, String(row[field] ?? ''));
      if (value === null) return;
      body[field] = value;
    }
    await update(String(row.id), body); await load();
  }

  async function del(row: ResourceRow) {
    if (!remove) return;
    if (!window.confirm('¿Confirma que desea eliminar este registro? Esta acción no se puede deshacer.')) return;
    await remove(String(row.id)); await load();
  }

  const hasActions = Boolean(update || remove);
  const displayRows = hasActions
    ? rows.map((row) => ({ ...row, acciones: <span className="flex gap-2">{update && (editable?.length) ? <button className="font-semibold text-blue-700" onClick={() => void edit(row)}>Editar</button> : null}{remove ? <button className="font-semibold text-red-700" onClick={() => void del(row)}>Eliminar</button> : null}</span> }))
    : rows;
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="font-bold text-slate-900">{title}</h2><p className="text-sm text-slate-600">{description}</p></div><AtlasButton variant="secondary" type="button" onClick={() => void load()}>Actualizar</AtlasButton></div>{error ? <InlineNotice tone="danger" title="No se pudo consultar">{error}</InlineNotice> : null}<DataTable columns={hasActions ? [...columns, 'acciones'] : columns} rows={displayRows} isLoading={loading} /></section>;
}
