import type { ScreenGuide } from '../tutorial-types';
import { GUIAS_ADS } from './guias-ads';
import { GUIAS_CONTABILIDAD } from './guias-contabilidad';
import { GUIAS_CONTROL } from './guias-control';
import { GUIAS_CRM } from './guias-crm';
import { GUIAS_PORTAL } from './guias-portal';

/** Todas las guías de pantalla, indexadas por ruta. */
export const SCREEN_GUIDES: Readonly<Record<string, ScreenGuide>> = {
  ...GUIAS_CONTROL,
  ...GUIAS_CRM,
  ...GUIAS_CONTABILIDAD,
  ...GUIAS_ADS,
  ...GUIAS_PORTAL,
};

/**
 * Guía de una ruta: coincidencia exacta y, si no la hay, el prefijo más largo.
 *
 * El prefijo importa porque hay rutas que no están en el índice y no deberían
 * quedarse mudas: una ficha con parámetros, una subpantalla que se añada mañana.
 * Cae en la guía de su listado, que es imprecisa pero cierta, en vez de no
 * ofrecer ayuda —que es lo que hace que la gente deje de buscarla—.
 */
export function resolveGuide(pathname: string): ScreenGuide | null {

  const exact = SCREEN_GUIDES[pathname];
  if (exact) return exact;
  const key = Object.keys(SCREEN_GUIDES)
    .filter((path) => pathname.startsWith(`${path}/`))
    .sort((a, b) => b.length - a.length)[0];
  return key ? SCREEN_GUIDES[key]! : null;
}

/** Cuántas vistas tienen guía. Lo usa el Centro para decir de qué tamaño es la ayuda. */
export function guideCount(): number {
  return Object.keys(SCREEN_GUIDES).length;
}
