import { maskPii } from '@/lib/formatters';
import type { ResourceRow } from '@/services/types';
import { SkeletonBlock } from './LoadingIndicator';

interface DataTableProps {
  columns: string[];
  isLoading?: boolean;
  rows: ResourceRow[];
}

function toDisplayValue(row: ResourceRow, column: string): string {
  const value = row[column];
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return maskPii(value, column);
}

function LoadingRows({ columns }: { columns: string[] }) {
  return Array.from({ length: 6 }).map((_, rowIndex) => (
    <tr className="border-t border-border-subtle" key={rowIndex}>
      {columns.map((column, columnIndex) => (
        <td className="px-3 py-2" key={`${column}-${columnIndex}`}>
          <SkeletonBlock className="h-5 w-full min-w-20" />
        </td>
      ))}
    </tr>
  ));
}

export function DataTable({ columns, isLoading = false, rows }: DataTableProps) {
  if (rows.length === 0 && !isLoading) return null;

  return (
    <div aria-busy={isLoading} className="table-scroll rounded-xl border border-border-subtle bg-surface">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-surface-muted text-xs uppercase tracking-wide text-outline">
          <tr>{columns.map((column) => <th className="whitespace-nowrap px-3 py-2" key={column}>{column}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr className="border-t border-border-subtle" key={String(row.id ?? index)}>
              {columns.map((column) => (
                <td className="max-w-72 truncate px-3 py-2" key={column}>{typeof row[column] === 'object' && row[column] !== null && '$$typeof' in (row[column] as object) ? row[column] as React.ReactNode : toDisplayValue(row, column)}</td>
              ))}
            </tr>
          ))}
          {isLoading && rows.length === 0 ? <LoadingRows columns={columns} /> : null}
        </tbody>
      </table>
    </div>
  );
}
