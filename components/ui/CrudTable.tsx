'use client';

import { useCallback, useEffect, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { ConfirmDialog } from './ConfirmDialog';
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

/**
 * Listado con edición y borrado en línea.
 *
 * La edición se hacía con una CADENA de `window.prompt`, uno por campo: tres
 * ventanas grises seguidas, sin ver el registro, sin poder volver atrás y sin
 * saber cuántas quedaban. Cancelar en la segunda descartaba también la primera y
 * no lo decía. Ahora es un panel con los campos a la vez, junto a la tabla y con
 * el registro delante, que es lo mínimo para poder corregir un dato sin
 * equivocarse de fila.
 */
export function CrudTable({ title, description, columns, list, update, remove, editable }: Props) {
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ResourceRow | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ResourceRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await list();
      setRows(result.items ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudieron cargar los datos.');
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => { void load(); }, [load]);

  function beginEdit(row: ResourceRow) {
    setDraft(Object.fromEntries((editable ?? []).map((field) => [field, String(row[field] ?? '')])));
    setEditing(row);
  }

  async function saveEdit() {
    if (!editing || !update) return;
    setSaving(true);
    setError('');
    try {
      await update(String(editing.id), draft as JsonObject);
      setEditing(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo guardar el cambio.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting || !remove) return;
    const target = deleting;
    setDeleting(null);
    setError('');
    try {
      await remove(String(target.id));
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el registro.');
    }
  }

  const canEdit = Boolean(update && editable?.length);
  const hasActions = canEdit || Boolean(remove);
  const displayRows = hasActions
    ? rows.map((row) => ({
        ...row,
        acciones: (
          <span className="flex gap-3">
            {canEdit ? <button type="button" className="font-semibold text-primary hover:underline" onClick={() => beginEdit(row)}>Editar</button> : null}
            {remove ? <button type="button" className="font-semibold text-red-700 hover:underline" onClick={() => setDeleting(row)}>Eliminar</button> : null}
          </span>
        ),
      }))
    : rows;

  /** Etiqueta legible del registro, para no preguntar «¿está seguro?» a ciegas. */
  const labelOf = (row: ResourceRow | null): string => {
    if (!row) return '';
    const first = columns.map((column) => row[column]).find((value) => typeof value === 'string' && value.length > 0);
    return typeof first === 'string' ? first : String(row.id ?? '');
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-600">{description}</p>
        </div>
        <AtlasButton variant="secondary" type="button" icon="refresh" onClick={() => void load()}>Actualizar</AtlasButton>
      </div>

      {error ? <InlineNotice tone="danger" title="No se pudo completar la operación">{error}</InlineNotice> : null}

      {editing ? (
        <div className="rounded-lg border border-primary-soft bg-primary-wash p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#006a61]">Editando: {labelOf(editing)}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(editable ?? []).map((field) => (
              <FormField
                key={field}
                label={field}
                name={field}
                value={draft[field] ?? ''}
                onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
              />
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <AtlasButton type="button" icon="save" loading={saving} onClick={() => void saveEdit()}>Guardar cambios</AtlasButton>
            <AtlasButton variant="secondary" type="button" onClick={() => setEditing(null)}>Cancelar</AtlasButton>
          </div>
        </div>
      ) : null}

      <DataTable columns={hasActions ? [...columns, 'acciones'] : columns} rows={displayRows} isLoading={loading} />

      {deleting ? (
        <ConfirmDialog
          title="Eliminar el registro"
          body={`Se eliminará «${labelOf(deleting)}». La operación no se puede deshacer y queda registrada en la auditoría.`}
          confirmLabel="Sí, eliminar"
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </section>
  );
}
