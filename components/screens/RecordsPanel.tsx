'use client';

import { useCallback, useMemo } from 'react';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import type { PaginatedResult, ResourceRow } from '@/services/types';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { formatBob, formatDate, maskPii } from '@/lib/formatters';
import { downloadCsv } from '@/lib/csv';

/**
 * Panel de «lo que ya existe»: un resumen (KPIs) más una tabla de los registros de la pantalla.
 *
 * Nace para que cada pestaña —no solo los directorios— responda «¿qué hay aquí?» antes de pedir
 * una acción. Deriva las columnas de los propios datos (con formato de dinero/fecha/estado por
 * heurística) para funcionar sobre cualquier servicio sin cablear el esquema campo a campo.
 */
type Cell = { key: string; label: string; kind: 'text' | 'money' | 'date' | 'status' | 'list' | 'pii' };

interface RecordsPanelProps {
  title: string;
  /** Servicio de carga: acepta un array plano o un resultado paginado. */
  load: () => Promise<ResourceRow[] | PaginatedResult<ResourceRow>>;
  /** Texto guía cuando no hay registros. */
  emptyHint?: string;
  /** Máximo de columnas a mostrar (por defecto 7). */
  maxColumns?: number;
}

const NOISE_KEYS = new Set([
  'id', 'uuid', 'tenantid', 'tenant_id', 'accountid', 'account_id', 'owneruserid', 'owner_user_id',
  'createdbyuserid', 'updatedbyuserid', 'territoryid', 'archivedat', 'archived_at',
]);

const MONEY_HINT = /(amount|volume|revenue|monto|total|price|importe|mdr|saldo|balance|comision|comisi)/i;
const DATE_HINT = /(date|_at$|fecha|vencim|emis|firma|inicio|fin$)/i;
const STATUS_HINT = /(status|estado|stage|etapa|state|lifecycle|situacion)/i;

function prettify(key: string): string {
  const spaced = key.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function classify(key: string): Cell['kind'] {
  const lower = key.toLowerCase();
  if (/(taxid|nit|email|phone|telefono|ci|carnet|document)/i.test(lower)) return 'pii';
  if (STATUS_HINT.test(lower)) return 'status';
  if (MONEY_HINT.test(lower)) return 'money';
  if (DATE_HINT.test(lower)) return 'date';
  return 'text';
}

function rowsFrom(data: ResourceRow[] | PaginatedResult<ResourceRow> | null): ResourceRow[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items ?? data.rows ?? [];
}

function deriveColumns(rows: ResourceRow[], maxColumns: number): Cell[] {
  const seen = new Map<string, boolean>();
  for (const row of rows.slice(0, 25)) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) seen.set(key, true);
    }
  }
  const keys = [...seen.keys()].filter((key) => {
    const lower = key.toLowerCase();
    if (NOISE_KEYS.has(lower)) return false;
    const value = rows.find((row) => row[key] !== null && row[key] !== undefined)?.[key];
    return typeof value !== 'object' || Array.isArray(value); // descarta objetos anidados
  });
  // Prioriza nombre/estado/fechas/dinero para que lo primero que se vea sea legible.
  const priority = (key: string) => {
    const lower = key.toLowerCase();
    if (/(name|nombre|numero|number|code|codigo|titulo|title)/i.test(lower)) return 0;
    if (STATUS_HINT.test(lower)) return 1;
    if (MONEY_HINT.test(lower)) return 2;
    if (DATE_HINT.test(lower)) return 3;
    return 4;
  };
  return keys
    .sort((a, b) => priority(a) - priority(b))
    .slice(0, maxColumns)
    .map((key) => ({ key, label: prettify(key), kind: Array.isArray(rows[0]?.[key]) ? 'list' : classify(key) }));
}

function cellNode(row: ResourceRow, cell: Cell) {
  const raw = row[cell.key];
  if (cell.kind === 'status') {
    const text = String(raw ?? '—').replaceAll('_', ' ');
    const upper = String(raw ?? '').toUpperCase();
    const tone = /ACTIVE|APPROV|SUCCESS|PAID|SIGNED|COMPLET/.test(upper) ? 'success'
      : /PEND|REVIEW|DRAFT|OPEN|PROGRESS/.test(upper) ? 'warning'
        : /REJECT|BLOCK|FAIL|DEFAULT|OVERDUE|CANCEL/.test(upper) ? 'danger' : 'neutral';
    return <StatusPill tone={tone}>{text}</StatusPill>;
  }
  if (cell.kind === 'money') return formatBob(Number(raw ?? 0));
  if (cell.kind === 'date') return formatDate(typeof raw === 'string' ? raw : undefined);
  if (cell.kind === 'pii') return maskPii(raw, cell.key);
  if (cell.kind === 'list') return Array.isArray(raw) && raw.length ? raw.join(', ') : '—';
  return String(raw ?? '—');
}

function cellText(row: ResourceRow, cell: Cell): string {
  const raw = row[cell.key];
  if (cell.kind === 'money') return formatBob(Number(raw ?? 0));
  if (cell.kind === 'date') return formatDate(typeof raw === 'string' ? raw : undefined);
  if (cell.kind === 'pii') return maskPii(raw, cell.key);
  if (cell.kind === 'list') return Array.isArray(raw) && raw.length ? raw.join('; ') : '';
  if (cell.kind === 'status') return String(raw ?? '').replaceAll('_', ' ');
  return raw === null || raw === undefined ? '' : String(raw);
}

export function RecordsPanel(props: RecordsPanelProps) {
  const loader = useCallback(() => props.load(), [props]);
  const resource = useAsyncResource(loader);
  const rows = useMemo(() => rowsFrom(resource.data), [resource.data]);
  const columns = useMemo(() => deriveColumns(rows, props.maxColumns ?? 7), [rows, props.maxColumns]);
  const loading = resource.status === 'loading' || resource.status === 'idle';

  // Resumen: total + reparto por el primer campo de estado que exista.
  const statusColumn = columns.find((column) => column.kind === 'status');
  const statusCounts = useMemo(() => {
    if (!statusColumn) return [] as Array<{ label: string; count: number }>;
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = String(row[statusColumn.key] ?? 'SIN ESTADO').replaceAll('_', ' ');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 3);
  }, [rows, statusColumn]);

  const exportCsv = useCallback(() => {
    if (!rows.length) return;
    const slug = props.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    downloadCsv(`${slug || 'registros'}.csv`, columns.map((column) => ({ key: column.key, label: column.label })), rows, (row, key) => {
      const column = columns.find((item) => item.key === key);
      return column ? cellText(row as ResourceRow, column) : '';
    });
  }, [rows, columns, props.title]);

  const tones = ['teal', 'amber', 'purple'] as const;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Registros" value={loading ? '—' : rows.length.toLocaleString('es-BO')} detail={props.title} icon="table_rows" tone="navy" />
        {statusCounts.map((entry, index) => (
          <MetricCard key={entry.label} label={entry.label} value={entry.count} detail="En este listado" icon="donut_large" tone={tones[index] ?? 'teal'} />
        ))}
      </div>

      <Panel
        title={props.title}
        icon="table_view"
        action={
          <div className="flex items-center gap-2">
            <AtlasButton variant="secondary" icon="download" disabled={!rows.length} onClick={exportCsv}>Exportar CSV</AtlasButton>
            <AtlasButton variant="secondary" icon="refresh" loading={loading} onClick={resource.reload}>Actualizar</AtlasButton>
          </div>
        }
      >
        {resource.error && !rows.length ? <InlineNotice tone="danger" title="No se pudo cargar el listado">{resource.error}</InlineNotice> : null}
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500">
              <tr>{columns.map((column) => <th key={column.key} className="border-b border-slate-200 px-3 py-2.5 font-bold">{column.label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.slice(0, 50).map((row, index) => (
                <tr key={String(row.id ?? index)} className="hover:bg-slate-50/80">
                  {columns.map((column) => <td key={column.key} className="whitespace-nowrap px-3 py-2.5 text-slate-700">{cellNode(row, column)}</td>)}
                </tr>
              ))}
              {!rows.length && !loading ? (
                <tr><td colSpan={Math.max(columns.length, 1)} className="px-6 py-10 text-center"><Icon name="inbox" className="text-[30px] text-slate-400" /><p className="mt-2 font-bold text-slate-700">Todavía no hay registros</p><p className="mt-1 text-xs text-slate-500">{props.emptyHint ?? 'Usa el formulario de abajo para crear el primero.'}</p></td></tr>
              ) : null}
              {loading && !rows.length ? (
                <tr><td colSpan={Math.max(columns.length, 1)} className="px-6 py-10 text-center text-xs text-slate-500">Cargando registros…</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {rows.length > 50 ? <p className="mt-2 text-[11px] text-slate-500">Mostrando los primeros 50 de {rows.length}. Usa «Exportar CSV» para el detalle completo.</p> : null}
      </Panel>
    </div>
  );
}
