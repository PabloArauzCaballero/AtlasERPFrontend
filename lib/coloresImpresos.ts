/**
 * Colores de lo que se IMPRIME o se descarga como imagen (el cartel del QR).
 *
 * Un `<canvas>` no lee las variables CSS del tema, y aunque las leyera no debería: el papel no
 * tiene tema oscuro. Son los valores del tema CLARO de la identidad (ESPECIFICACION-COMUN §1),
 * escritos una sola vez aquí. Este archivo y `lib/qr.ts` son las únicas excepciones de
 * `scripts/check-colores.mjs` fuera de `app/tema.css`.
 */
export const IMPRESO = {
  amarillo: '#FCEE3A',
  tinta: '#111111',
  tintaSuave: '#5C5C55',
  papel: '#FFFFFF',
  /** La caja del código a mano (`surface-sunken` claro), igual que el cartel de la app del comercio. */
  hundido: '#ECECE5',
  bordeFuerte: '#85857B',
} as const;
