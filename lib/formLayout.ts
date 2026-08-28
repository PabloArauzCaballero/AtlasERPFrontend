/**
 * Reparto de los campos de un formulario en su rejilla, sin filas a medio llenar.
 *
 * Las pantallas declaran `span` por campo pensando en «este ocupa dos columnas». Con una rejilla
 * de tres, un campo de dos deja un tercio muerto a su derecha, y el siguiente —si tampoco cabe—
 * salta de fila: es el escalonado que se veía en el alta de campaña, con huecos a la derecha del
 * anunciante y de las dos fechas. El `span` declarado dice la INTENCIÓN (ancho, medio, estrecho);
 * lo que aquí se calcula es el ancho REAL para que ninguna fila quede corta.
 *
 * El reparto se hace por separado para cada número de columnas del diseño responsivo, porque las
 * clases de Tailwind son estáticas y una misma lista se acomoda distinto en dos columnas que en
 * tres.
 */

export type FieldSpan = 1 | 2 | 3;

/** Anchos reales de cada campo en una rejilla de `columns` columnas: toda fila suma `columns`. */
export function fitSpans(spans: Array<number | undefined>, columns: number): number[] {
  const result = spans.map((span) => Math.min(Math.max(span ?? 1, 1), columns));
  if (!result.length) return result;

  /** Reparte lo que sobra de una fila entre sus campos, empezando por el último. */
  const cerrarFila = (start: number, end: number, used: number) => {
    let hueco = columns - used;
    let index = end - 1;
    while (hueco > 0 && index >= start) {
      result[index] = (result[index] ?? 1) + 1;
      hueco -= 1;
      index = index - 1 < start ? end - 1 : index - 1;
    }
  };

  let start = 0;
  let used = 0;
  for (let i = 0; i < result.length; i += 1) {
    if (used + result[i]! > columns) {
      cerrarFila(start, i, used);
      start = i;
      used = 0;
    }
    used += result[i]!;
  }
  cerrarFila(start, result.length, used);
  return result;
}

const CLASES_SM = ['', 'sm:col-span-1', 'sm:col-span-2', 'sm:col-span-2'];
const CLASES_MD = ['', 'md:col-span-1', 'md:col-span-2', 'md:col-span-2'];
const CLASES_XL = ['', 'xl:col-span-1', 'xl:col-span-2', 'xl:col-span-3'];

/**
 * Clases de rejilla para una lista de campos, en el mismo orden.
 *
 * `breakpoint` distingue las dos rejillas que usa el ERP: la de los formularios sueltos
 * (`sm:grid-cols-2 xl:grid-cols-3`) y la de los formularios por secciones (`md:` en vez de `sm:`).
 * `maxColumns` a 2 es para el modal, que nunca llega a tres.
 */
export function fieldSpanClasses(
  spans: Array<number | undefined>,
  options: { breakpoint?: 'sm' | 'md'; maxColumns?: 2 | 3 } = {},
): string[] {
  const dos = fitSpans(spans, 2);
  const clasesDos = options.breakpoint === 'md' ? CLASES_MD : CLASES_SM;
  if (options.maxColumns === 2) return dos.map((span) => clasesDos[span] ?? '');
  const tres = fitSpans(spans, 3);
  return dos.map((span, index) => `${clasesDos[span] ?? ''} ${CLASES_XL[tres[index]!] ?? ''}`.trim());
}
