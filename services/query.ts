import type { PageQuery } from './types';

interface QueryOptions {
  pageSizeKey: 'limit' | 'pageSize';
  defaultPageSize?: number;
  allowedKeys?: readonly string[] | undefined;
}

function hasAllowedKey(key: string, allowedKeys?: readonly string[]): boolean {
  return !allowedKeys || allowedKeys.includes(key);
}

/**
 * Normaliza paginación por contrato real del backend.
 * B2B/Ads usan limit; Contabilidad/Auditoría usan pageSize.
 */
export function buildBackendQuery(query: PageQuery, options: QueryOptions): PageQuery {
  const page = query.page ?? 1;
  const selectedPageSize = query.pageSize ?? query.limit ?? options.defaultPageSize ?? 25;
  const normalizedQuery: PageQuery = { page };

  if (options.pageSizeKey === 'limit') normalizedQuery.limit = selectedPageSize;
  if (options.pageSizeKey === 'pageSize') normalizedQuery.pageSize = selectedPageSize;

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === '') return;
    if (['page', 'limit', 'pageSize'].includes(key)) return;
    if (!hasAllowedKey(key, options.allowedKeys)) return;
    normalizedQuery[key] = value;
  });

  return normalizedQuery;
}
