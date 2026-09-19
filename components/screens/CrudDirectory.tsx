'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import Link from 'next/link';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { ConfirmDialog } from '@/components/atlas/ConfirmDialog';
import { FieldLabel } from '@/components/atlas/FieldLabel';
import { useFieldHelp } from '@/components/atlas/FieldTooltip';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { downloadCsv } from '@/lib/csv';
import { descargarPdf, nombreArchivoPdf, tablaPdf } from '@/lib/pdf';
import { Modal } from '@/components/atlas/Modal';
import { ActionFormModal } from './ActionFormModal';
import { formatBob, formatDate, maskPii, statusTone } from '@/lib/formatters';
import { toast } from '@/lib/toast';
import type { ActionField } from './StructuredActionForm';
import type { JsonObject, PaginatedResult, ResourceRow } from '@/services/types';

/** Qué hace la caja de búsqueda; el ⓘ lo pinta `FieldLabel` como en cualquier otro campo. */
const TOOLTIP_BUSQUEDA = 'Escribe cualquier parte de un dato y la tabla se queda sólo con las filas que lo contienen.';

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
  /** Qué filtra y por qué; si falta, se genera a partir de la etiqueta. */
  tooltip?: string | undefined;
  options?: Array<{ label: string; value: string }> | undefined;
  placeholder?: string | undefined;
}

export interface CrudExtraAction {
  key: string;
  label: string;
  icon: string;
  tone?: 'default' | 'danger' | 'success' | undefined;
  /** Acción que llama al backend y recarga la tabla. Excluyente con `href` y con `form`. */
  run?: ((row: ResourceRow) => Promise<unknown>) | undefined;
  /**
   * `run` sólo abre algo (un modal propio de la pantalla) y no registra nada todavía: sin aviso de
   * «Operación registrada» ni recarga. Hasta el 2026-09-16 abrir el modal de evidencia ya
   * anunciaba una operación que aún no había ocurrido.
   */
  silent?: boolean | undefined;
  /** Enlace a otra pantalla (ficha, detalle). Excluyente con `run`. */
  href?: ((row: ResourceRow) => string) | undefined;
  /**
   * Acción que necesita datos antes de ejecutarse: abre un modal sobre la fila.
   *
   * Es lo que sustituye a las pestañas «registrar pago», «confirmar pago» o «postear al mayor»:
   * la operación se lanza desde la fila a la que se aplica, y el formulario ya sabe sobre qué
   * registro trabaja en vez de pedir su identificador en un desplegable.
   */
  form?: {
    title?: ((row: ResourceRow) => string) | undefined;
    /**
     * Función cuando el texto depende de la fila: «este comercio ya tiene 2 accesos» sólo se puede
     * escribir mirándola, y ese dato es lo que evita pedir dos veces lo mismo.
     */
    description?: string | ((row: ResourceRow) => string) | undefined;
    /** Función cuando los valores por defecto salen de la propia fila (el saldo abierto, p. ej.). */
    fields: ActionField[] | ((row: ResourceRow) => ActionField[]);
    submit: (row: ResourceRow, payload: JsonObject) => Promise<unknown>;
    submitLabel?: string | undefined;
  } | undefined;
  confirm?: { title: string; message: string; confirmLabel?: string | undefined } | undefined;
  /** Oculta la acción en las filas donde no aplica. */
  enabled?: ((row: ResourceRow) => boolean) | undefined;
  /**
   * Se queda en la fila, con su icono. Las demás caen en «Más acciones».
   *
   * Sin esto, cada acción aplicable pintaba un icono suelto en el carril derecho: Onboarding
   * llegaba a SIETE cuadraditos sin una palabra, uno al lado de otro, y saber cuál activaba el
   * comercio y cuál pedía la verificación al Motor exigía apuntar con el ratón a cada uno. El
   * carril no da para más de tres; lo que no cabe se lee mejor con su nombre en una lista.
   *
   * Sin ninguna marcada, se quedan en la fila las tres primeras: un valor por defecto razonable
   * para las pantallas que sólo tienen dos o tres y nunca pensaron en esto.
   */
  primary?: boolean | undefined;
}

/** Acción de la barra superior que no cuelga de ninguna fila (un proceso del período, por ejemplo). */
export interface CrudToolbarAction {
  key: string;
  label: string;
  icon: string;
  title?: string | undefined;
  description?: string | undefined;
  fields: ActionField[];
  submit: (payload: JsonObject) => Promise<unknown>;
  submitLabel?: string | undefined;
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
    /**
     * Alta en su propia página (`…/crear`): para las que llevan líneas dinámicas o columna lateral y
     * no caben en un modal. Sustituye al antiguo `onClick`, que sólo servía para saltar a una
     * pestaña de alta —un verbo metido en la barra de secciones— y se quitó para que no vuelva.
     */
    href?: string | undefined;
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
  toolbarActions?: CrudToolbarAction[] | undefined;
  /**
   * Qué conviene saber de esta pantalla. `info` NO se pinta: vive tras el icono ⓘ de la barra.
   * `warning` sí ocupa sitio, porque señala algo que hay que resolver, no algo que leer.
   */
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
    return <StatusPill tone={statusTone(text)}>{text.replaceAll('_', ' ')}</StatusPill>;
  }
  if (column.kind === 'bool') return <StatusPill tone={raw ? 'success' : 'neutral'} dot={false}>{raw ? 'Sí' : 'No'}</StatusPill>;
  if (column.kind === 'money') return formatBob(Number(raw ?? 0));
  if (column.kind === 'date') return formatDate(typeof raw === 'string' ? raw : undefined);
  if (column.kind === 'pii') return maskPii(raw, column.key);
  if (column.kind === 'list') return Array.isArray(raw) && raw.length ? raw.join(', ') : '—';
  return <span className={column.kind === 'mono' ? 'font-mono text-[11px]' : ''}>{String(raw ?? '—')}</span>;
}

/**
 * Listado completo con filtros, alta y edición/borrado en la propia fila.
 *
 * Reemplaza la pareja «formulario arriba + tabla debajo» que tenían estas pantallas. Ahí lo
 * primero que se veía era un formulario de alta, y para saber qué había registrado —que es la
 * pregunta que se hace uno al entrar— tocaba bajar. Aquí la tabla es la pantalla: el alta es un
 * botón, y modificar o eliminar son el lápiz y la papelera de la fila que se está mirando.
 */
/** Las acciones que aplican a esta fila, en el orden en que se declararon. */
function aplicables(acciones: CrudExtraAction[], row: ResourceRow): CrudExtraAction[] {
  return acciones.filter((accion) => (accion.enabled ? accion.enabled(row) : true));
}

/**
 * Lo que se queda en el carril de la fila: como mucho TRES.
 *
 * Tres es lo que cabe junto al lápiz y la papelera sin que la columna empuje a la tabla a
 * desplazarse, y es también donde un icono sin texto deja de ser reconocible: con siete, elegir
 * exige apuntar a cada uno y leer su globo.
 */
function enCarril(acciones: CrudExtraAction[], row: ResourceRow): CrudExtraAction[] {
  const vivas = aplicables(acciones, row);
  const marcadas = vivas.filter((accion) => accion.primary);
  return (marcadas.length ? marcadas : vivas).slice(0, 3);
}

/** Lo que va al cajón «Más acciones», con su nombre escrito. */
function enCajon(acciones: CrudExtraAction[], row: ResourceRow): CrudExtraAction[] {
  const vivas = aplicables(acciones, row);
  const carril = new Set(enCarril(acciones, row).map((accion) => accion.key));
  return vivas.filter((accion) => !carril.has(accion.key));
}

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
  const [extraForm, setExtraForm] = useState<{ action: CrudExtraAction; row: ResourceRow } | null>(null);
  const [toolbarForm, setToolbarForm] = useState<CrudToolbarAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  /* La explicación de la pantalla, abierta desde el icono ⓘ: no ocupa sitio fijo. */
  const [explicacionAbierta, setExplicacionAbierta] = useState(false);

  const filters = useMemo(() => props.filters ?? [], [props.filters]);

  /*
   * La búsqueda es un campo como los demás, no un `<input>` suelto.
   *
   * Lo era hasta el 2026-09-19, y por serlo se rompía de dos formas a la vez: su fila de etiqueta
   * medía 16 px en vez de los 24 px de `FieldLabel` —que lleva el ⓘ—, así que con `items-end` el
   * texto «Buscar» quedaba 4 px por debajo del de «Tipo»; y al no pasar por `FormField` se libraba
   * del guardián `check-ayuda.mjs`, así que era el ÚNICO campo del ERP sin ayuda. No usa
   * `FormField` porque necesita la lupa dentro del control, pero sí sus piezas.
   */
  const busquedaId = useId();
  const ayudaBusqueda = useFieldHelp(TOOLTIP_BUSQUEDA);

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

  /** La fila cuyo cajón de acciones está abierto. */
  const [masAcciones, setMasAcciones] = useState<ResourceRow | null>(null);

  async function launchExtra(action: CrudExtraAction, row: ResourceRow) {
    if (action.form) { setActionError(''); setExtraForm({ action, row }); return; }
    if (!action.run) return;
    if (action.confirm) { setPendingExtra({ action, row }); return; }
    setActionError('');
    try {
      await action.run(row);
      if (action.silent) return;
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
      {props.notice && props.notice.tone === 'info' ? (
        <AtlasButton
          variant="secondary"
          icon="info"
          className="w-9 px-0"
          data-testid="crud-explicacion"
          aria-label={props.notice.title}
          title={props.notice.title}
          onClick={() => setExplicacionAbierta(true)}
        />
      ) : null}
      <AtlasButton variant="secondary" icon="picture_as_pdf" data-testid="crud-pdf" loading={generandoPdf} disabled={!filteredRows.length} onClick={() => void exportarPdf()}>PDF</AtlasButton>
      <AtlasButton variant="secondary" icon="download" disabled={!filteredRows.length} onClick={exportCsv}>CSV</AtlasButton>
      <AtlasButton variant="secondary" icon="refresh" loading={loading} onClick={resource.reload}>Actualizar</AtlasButton>
      {(props.toolbarActions ?? []).map((action) => (
        <AtlasButton key={action.key} variant="secondary" icon={action.icon} data-testid={`crud-accion-${action.key}`} onClick={() => { setActionError(''); setToolbarForm(action); }}>{action.label}</AtlasButton>
      ))}
      {create?.href ? (
        <Link href={create.href} data-testid="crud-crear" data-tutorial-id="directory-create" className="inline-flex">
          <AtlasButton icon="add" tabIndex={-1}>{create.label ?? 'Crear'}</AtlasButton>
        </Link>
      ) : create ? (
        <AtlasButton icon="add" data-testid="crud-crear" onClick={() => setCreating(true)}>{create.label ?? 'Crear'}</AtlasButton>
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

      {/*
        * Sólo el aviso que señala un PROBLEMA ocupa sitio en la pantalla.
        *
        * La explicación de la vista se leía una vez y estorbaba siempre, en las veinte pantallas que
        * la pasan; además la cabecera ya trae «¿Qué es esto?». Ahora vive tras el icono ⓘ de la
        * barra, como el contexto de las propuestas. Un `warning` sí se queda: no es información de
        * consulta, es algo que hay que resolver.
        */}
      {props.notice && props.notice.tone !== 'info' ? (
        <InlineNotice tone={props.notice.tone} title={props.notice.title}>{props.notice.body}</InlineNotice>
      ) : null}
      {props.notice && props.notice.tone === 'info' ? (
        <Modal open={explicacionAbierta} title={props.notice.title} icon="info" width="md" onClose={() => setExplicacionAbierta(false)}>
          <p className="text-sm leading-relaxed text-slate-600">{props.notice.body}</p>
        </Modal>
      ) : null}
      {actionError ? <InlineNotice tone="danger" title="No se pudo completar la operación">{actionError}</InlineNotice> : null}
      {resource.error && !rows.length ? <InlineNotice tone="danger" title="No se pudo cargar el listado">{resource.error}</InlineNotice> : null}

      <Panel compact data-tutorial-id="crud-filtros">
        {/*
          * La fila DOBLA, y la búsqueda tiene un suelo.
          *
          * Antes era `lg:flex-row` sin `flex-wrap` y la búsqueda era el único hijo con `flex-1`
          * —es decir, base 0—: cuando los filtros y «Limpiar» no cabían, flexbox descuenta el
          * faltante en proporción a la base, así que TODO el déficit caía sobre la búsqueda y se
          * quedaba en 0 px mientras los filtros conservaban sus 192. Medido el 2026-09-19 con la
          * hoja del propio ERP: con 3 filtros la caja valía 0 px a 1024 y 105 px a 1152; con 4
          * (Business partners) valía 0 px hasta 1152 y 29 px a 1280. Y como la etiqueta no se
          * recorta, «Buscar» se desbordaba encima de «Tipo»: eso es el pisotón de la captura.
          *
          * El suelo va en `min-width` y NO en `basis`: `flex-1` ya fija `flex-basis: 0%` y en el
          * orden de utilidades de Tailwind gana a `lg:basis-*` (probado: seguía colapsando a 8 px).
          * `lg:min-w-64` tampoco existe en Tailwind 3 —sólo `min-w-0|full|min|max|fit`—, así que
          * es un valor arbitrario a propósito. Con esto la búsqueda nunca baja de 288 px y lo que
          * cede es la fila, que pasa a dos o tres líneas.
          */}
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="block min-w-0 flex-1 lg:min-w-[16rem]">
            <FieldLabel
              htmlFor={busquedaId}
              label="Buscar"
              tooltip={TOOLTIP_BUSQUEDA}
              describedById={ayudaBusqueda.describedById}
              controlFocused={ayudaBusqueda.focused}
            />
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-slate-400" />
              <input
                id={busquedaId}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={props.searchPlaceholder ?? 'Buscar en todas las columnas…'}
                data-testid="crud-buscar"
                aria-describedby={ayudaBusqueda.describedById}
                onFocus={ayudaBusqueda.onFocus}
                onBlur={ayudaBusqueda.onBlur}
                className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-[#006a61] focus:ring-2 focus:ring-[#006a61]/20"
              />
            </div>
          </div>

          {filters.map((filter) => (
            filter.kind === 'text' ? (
              <FormField
                key={filter.key}
                label={filter.label}
                tooltip={filter.tooltip ?? `Escribe parte del valor de «${filter.label}» para quedarte sólo con esas filas.`}
                name={`filtro-${filter.key}`}
                className="w-full lg:w-48 lg:shrink-0"
                value={filterValues[filter.key] ?? ''}
                placeholder={filter.placeholder ?? ''}
                onChange={(event) => setFilterValues((current) => ({ ...current, [filter.key]: event.target.value }))}
              />
            ) : (
              <FormField
                key={filter.key}
                kind="select"
                compact
                label={filter.label}
                tooltip={filter.tooltip ?? `Muestra sólo las filas con ese valor de «${filter.label}»; «Todos» quita el filtro.`}
                name={`filtro-${filter.key}`}
                className="w-full lg:w-48 lg:shrink-0"
                value={filterValues[filter.key] ?? ''}
                onChange={(event) => setFilterValues((current) => ({ ...current, [filter.key]: event.target.value }))}
                options={[{ label: 'Todos', value: '' }, ...(filter.options ?? derivedOptions[filter.key] ?? [])]}
              />
            )
          ))}

          <AtlasButton className="shrink-0" variant="secondary" icon="filter_alt_off" disabled={!filtersActive} onClick={() => { setSearch(''); setFilterValues({}); }}>Limpiar</AtlasButton>
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
                          {enCarril(props.extraActions ?? [], row).map((action) => {
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
                          {enCajon(props.extraActions ?? [], row).length ? (
                            <button
                              type="button"
                              title="Más acciones"
                              aria-label={`Más acciones: ${labelFor(row)}`}
                              data-testid={`mas-acciones-${id}`}
                              onClick={() => setMasAcciones(row)}
                              className="grid h-8 w-8 place-items-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                            >
                              <Icon name="more_horiz" className="text-[17px]" />
                            </button>
                          ) : null}
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
        <ActionFormModal
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
        <ActionFormModal
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

      {extraForm?.action.form ? (
        <ActionFormModal
          open
          icon={extraForm.action.icon}
          title={extraForm.action.form.title ? extraForm.action.form.title(extraForm.row) : `${extraForm.action.label}: ${labelFor(extraForm.row)}`}
          description={typeof extraForm.action.form.description === 'function' ? extraForm.action.form.description(extraForm.row) : extraForm.action.form.description}
          fields={typeof extraForm.action.form.fields === 'function' ? extraForm.action.form.fields(extraForm.row) : extraForm.action.form.fields}
          submitLabel={extraForm.action.form.submitLabel ?? extraForm.action.label}
          onClose={() => setExtraForm(null)}
          onSubmit={async (payload) => {
            const { action, row } = extraForm;
            await action.form!.submit(row, payload);
            setExtraForm(null);
            toast.success('Operación registrada', `${action.label}: ${labelFor(row)}.`);
            await resource.reload();
          }}
        />
      ) : null}

      {toolbarForm ? (
        <ActionFormModal
          open
          icon={toolbarForm.icon}
          title={toolbarForm.title ?? toolbarForm.label}
          description={toolbarForm.description}
          fields={toolbarForm.fields}
          submitLabel={toolbarForm.submitLabel ?? toolbarForm.label}
          onClose={() => setToolbarForm(null)}
          onSubmit={async (payload) => {
            const action = toolbarForm;
            await action.submit(payload);
            setToolbarForm(null);
            toast.success('Operación registrada', `${action.label} se completó correctamente.`);
            await resource.reload();
          }}
        />
      ) : null}

      {/*
        * El cajón de acciones: lo que no cabe en el carril, con su NOMBRE.
        *
        * Va en un modal y no en un desplegable anclado a la celda porque la tabla vive dentro de
        * `.table-scroll` (`overflow-x: auto`): cualquier capa posicionada dentro de la fila queda
        * recortada por ese contenedor en cuanto se sale de su ancho, que es justo lo que pasa en
        * la última columna. Un clic más, pero se lee, no se recorta y funciona en el teléfono.
        */}
      {masAcciones ? (
        <Modal
          open
          title="Más acciones"
          description={labelFor(masAcciones)}
          icon="more_horiz"
          width="md"
          onClose={() => setMasAcciones(null)}
        >
          <div className="space-y-1.5">
            {enCajon(props.extraActions ?? [], masAcciones).map((accion) => {
              const fila = masAcciones;
              const clase = 'flex w-full items-center gap-3 rounded-md border border-slate-200 px-3 py-2.5 text-left text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50';
              return accion.href ? (
                <Link key={accion.key} href={accion.href(fila)} data-testid={`accion-${accion.key}-${String(fila[idKey] ?? '')}`} className={clase} onClick={() => setMasAcciones(null)}>
                  <Icon name={accion.icon} className="text-[18px] text-slate-500" />
                  {accion.label}
                </Link>
              ) : (
                <button
                  key={accion.key}
                  type="button"
                  data-testid={`accion-${accion.key}-${String(fila[idKey] ?? '')}`}
                  className={clase}
                  onClick={() => {
                    /* Primero se cierra: el cajón y el formulario que abre la acción no pueden
                       convivir, y dejarlos apilados atrapa el foco entre los dos. */
                    setMasAcciones(null);
                    void launchExtra(accion, fila);
                  }}
                >
                  <Icon name={accion.icon} className="text-[18px] text-slate-500" />
                  {accion.label}
                </button>
              );
            })}
          </div>
        </Modal>
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
