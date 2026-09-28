import type { ResourceRow } from '@/services/types';

/**
 * Filas de una respuesta de listado, venga como lista o como página (`{ items }`).
 *
 * Una pantalla no puede caerse por la forma de la respuesta: con `.forEach` sobre una página, el
 * tablero del pipeline tumbaba la pantalla entera («Application error»), y la ficha de la cuenta
 * igual con `.some`. Cualquier otra forma cuenta como «sin filas».
 */
export function asRows(value: unknown): ResourceRow[] {
  if (Array.isArray(value)) return value as ResourceRow[];
  const items = (value as { items?: unknown } | null | undefined)?.items;
  return Array.isArray(items) ? (items as ResourceRow[]) : [];
}
