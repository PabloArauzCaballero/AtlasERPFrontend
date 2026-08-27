'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { ChipsField } from '@/components/atlas/ChipsField';
import { ConfirmDialog } from '@/components/atlas/ConfirmDialog';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Modal } from '@/components/atlas/Modal';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { downloadCsv } from '@/lib/csv';
import { descargarPdf, nombreArchivoPdf, tablaPdf } from '@/lib/pdf';
import { formDataToPayload } from '@/lib/formPayload';
import { formatBob, formatDate, maskPii } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import type { ActionField } from './StructuredActionForm';
import type { JsonObject, PaginatedResult, ResourceRow } from '@/services/types';

export interface CrudColumn {
  key: string;
  label: string;
  kind?: 'text' | 'status' | 'money' | 'date' | 'pii' | 'mono' | 'list' | 'bool' | undefined;
  align?: 'left' | 'right' | undefined;
}

export interface CrudFilter {
  key: string;
  label: string;
  /** `select` sin `options` deriva la lista de los propios datos cargados. */
  kind?: 'select' | 'text' | undefined;
  options?: Array<{ label: string; value: string }> | undefined;
  placeholder?: string | undefined;
}

export interface CrudExtraAction {
  key: string;
  label: string;
  icon: string;
  tone?: 'default' | 'danger' | 'success' | undefined;
  /** Acción que llama al backend y recarga la tabla. Excluyente con `href`. */
  run?: ((row: ResourceRow) => Promise<unknown>) | undefined;
  /** Enlace a otra pantalla (ficha, detalle). Excluyente con `run`. */
  href?: ((row: ResourceRow) => string) | undefined;
  confirm?: { title: string; message: string; confirmLabel?: string | undefined } | undefined;
}

interface CrudDirectoryProps {
  moduleLabel: string;
  title: string;
  description: string;
  load: () => Promise<ResourceRow[] | PaginatedResult<ResourceRow>>;
  columns: CrudColumn[];
  filters?: CrudFilter[] | undefined;
  searchPlaceholder?: string | undefined;
  emptyHint?: string | undefined;
  /** Campo identificador para editar/eliminar. Por defecto `id`. */
  idKey?: string | undefined;
  /** Columna que da nombre a la fila en los mensajes de confirmación. Por defecto, la primera. */
  labelKey?: string | undefined;
  create?: {
    label?: string | undefined;
    title?: string | undefined;
    description?: string | undefined;
    fields?: ActionField[] | undefined;
    submit?: ((payload: JsonObject) => Promise<unknown>) | undefined;
    /** Alternativa al modal: para altas que necesitan un formulario grande con secciones propias. */
    onClick?: (() => void) | undefined;
  } | undefined;
  edit?: {
    title?: string | undefined;
    description?: string | undefined;
    fields: ActionField[];
    submit: (id: string, payload: JsonObject) => Promise<unknown>;
    /** Devuelve `false` para ocultar el lápiz en filas que no se pueden editar. */
    enabled?: ((row: ResourceRow) => boolean) | undefined;
  } | undefined;
  remove?: {
    submit: (id: string) => Promise<unknown>;
    /** Texto extra en la confirmación: qué se lleva por delante el borrado. */
    warning?: string | undefined;
    enabled?: ((row: ResourceRow) => boolean) | undefined;
  } | undefined;
  extraActions?: CrudExtraAction[] | undefined;
  /** Aviso fijo bajo la cabecera: sirve para explicar qué NO permite el backend todavía. */
  notice?: { tone: 'info' | 'warning'; title: string; body: string } | undefined;
  pageSize?: number | undefined;
  /**
   * Sin cabecera de pantalla: para varias tablas dentro de una misma vista (una por pestaña),
   * donde repetir el título y las migas de pan sobraría.
   */
  embedded?: boolean | undefined;
  children?: React.ReactNode;
}

function rowsFrom(data: ResourceRow[] | PaginatedResult<ResourceRow> | null): ResourceRow[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items ?? data.rows ?? [];
}

function cellText(row: ResourceRow, column: CrudColumn): string {
  const raw = row[column.key];
  if (column.kind === 'status') return String(raw ?? '').replaceAll('_', ' ');
  if (column.kind === 'money') return formatBob(Number(raw ?? 0));
  if (column.kind === 'date') return formatDate(typeof raw === 'string' ? raw : undefined);
  if (column.kind === 'pii') return maskPii(raw, column.key);
  if (column.kind === 'bool') return raw ? 'Sí' : 'No';
  if (column.kind === 'list') return Array.isArray(raw) && raw.length ? raw.join('; ') : '';
  return raw === null || raw === undefined ? '' : String(raw);
}

function renderCell(row: ResourceRow, column: CrudColumn) {
  const raw = row[column.key];
  if (column.kind === 'status') {
    const text = String(raw ?? 'SIN ESTADO');
    const upper = text.toUpperCase();
    const tone = /ACTIVE|APPROV|SUCCESS|PAID|SIGNED|POSTED|COMPLET|OPEN/.test(upper) ? 'success'
      : /PEND|REVIEW|DRAFT|PROGRESS|PARTIAL/.test(upper) ? 'warning'
        : /REJECT|BLOCK|FAIL|CANCEL|CLOSED|VOID|REVERS/.test(upper) ? 'danger' : 'neutral';
    return <StatusPill tone={tone}>{text.replaceAll('_', ' ')}</StatusPill>;
  }
  if (column.kind === 'bool') return <StatusPill tone={raw ? 'success' : 'neutral'} dot={false}>{raw ? 'Sí' : 'No'}</StatusPill>;
  if (column.kind === 'money') return formatBob(Number(raw ?? 0));
  if (column.kind === 'date') return formatDate(typeof raw === 'string' ? raw : undefined);
  if (column.kind === 'pii') return maskPii(raw, column.key);
  if (column.kind === 'list') return Array.isArray(raw) && raw.length ? raw.join(', ') : '—';
  return <span className={column.kind === 'mono' ? 'font-mono text-[11px]' : ''}>{String(raw ?? '—')}</span>;
}

/** Valor de un campo del formulario a partir de la fila, soportando nombres anidados (`a.b`). */
function valueOf(row: ResourceRow, name: string): string {
  const segments = name.split('.');
  let current: unknown = row;
  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[segment];
  }
  if (current === null || current === undefined) return '';
  if (Array.isArray(current)) return current.join(', ');
  if (typeof current === 'boolean') return current ? 'true' : 'false';
  // Las fechas llegan en ISO completo y un <input type="date"> sólo acepta AAAA-MM-DD.
  const text = String(current);
  return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text.slice(0, 10) : text;
}

/**
 * Listado completo con filtros, alta y edición/borrado en la propia fila.
 *
 * Reemplaza la pareja «formulario arriba + tabla debajo» que tenían estas pantallas. Ahí lo
 * primero que se veía era un formulario de alta, y para saber qué había registrado —que es la
 * pregunta que se hace uno al entrar— tocaba bajar. Aquí la tabla es la pantalla: el alta es un
 * botón, y modificar o eliminar son el lápiz y la papelera de la fila que se está mirando.
 */
export function CrudDirectory(props: CrudDirectoryProps) {
  const { load } = props;
  const loader = useCallback(() => load(), [load]);
  const resource = useAsyncResource(loader);
  const rows = useMemo(() => rowsFrom(resource.data), [resource.data]);
  const loading = resource.status === 'loading' || resource.status === 'idle';

  const idKey = props.idKey ?? 'id';
  const labelKey = props.labelKey ?? props.columns[0]?.key ?? idKey;
  const pageSize = props.pageSize ?? 25;

  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editingRow, setEditingRow] = useState<ResourceRow | null>(null);
  const [deletingRow, setDeletingRow] = useState<ResourceRow | null>(null);
  const [pendingExtra, setPendingExtra] = useState<{ action: CrudExtraAction; row: ResourceRow } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const filters = useMemo(() => props.filters ?? [], [props.filters]);

  /** Opciones de un filtro select sin lista fija: los valores que existen de verdad en los datos. */
  const derivedOptions = useMemo(() => {
    const map: Record<string, Array<{ label: string; value: string }>> = {};
    for (const filter of filters) {
      if (filter.kind === 'text' || filter.options?.length) continue;
      const seen = new Set<string>();
      for (const row of rows) {
        const raw = row[filter.key];
        if (raw === null || raw === undefined || raw === '') continue;
        if (Array.isArray(raw)) { for (const item of raw) seen.add(String(item)); continue; }
        seen.add(String(raw));
      }
      map[filter.key] = [...seen].sort().map((value) => ({ label: value.replaceAll('_', ' '), value }));
    }
    return map;
  }, [filters, rows]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      for (const filter of filters) {
        const wanted = filterValues[filter.key];
        if (!wanted) continue;
        const raw = row[filter.key];
        const actual = Array.isArray(raw) ? raw.map((item) => String(item)) : [String(raw ?? '')];
        if (filter.kind === 'text') {
          if (!actual.some((value) => value.toLowerCase().includes(wanted.toLowerCase()))) return false;
        } else if (!actual.includes(wanted)) return false;
      }
      if (!needle) return true;
      return props.columns.some((column) => cellText(row, column).toLowerCase().includes(needle));
    });
  }, [rows, filters, filterValues, search, props.columns]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const filtersActive = Boolean(search.trim()) || Object.values(filterValues).some(Boolean);

  useEffect(() => { setPage(1); }, [search, filterValues]);

  const labelFor = useCallback((row: ResourceRow | null): string => {
    if (!row) return '';
    const value = row[labelKey];
    return value === null || value === undefined || value === '' ? String(row[idKey] ?? 'este registro') : String(value);
  }, [labelKey, idKey]);

  const exportCsv = useCallback(() => {
    if (!filteredRows.length) return;
    const slug = props.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    downloadCsv(
      `${slug || 'registros'}.csv`,
      props.columns.map((column) => ({ key: column.key, label: column.label })),
      filteredRows,
      (row, key) => {
        const column = props.columns.find((item) => item.key === key);
        return column ? cellText(row as ResourceRow, column) : '';
      },
    );
  }, [filteredRows, props.columns, props.title]);

  /*
   * El mismo listado, en PDF.
   *
   * Se imprime lo FILTRADO y se dice que lo es: un informe que sale de una vista con filtros
   * puestos y no lo declara se lee después como «el listado completo», y a partir de ahí las
   * cuentas no cuadran. Las celdas pasan por `cellText`, el mismo formateador que la tabla, para
   * que el documento diga exactamente lo que decía la pantalla.
   */
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const exportarPdf = useCallback(async () => {
    setGenerandoPdf(true);
    setActionError('');
    try {
      await descargarPdf(
        {
          title: props.title,
          subtitle: `${props.moduleLabel} · ${filteredRows.length.toLocaleString('es-BO')} registro(s)`,
          summary: [
            { label: 'Registros impresos', value: filteredRows.length },
            { label: 'Registros en total', value: rows.length },
          ],
          ...(filtersActive
            ? {
                notices: [
                  {
                    level: 'caution' as const,
                    title: 'Listado filtrado',
                    text:
                      `Este documento contiene ${filteredRows.length} de ${rows.length} registros: ` +
                      'los que cumplían los filtros activos al generarlo, no el listado completo.',
                  },
                ],
              }
            : {}),
          sections: [
            {
              title: props.title,
              description: props.description,
              table: tablaPdf(
                props.columns.map((column) => ({ key: column.key, label: column.label })),
                filteredRows,
                (row, key) => {
                  const column = props.columns.find((item) => item.key === key);
                  return column ? cellText(row as ResourceRow, column) : '';
                },
              ),
            },
          ],
        },
        nombreArchivoPdf(props.title),
      );
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo generar el PDF.');
    } finally {
      setGenerandoPdf(false);
    }
  }, [filteredRows, rows.length, filtersActive, props.title, props.description, props.moduleLabel, props.columns]);

  async function runDelete() {
    if (!props.remove || !deletingRow) return;
    const id = String(deletingRow[idKey] ?? '');
    const name = labelFor(deletingRow);
    setBusy(true);
    setActionError('');
    try {
      await props.remove.submit(id);
      setDeletingRow(null);
      toast.success('Registro eliminado', `Se eliminó «${name}».`);
      await resource.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo eliminar el registro.');
    } finally {
      setBusy(false);
    }
  }

  async function runExtra() {
    if (!pendingExtra?.action.run) return;
    const { action, row } = pendingExtra;
    setBusy(true);
    setActionError('');
    try {
      await action.run!(row);
      setPendingExtra(null);
      toast.success('Operación registrada', `${action.label}: ${labelFor(row)}.`);
      await resource.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  }

  async function launchExtra(action: CrudExtraAction, row: ResourceRow) {
    if (!action.run) return;
    if (action.confirm) { setPendingExtra({ action, row }); return; }
    setActionError('');
    try {
      await action.run(row);
      toast.success('Operación registrada', `${action.label}: ${labelFor(row)}.`);
      await resource.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo completar la operación.');
    }
  }

  const hasRowActions = Boolean(props.edit || props.remove || props.extraActions?.length);

  const create = props.create;
  const toolbar = (
    <>
      <AtlasButton variant="secondary" icon="picture_as_pdf" data-testid="crud-pdf" loading={generandoPdf} disabled={!filteredRows.length} onClick={() => void exportarPdf()}>PDF</AtlasButton>
      <AtlasButton variant="secondary" icon="download" disabled={!filteredRows.length} onClick={exportCsv}>CSV</AtlasButton>
      <AtlasButton variant="secondary" icon="refresh" loading={loading} onClick={resource.reload}>Actualizar</AtlasButton>
      {create ? (
        <AtlasButton icon="add" data-testid="crud-crear" onClick={() => (create.onClick ? create.onClick() : setCreating(true))}>{create.label ?? 'Crear'}</AtlasButton>
      ) : null}
    </>
  );

  return (
    <div className="space-y-5">
      {props.embedded ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">{props.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{props.description}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">{toolbar}</div>
        </div>
      ) : (
        <WorkspaceHeader
          breadcrumbs={[{ label: props.moduleLabel }, { label: props.title }]}
          title={props.title}
          description={props.description}
          actions={toolbar}
        />
      )}

      {props.notice ? <InlineNotice tone={props.notice.tone} title={props.notice.title}>{props.notice.body}</InlineNotice> : null}
      {actionError ? <InlineNotice tone="danger" title="No se pudo completar la operación">{actionError}</InlineNotice> : null}
      {resource.error && !rows.length ? <InlineNotice tone="danger" title="No se pudo cargar el listado">{resource.error}</InlineNotice> : null}

      <Panel compact data-tutorial-id="crud-filtros">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="block min-w-0 flex-1">
            <span className="mb-1.5 block text-xs font-bold text-slate-700">Buscar</span>
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={props.searchPlaceholder ?? 'Buscar en todas las columnas…'}
                data-testid="crud-buscar"
                className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-[#006a61] focus:ring-2 focus:ring-[#006a61]/20"
              />
            </div>
          </label>

          {filters.map((filter) => (
            filter.kind === 'text' ? (
              <FormField
                key={filter.key}
                label={filter.label}
                name={`filtro-${filter.key}`}
                className="w-full lg:w-48"
                value={filterValues[filter.key] ?? ''}
                placeholder={filter.placeholder ?? ''}
                onChange={(event) => setFilterValues((current) => ({ ...current, [filter.key]: event.target.value }))}
              />
            ) : (
              <FormField
                key={filter.key}
                kind="select"
                label={filter.label}
                name={`filtro-${filter.key}`}
                className="w-full lg:w-48"
                value={filterValues[filter.key] ?? ''}
                onChange={(event) => setFilterValues((current) => ({ ...current, [filter.key]: event.target.value }))}
                options={[{ label: 'Todos', value: '' }, ...(filter.options ?? derivedOptions[filter.key] ?? [])]}
              />
            )
          ))}

          <AtlasButton variant="secondary" icon="filter_alt_off" disabled={!filtersActive} onClick={() => { setSearch(''); setFilterValues({}); }}>Limpiar</AtlasButton>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          {loading && !rows.length ? 'Cargando…' : filtersActive
            ? `${filteredRows.length.toLocaleString('es-BO')} de ${rows.length.toLocaleString('es-BO')} registros con estos filtros.`
            : `${rows.length.toLocaleString('es-BO')} registros.`}
        </p>
      </Panel>

      <Panel className="!p-0" data-tutorial-id="crud-tabla">
        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500">
              <tr>
                {props.columns.map((column) => (
                  <th key={column.key} className={`border-b border-slate-200 px-3 py-2.5 font-bold ${column.align === 'right' ? 'text-right' : ''}`}>{column.label}</th>
                ))}
                {hasRowActions ? <th className="border-b border-slate-200 px-3 py-2.5 text-right font-bold">Acciones</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.map((row, index) => {
                const id = String(row[idKey] ?? index);
                return (
                  <tr key={id} className="hover:bg-slate-50/80" data-testid={`fila-${id}`}>
                    {props.columns.map((column) => (
                      <td key={column.key} className={`whitespace-nowrap px-3 py-2.5 text-slate-700 ${column.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                        {renderCell(row, column)}
                      </td>
                    ))}
                    {hasRowActions ? (
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {(props.extraActions ?? []).map((action) => {
                            const clase = 'grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900';
                            return action.href ? (
                              <Link key={action.key} href={action.href(row)} title={action.label} aria-label={`${action.label}: ${labelFor(row)}`} data-testid={`accion-${action.key}-${id}`} className={clase}>
                                <Icon name={action.icon} className="text-[17px]" />
                              </Link>
                            ) : (
                              <button
                                key={action.key}
                                type="button"
                                title={action.label}
                                aria-label={`${action.label}: ${labelFor(row)}`}
                                data-testid={`accion-${action.key}-${id}`}
                                onClick={() => void launchExtra(action, row)}
                                className={clase}
                              >
                                <Icon name={action.icon} className="text-[17px]" />
                              </button>
                            );
                          })}
                          {props.edit && (props.edit.enabled ? props.edit.enabled(row) : true) ? (
                            <button
                              type="button"
                              title="Modificar"
                              aria-label={`Modificar ${labelFor(row)}`}
                              data-testid={`editar-${id}`}
                              onClick={() => setEditingRow(row)}
                              className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-primary-wash hover:text-primary"
                            >
                              <Icon name="edit" className="text-[17px]" />
                            </button>
                          ) : null}
                          {props.remove && (props.remove.enabled ? props.remove.enabled(row) : true) ? (
                            <button
                              type="button"
                              title="Eliminar"
                              aria-label={`Eliminar ${labelFor(row)}`}
                              data-testid={`eliminar-${id}`}
                              onClick={() => setDeletingRow(row)}
                              className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-red-50 hover:text-red-700"
                            >
                              <Icon name="delete" className="text-[17px]" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })}

              {!visibleRows.length && !loading ? (
                <tr>
                  <td colSpan={props.columns.length + (hasRowActions ? 1 : 0)} className="px-6 py-12 text-center">
                    <Icon name="inbox" className="text-[30px] text-slate-400" />
                    <p className="mt-2 font-bold text-slate-700">{filtersActive ? 'Ningún registro coincide con los filtros' : 'Todavía no hay registros'}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {filtersActive ? 'Prueba a limpiar los filtros para ver el listado completo.' : props.emptyHint ?? 'Usa el botón «Crear» de arriba para registrar el primero.'}
                    </p>
                  </td>
                </tr>
              ) : null}

              {loading && !rows.length ? (
                <tr><td colSpan={props.columns.length + (hasRowActions ? 1 : 0)} className="px-6 py-12 text-center text-xs text-slate-500">Cargando registros…</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-3 py-2.5">
            <p className="text-[11px] text-slate-500">Página {currentPage} de {totalPages} · {filteredRows.length.toLocaleString('es-BO')} registros</p>
            <div className="flex gap-1.5">
              <AtlasButton variant="secondary" icon="chevron_left" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</AtlasButton>
              <AtlasButton variant="secondary" icon="chevron_right" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Siguiente</AtlasButton>
            </div>
          </div>
        ) : null}
      </Panel>

      {props.children}

      {create?.fields && create.submit ? (
        <CrudFormModal
          open={creating}
          icon="add"
          title={create.title ?? `Crear ${props.title.toLowerCase()}`}
          description={create.description}
          fields={create.fields}
          submitLabel={create.label ?? 'Crear'}
          onClose={() => setCreating(false)}
          onSubmit={async (payload) => {
            await create.submit!(payload);
            setCreating(false);
            toast.success('Registro creado', 'El nuevo registro ya aparece en la tabla.');
            await resource.reload();
          }}
        />
      ) : null}

      {props.edit ? (
        <CrudFormModal
          open={Boolean(editingRow)}
          icon="edit"
          title={props.edit.title ?? `Modificar ${labelFor(editingRow)}`}
          description={props.edit.description}
          fields={props.edit.fields}
          row={editingRow}
          submitLabel="Guardar cambios"
          onClose={() => setEditingRow(null)}
          onSubmit={async (payload) => {
            const target = editingRow;
            if (!target) return;
            await props.edit!.submit(String(target[idKey] ?? ''), payload);
            setEditingRow(null);
            toast.success('Cambios guardados', `Se actualizó «${labelFor(target)}».`);
            await resource.reload();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(deletingRow)}
        tone="danger"
        title="Eliminar el registro"
        message={`Se eliminará «${labelFor(deletingRow)}». ${props.remove?.warning ?? 'La operación no se puede deshacer y queda registrada en la auditoría.'}`}
        confirmLabel="Sí, eliminar"
        loading={busy}
        onConfirm={() => void runDelete()}
        onCancel={() => setDeletingRow(null)}
      />

      <ConfirmDialog
        open={Boolean(pendingExtra)}
        tone="danger"
        title={pendingExtra?.action.confirm?.title ?? 'Confirmar'}
        message={pendingExtra ? `${pendingExtra.action.confirm?.message ?? ''} (${labelFor(pendingExtra.row)})` : ''}
        confirmLabel={pendingExtra?.action.confirm?.confirmLabel ?? 'Confirmar'}
        loading={busy}
        onConfirm={() => void runExtra()}
        onCancel={() => setPendingExtra(null)}
      />
    </div>
  );
}

interface CrudFormModalProps {
  open: boolean;
  title: string;
  description?: string | undefined;
  icon: string;
  fields: ActionField[];
  row?: ResourceRow | null | undefined;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (payload: JsonObject) => Promise<void>;
}

/** Formulario de alta/edición dentro del modal, con los mismos campos declarativos del resto del ERP. */
function CrudFormModal(props: CrudFormModalProps) {
  const { open, fields } = props;
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, Array<{ label: string; value: string }>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Los catálogos se piden al abrir, no al montar: si no se abre nunca, no se gasta la llamada.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fields.filter((field) => field.optionsLoader).forEach((field) => {
      field.optionsLoader!()
        .then((options) => { if (!cancelled) setDynamicOptions((current) => ({ ...current, [field.name]: options })); })
        .catch(() => { /* el select queda vacío y el error real se ve al enviar */ });
    });
    return () => { cancelled = true; };
  }, [open, fields]);

  useEffect(() => { if (open) setError(''); }, [open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const definitions = fields.map((field) => ({ name: field.name, valueKind: field.valueKind, optional: field.optional }));
    setSaving(true);
    setError('');
    try {
      await props.onSubmit(formDataToPayload(new FormData(event.currentTarget), definitions) as JsonObject);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar. Revisa los datos.');
    } finally {
      setSaving(false);
    }
  }

  const row = props.row ?? null;
  // Remontar el formulario por fila hace que los `defaultValue` se apliquen al cambiar de registro.
  const formKey = row ? String(row.id ?? '') : 'nuevo';

  return (
    <Modal open={open} title={props.title} description={props.description} icon={props.icon} onClose={props.onClose}>
      <form key={formKey} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field) => {
            const span = field.span === 3 ? 'sm:col-span-2' : field.span === 2 ? 'sm:col-span-2' : '';
            const preset = row ? valueOf(row, field.name) : undefined;
            const defaultValue = preset !== undefined && preset !== '' ? preset : field.defaultValue;
            if (field.type === 'chips') {
              return <ChipsField key={field.name} name={field.name} label={field.label} required={field.required} defaultValue={typeof defaultValue === 'string' ? defaultValue : undefined} placeholder={field.placeholder} hint={field.hint} className={span} />;
            }
            if (field.type === 'select') {
              return <FormField key={field.name} kind="select" name={field.name} label={field.label} required={field.required} defaultValue={defaultValue} hint={field.hint} options={field.options ?? dynamicOptions[field.name] ?? []} className={span} />;
            }
            if (field.type === 'textarea') {
              return <FormField key={field.name} kind="textarea" name={field.name} label={field.label} required={field.required} defaultValue={defaultValue} placeholder={field.placeholder} hint={field.hint} className={span} />;
            }
            return <FormField key={field.name} name={field.name} label={field.label} required={field.required} type={field.type ?? 'text'} defaultValue={defaultValue} placeholder={field.placeholder} hint={field.hint} className={span} />;
          })}
        </div>
        {error ? <InlineNotice tone="danger" title="No se pudo guardar">{error}</InlineNotice> : null}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <AtlasButton variant="secondary" type="button" onClick={props.onClose}>Cancelar</AtlasButton>
          <AtlasButton type="submit" icon="save" loading={saving}>{props.submitLabel}</AtlasButton>
        </div>
      </form>
    </Modal>
  );
}
