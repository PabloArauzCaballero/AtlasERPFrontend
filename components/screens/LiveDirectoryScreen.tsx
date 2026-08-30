'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { isFailureStatus, useAsyncResource } from '@/hooks/useAsyncResource';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { PageQuery, PaginatedResult, ResourceRow } from '@/services/types';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { formatBob, formatDate, maskPii, statusTone } from '@/lib/formatters';
import { downloadCsv } from '@/lib/csv';
import { descargarPdf, nombreArchivoPdf, tablaPdf } from '@/lib/pdf';
import { ConfirmDialog } from '@/components/atlas/ConfirmDialog';
import { toast } from '@/lib/toast';
import { ActionFormModal } from './ActionFormModal';
import type { ActionField } from './StructuredActionForm';
import type { JsonObject } from '@/services/types';
import { ScreenState } from '@/components/ui/ScreenState';

export interface DirectoryColumn {
  key: string;
  label: string;
  kind?: 'text' | 'status' | 'money' | 'date' | 'pii' | 'mono' | 'list';
  align?: 'left' | 'right' | 'center';
}

interface MetricDefinition {
  label: string;
  value: (rows: ResourceRow[], total: number) => React.ReactNode;
  detail: string;
  icon: string;
  tone?: 'navy' | 'teal' | 'amber' | 'red' | 'purple';
}

export interface DirectoryFilter {
  key: string;
  label: string;
  kind?: 'select' | 'text';
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
}

export interface RowAction {
  key: string;
  label: string;
  href?: string;
  onClick?: (row: ResourceRow) => void | Promise<void>;
  icon?: string;
  tone?: 'default' | 'danger';
  /** Si se define, pide confirmación en un modal antes de ejecutar `onClick`. */
  confirm?: { title: string; message: string; confirmLabel?: string; tone?: 'danger' | 'primary'; successMessage?: string };
  /**
   * Operación que necesita datos: abre un modal sobre la fila en vez de mandar a otra pestaña.
   *
   * Es el mismo gesto que el lápiz de `CrudDirectory`; aquí sirve para lo que el backend expone
   * como una transición y no como una edición (cambiar el estado de una campaña, por ejemplo).
   */
  form?: {
    title?: ((row: ResourceRow) => string) | undefined;
    description?: string | undefined;
    fields: ActionField[] | ((row: ResourceRow) => ActionField[]);
    submit: (row: ResourceRow, payload: JsonObject) => Promise<unknown>;
    submitLabel?: string | undefined;
    icon?: string | undefined;
  } | undefined;
}

interface LiveDirectoryScreenProps {
  title: string;
  description: string;
  moduleLabel: string;
  load: (query: PageQuery) => Promise<PaginatedResult<ResourceRow>>;
  columns: DirectoryColumn[];
  metrics: MetricDefinition[];
  createHref?: string;
  createLabel?: string;
  /** Alternativa a `createHref` cuando el alta vive en otra pestaña de la misma vista. */
  createOnClick?: (() => void) | undefined;
  /** Alta en un modal sobre la propia tabla: la forma estándar del ERP. */
  create?: {
    title?: string | undefined;
    description?: string | undefined;
    fields: ActionField[];
    submit: (payload: JsonObject) => Promise<unknown>;
    icon?: string | undefined;
  } | undefined;
  /**
   * Sin cabecera de pantalla: para cuando este directorio es una pestaña dentro de una vista que
   * ya pone su propio `WorkspaceHeader`, y repetir el título y las migas de pan sobraría.
   */
  embedded?: boolean | undefined;
  searchPlaceholder?: string;
  /** Filtro simple por estado. Se combina con `filters` (equivale a un filtro de key `status`). */
  statusOptions?: Array<{ label: string; value: string }>;
  /** Filtros dinámicos adicionales (accountType, partnerType, kybStatus, etc.). */
  filters?: DirectoryFilter[];
  detailHref?: (row: ResourceRow) => string | undefined;
  /** Acciones por fila; si se define, reemplaza al botón por defecto de la columna Acciones. */
  rowActions?: (row: ResourceRow) => RowAction[];
}

function rowsFrom(data: PaginatedResult<ResourceRow> | null): ResourceRow[] {
  return data?.items ?? data?.rows ?? [];
}

/** Texto plano de una celda para el CSV: mismos formatos que la tabla, sin nodos de React. */
function cellText(row: ResourceRow, column: DirectoryColumn): string {
  const raw = row[column.key];
  if (column.kind === 'status') return String(raw ?? 'SIN ESTADO').replaceAll('_', ' ');
  if (column.kind === 'money') return formatBob(Number(raw ?? 0));
  if (column.kind === 'date') return formatDate(typeof raw === 'string' ? raw : undefined);
  if (column.kind === 'pii') return maskPii(raw, column.key);
  if (column.kind === 'list') return Array.isArray(raw) && raw.length ? raw.join('; ') : '';
  return raw === null || raw === undefined ? '' : String(raw);
}

function renderCell(row: ResourceRow, column: DirectoryColumn) {
  const raw = row[column.key];
  if (column.kind === 'status') {
    const text = String(raw ?? 'SIN ESTADO');
    return <StatusPill tone={statusTone(text)}>{text.replaceAll('_', ' ')}</StatusPill>;
  }
  if (column.kind === 'money') return formatBob(Number(raw ?? 0));
  if (column.kind === 'date') return formatDate(typeof raw === 'string' ? raw : undefined);
  if (column.kind === 'pii') return maskPii(raw, column.key);
  if (column.kind === 'list') return Array.isArray(raw) && raw.length ? raw.join(', ') : '—';
  return <span className={column.kind === 'mono' ? 'font-mono text-[11px]' : ''}>{String(raw ?? '—')}</span>;
}

export function LiveDirectoryScreen(props: LiveDirectoryScreenProps) {
  const { load } = props;
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [query, setQuery] = useState<PageQuery>({ page: 1, limit: 25, pageSize: 25 });
  const debouncedSearch = useDebouncedValue(searchInput);

  const effectiveFilters = useMemo<DirectoryFilter[]>(() => {
    const list: DirectoryFilter[] = [];
    if (props.statusOptions?.length) list.push({ key: 'status', label: 'Estado', options: props.statusOptions });
    if (props.filters?.length) list.push(...props.filters);
    return list;
  }, [props.statusOptions, props.filters]);

  const filterKeys = useMemo(() => effectiveFilters.map((filter) => filter.key), [effectiveFilters]);
  const filterSignature = filterKeys.map((key) => `${key}:${filterValues[key] ?? ''}`).join('|');

  useEffect(() => {
    startTransition(() => {
      setQuery((current) => {
        const stableQuery: PageQuery = { ...current };
        delete stableQuery.search;
        filterKeys.forEach((key) => delete stableQuery[key]);
        const activeFilters = Object.fromEntries(
          filterKeys.filter((key) => filterValues[key]).map((key) => [key, filterValues[key]]),
        );
        return {
          ...stableQuery,
          ...activeFilters,
          page: 1,
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
        };
      });
    });
    // filterSignature codifica los valores activos sin re-disparar por identidad de objeto
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filterSignature]);

  const loader = useCallback(() => load(query), [load, query]);
  const resource = useAsyncResource(loader);
  const rows = useMemo(() => rowsFrom(resource.data), [resource.data]);
  const total = typeof resource.data?.total === 'number' ? resource.data.total : rows.length;
  const page = query.page ?? 1;
  const pageSize = query.limit ?? query.pageSize ?? 25;
  const loading = resource.status === 'loading' || isPending;

  const exportCsv = useCallback(() => {
    if (!rows.length) return;
    const slug = props.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    downloadCsv(`${slug || 'export'}.csv`, props.columns.map((column) => ({ key: column.key, label: column.label })), rows, (row, key) => {
      const column = props.columns.find((item) => item.key === key);
      return column ? cellText(row as ResourceRow, column) : '';
    });
  }, [rows, props.columns, props.title]);

  /*
   * El mismo directorio, en PDF.
   *
   * Imprime la PÁGINA que se está viendo, y lo dice: este listado es paginado en el servidor, así
   * que «todo» no está en pantalla. Callarlo produciría un informe que parece el censo completo y
   * son veinticinco filas.
   */
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [errorPdf, setErrorPdf] = useState('');

  const exportarPdf = useCallback(async () => {
    setGenerandoPdf(true);
    setErrorPdf('');
    try {
      await descargarPdf(
        {
          title: props.title,
          subtitle: `${props.moduleLabel} · ${rows.length.toLocaleString('es-BO')} de ${total.toLocaleString('es-BO')} registro(s)`,
          summary: [
            { label: 'Registros impresos', value: rows.length },
            { label: 'Registros en total', value: total },
          ],
          ...(rows.length < total
            ? {
                notices: [
                  {
                    level: 'caution' as const,
                    title: 'Sólo la página actual',
                    text:
                      `Este documento contiene los ${rows.length} registros de la página que se estaba viendo, ` +
                      `de ${total} en total. Ajusta los filtros o la página para imprimir otros.`,
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
                rows,
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
      setErrorPdf(error instanceof Error ? error.message : 'No se pudo generar el PDF.');
    } finally {
      setGenerandoPdf(false);
    }
  }, [rows, total, props.title, props.description, props.moduleLabel, props.columns]);

  const [pending, setPending] = useState<{ action: RowAction; row: ResourceRow } | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [rowForm, setRowForm] = useState<{ action: RowAction; row: ResourceRow } | null>(null);

  const runAction = useCallback(async (action: RowAction, row: ResourceRow) => {
    try {
      await action.onClick?.(row);
      if (action.confirm?.successMessage) toast.success(action.confirm.successMessage);
    } catch (error) {
      toast.error('No se pudo completar la acción', error instanceof Error ? error.message : undefined);
    } finally {
      resource.reload();
    }
  }, [resource]);

  const crear = props.create
    ? <AtlasButton icon="add" data-tutorial-id="directory-create" data-testid="directorio-crear" onClick={() => setCreating(true)}>{props.createLabel ?? 'Crear registro'}</AtlasButton>
    : props.createOnClick
    ? <AtlasButton icon="add" data-tutorial-id="directory-create" onClick={props.createOnClick}>{props.createLabel ?? 'Crear registro'}</AtlasButton>
    : props.createHref
      ? <Link href={props.createHref} data-tutorial-id="directory-create"><AtlasButton icon="add">{props.createLabel ?? 'Crear registro'}</AtlasButton></Link>
      : null;

  const barraAcciones = (
    <>
      <AtlasButton variant="secondary" icon="picture_as_pdf" data-testid="directorio-pdf" loading={generandoPdf} disabled={!rows.length} onClick={() => void exportarPdf()}>PDF</AtlasButton>
      <AtlasButton variant="secondary" icon="download" disabled={!rows.length} onClick={exportCsv}>CSV</AtlasButton>
      {crear}
    </>
  );

  return (
    <div className="space-y-5" aria-busy={loading}>
      {props.embedded ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">{props.title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{props.description}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">{barraAcciones}</div>
        </div>
      ) : (
        <WorkspaceHeader
          breadcrumbs={[{ label: props.moduleLabel }, { label: props.title }]}
          title={props.title}
          description={props.description}
          actions={barraAcciones}
        />
      )}

      <div data-tutorial-id="directory-metrics" className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {props.metrics.slice(0, 4).map((metric) => <MetricCard key={metric.label} {...metric} value={metric.value(rows, total)} />)}
      </div>

      <Panel compact>
        <div data-tutorial-id="directory-filters" className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap">
            <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 sm:basis-56 focus-within:border-[#006a61] focus-within:ring-2 focus-within:ring-primary/15">
              <Icon name="search" className="text-[18px] text-slate-500" />
              <input data-tutorial-id="directory-search" className="min-w-0 flex-1 bg-transparent text-xs outline-none" placeholder={props.searchPlaceholder ?? 'Buscar registros...'} value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
            </label>
            {effectiveFilters.map((filter) => (
              filter.kind === 'text' ? <input key={filter.key} aria-label={filter.label} placeholder={filter.placeholder ?? filter.label} className="h-9 min-w-36 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-700" value={filterValues[filter.key] ?? ''} onChange={(event) => setFilterValues((current) => ({ ...current, [filter.key]: event.target.value }))} /> : <select key={filter.key} aria-label={filter.label} className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700" value={filterValues[filter.key] ?? ''} onChange={(event) => setFilterValues((current) => ({ ...current, [filter.key]: event.target.value }))}>
                <option value="">{`Todos: ${filter.label}`}</option>
                {(filter.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {loading && rows.length ? <span className="flex items-center gap-2 text-xs font-semibold text-slate-500"><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-[#006a61]" />Actualizando</span> : null}
            <select className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs" value={pageSize} onChange={(event) => setQuery((current) => ({ ...current, page: 1, limit: Number(event.target.value), pageSize: Number(event.target.value) }))}>
              {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} filas</option>)}
            </select>
            <AtlasButton variant="secondary" icon="refresh" loading={loading} onClick={resource.reload}>Actualizar</AtlasButton>
          </div>
        </div>
      </Panel>

      {/*
        * El fallo se delega a `ScreenState`, que distingue permiso / sesión / red / rotura.
        *
        * Antes esto era un `InlineNotice` rojo único para los cuatro casos: un 403 y un timeout se
        * leían igual y ofrecían lo mismo (nada). `ScreenState` ya sabe pintar cada uno con su
        * salida —pedir el rol, volver a entrar, reintentar—, así que basta con dejarle el estado.
        * La condición `!rows.length` se conserva: si la recarga falla pero la tabla YA tiene datos,
        * taparla con un cartel esconde información que sigue siendo válida.
        */}
      {isFailureStatus(resource.status) && !rows.length ? (
        <ScreenState status={resource.status} error={resource.error} onRetry={resource.reload} hasData={false} />
      ) : null}
      {errorPdf ? <InlineNotice tone="danger" title="No se pudo generar el PDF">{errorPdf}</InlineNotice> : null}

      <section data-tutorial-id="resource-table" className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
        {loading && !rows.length ? <TableSkeleton columns={props.columns.length + 1} /> : (
          <div className="table-scroll">
            <table className="w-full min-w-[900px] border-collapse text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500">
                <tr>{props.columns.map((column) => <th className={`border-b border-slate-200 px-3 py-3 font-bold ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}`} key={column.key}>{column.label}</th>)}<th className="border-b border-slate-200 px-3 py-3 text-right font-bold">Acciones</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, index) => {
                  const rowKey = String(row.id ?? row.uuid ?? index);
                  const href = props.detailHref?.(row);
                  const actions = props.rowActions?.(row) ?? [];
                  return (
                    <tr key={rowKey} className="group hover:bg-slate-50/80">
                      {props.columns.map((column) => <td key={column.key} className={`whitespace-nowrap px-3 py-3 text-slate-700 ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}`}>{renderCell(row, column)}</td>)}
                      <td className="px-3 py-3 text-right">
                        {actions.length ? (
                          <div className="flex items-center justify-end gap-1">
                            {actions.map((action) => {
                              const toneClass = action.tone === 'danger' ? 'text-red-600 hover:bg-red-50' : 'text-primary hover:bg-primary-wash';
                              const className = `inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-bold ${toneClass}`;
                              return action.href
                                ? <Link key={action.key} className={className} href={action.href}>{action.icon ? <Icon name={action.icon} className="text-[16px]" /> : null}{action.label}</Link>
                                : <button key={action.key} type="button" className={className} onClick={() => { if (action.form) setRowForm({ action, row }); else if (action.confirm) setPending({ action, row }); else void runAction(action, row); }}>{action.icon ? <Icon name={action.icon} className="text-[16px]" /> : null}{action.label}</button>;
                            })}
                          </div>
                        ) : href ? (
                          <Link className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-bold text-primary hover:bg-primary-wash" href={href}>Ver <Icon name="chevron_right" className="text-[16px]" /></Link>
                        ) : (
                          <button className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100" aria-label="Más acciones"><Icon name="more_horiz" className="text-[18px]" /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && resource.status !== 'loading' ? <tr><td colSpan={props.columns.length + 1} className="px-6 py-16 text-center"><Icon name="inbox" className="text-[36px] text-slate-400" /><p className="mt-2 font-bold text-slate-700">No hay registros para los filtros aplicados</p><p className="mt-1 text-xs text-slate-500">Prueba con otros criterios o crea el primer registro.</p></td></tr> : null}
              </tbody>
            </table>
          </div>
        )}
        {loading && rows.length ? <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-primary-soft"><div className="h-full w-1/3 animate-[pulse_1s_ease-in-out_infinite] bg-[#006a61]" /></div> : null}
      </section>

      <div className="flex flex-col items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 sm:flex-row">
        <span>Página <b>{page}</b> · {rows.length} visibles · <b>{total}</b> registros</span>
        <div className="flex gap-2"><AtlasButton variant="secondary" disabled={page <= 1 || loading} onClick={() => setQuery((current) => ({ ...current, page: page - 1 }))}>Anterior</AtlasButton><AtlasButton variant="secondary" disabled={page * pageSize >= total || loading} onClick={() => setQuery((current) => ({ ...current, page: page + 1 }))}>Siguiente</AtlasButton></div>
      </div>

      {props.create ? (
        <ActionFormModal
          open={creating}
          icon={props.create.icon ?? 'add'}
          title={props.create.title ?? props.createLabel ?? 'Crear registro'}
          description={props.create.description}
          fields={props.create.fields}
          submitLabel={props.createLabel ?? 'Crear'}
          onClose={() => setCreating(false)}
          onSubmit={async (payload) => {
            await props.create!.submit(payload);
            setCreating(false);
            toast.success('Registro creado', 'El nuevo registro ya aparece en la tabla.');
            await resource.reload();
          }}
        />
      ) : null}

      {rowForm?.action.form ? (
        <ActionFormModal
          open
          icon={rowForm.action.form.icon ?? rowForm.action.icon ?? 'edit'}
          title={rowForm.action.form.title ? rowForm.action.form.title(rowForm.row) : rowForm.action.label}
          description={rowForm.action.form.description}
          fields={typeof rowForm.action.form.fields === 'function' ? rowForm.action.form.fields(rowForm.row) : rowForm.action.form.fields}
          submitLabel={rowForm.action.form.submitLabel ?? rowForm.action.label}
          onClose={() => setRowForm(null)}
          onSubmit={async (payload) => {
            const { action, row } = rowForm;
            await action.form!.submit(row, payload);
            setRowForm(null);
            toast.success('Operación registrada', `${action.label} se completó correctamente.`);
            await resource.reload();
          }}
        />
      ) : null}

      {pending ? (
        <ConfirmDialog
          open
          title={pending.action.confirm!.title}
          message={pending.action.confirm!.message}
          confirmLabel={pending.action.confirm!.confirmLabel}
          tone={pending.action.confirm!.tone}
          loading={busy}
          onCancel={() => { if (!busy) setPending(null); }}
          onConfirm={async () => { setBusy(true); await runAction(pending.action, pending.row); setBusy(false); setPending(null); }}
        />
      ) : null}
    </div>
  );
}

function TableSkeleton({ columns }: { columns: number }) {
  return <div className="space-y-0"><div className="h-11 animate-pulse border-b border-slate-200 bg-slate-100" />{Array.from({ length: 8 }, (_, row) => <div key={row} className="grid h-12 animate-pulse items-center gap-4 border-b border-slate-100 px-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(80px, 1fr))` }}>{Array.from({ length: columns }, (_, column) => <span key={column} className="h-3 rounded bg-slate-100" />)}</div>)}</div>;
}
