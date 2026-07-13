'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type { PageQuery, PaginatedResult, ResourceRow } from '@/services/types';
import { Button } from './button';
import { Card } from './card';
import { DataTable } from './DataTable';
import { Input } from './input';
import { InlineLoading } from './LoadingIndicator';
import { ScreenState } from './ScreenState';

interface ResourceListProps {
  columns: string[];
  load: (query: PageQuery) => Promise<PaginatedResult<ResourceRow>>;
  searchPlaceholder?: string;
}

function extractRows(data: PaginatedResult<ResourceRow> | null): ResourceRow[] {
  if (!data) return [];
  return data.items ?? data.rows ?? [];
}

function getTotal(data: PaginatedResult<ResourceRow> | null, currentRows: number): number {
  return typeof data?.total === 'number' ? data.total : currentRows;
}

export function ResourceList({ columns, load, searchPlaceholder = 'Buscar' }: ResourceListProps) {
  const [isPending, startTransition] = useTransition();
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState<PageQuery>({ page: 1, limit: 25 });
  const debouncedSearch = useDebouncedValue(searchText);

  useEffect(() => {
    startTransition(() => {
      setQuery((current) => {
        const { search: _previousSearch, ...queryWithoutSearch } = current;

        if (!debouncedSearch) {
          return { ...queryWithoutSearch, page: 1 };
        }

        return { ...queryWithoutSearch, page: 1, search: debouncedSearch };
      });
    });
  }, [debouncedSearch]);

  const loader = useCallback(() => load(query), [load, query]);
  const { data, error, reload, status } = useAsyncResource(loader);
  const rows = useMemo(() => extractRows(data), [data]);
  const total = getTotal(data, rows.length);
  const pageSize = query.limit ?? query.pageSize ?? 25;
  const page = query.page ?? 1;
  const hasNextPage = total > page * pageSize;
  const hasPreviousPage = page > 1;
  const isLoading = status === 'loading' || isPending;

  function updatePageSize(nextPageSize: number): void {
    startTransition(() => {
      setQuery((current) => ({ ...current, page: 1, limit: nextPageSize, pageSize: nextPageSize }));
    });
  }

  function updatePage(nextPage: number): void {
    startTransition(() => {
      setQuery((current) => ({ ...current, page: nextPage }));
    });
  }

  return (
    <section aria-busy={isLoading} className="space-y-4">
      <Card className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Input
          aria-label="Buscar"
          onChange={(event) => setSearchText(event.target.value)}
          placeholder={searchPlaceholder}
          value={searchText}
        />
        <div className="flex flex-wrap items-center gap-2">
          {isLoading && rows.length > 0 ? <InlineLoading text="Actualizando" /> : null}
          <select
            aria-label="Registros por página"
            className="rounded-lg border border-border-subtle bg-white px-3 py-2 text-sm"
            onChange={(event) => updatePageSize(Number(event.target.value))}
            value={pageSize}
          >
            {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}/página</option>)}
          </select>
          <Button isLoading={isLoading} loadingLabel="Actualizando" onClick={reload} variant="secondary">Actualizar</Button>
        </div>
      </Card>

      <ScreenState error={error} hasData={rows.length > 0} onRetry={reload} status={status} />
      <DataTable columns={columns} isLoading={isLoading} rows={rows} />

      {status === 'success' || rows.length > 0 ? (
        <Card className="flex flex-col gap-3 text-sm text-on-surface-variant md:flex-row md:items-center md:justify-between">
          <span>Página {page} · {rows.length} visibles · {total} total</span>
          <div className="flex gap-2">
            <Button disabled={!hasPreviousPage} onClick={() => updatePage(page - 1)} variant="secondary">Anterior</Button>
            <Button disabled={!hasNextPage} onClick={() => updatePage(page + 1)} variant="secondary">Siguiente</Button>
          </div>
        </Card>
      ) : null}
    </section>
  );
}
