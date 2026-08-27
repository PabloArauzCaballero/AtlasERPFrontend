import type { PageQuery, PaginatedResult, ResourceRow } from '@/services/types';

/**
 * Recorre un listado paginado hasta traerlo entero.
 *
 * Estas tablas prometen «todos los registros», pero los endpoints del ERP topan `pageSize` en 100:
 * pedir 300 no devuelve 300, devuelve un 400 de validación y la tabla se queda vacía sin decir por
 * qué. Así que se piden páginas hasta agotar el total en vez de pedir un número grande y confiar.
 *
 * `maxPaginas` es un tope de seguridad: si el backend dejara de menguar la página, esto pararía en
 * vez de girar para siempre.
 */
export async function cargarTodo(
  pedir: (query: PageQuery) => Promise<PaginatedResult<ResourceRow>>,
  pageSize = 100,
  maxPaginas = 25,
): Promise<PaginatedResult<ResourceRow>> {
  const acumulado: ResourceRow[] = [];
  let total = 0;

  for (let page = 1; page <= maxPaginas; page += 1) {
    const resultado = await pedir({ page, pageSize, limit: pageSize });
    const items = resultado.items ?? resultado.rows ?? [];
    acumulado.push(...items);
    total = Number(resultado.total ?? acumulado.length);
    if (items.length < pageSize || acumulado.length >= total) break;
  }

  return { items: acumulado, total: total || acumulado.length };
}
