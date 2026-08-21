import type { TutorialListing, TutorialMeta } from './tutorial-types';
import { TUTORIALS } from './tours';

/**
 * Fichas de catálogo del Centro de Tutoriales.
 *
 * Están separadas de los pasos a propósito: el Centro necesita listar, filtrar y
 * ordenar treinta recorridos sin cargar el contenido de ninguno. Añadir un
 * tutorial es añadir su ficha aquí y su definición en un catálogo; el motor no se
 * toca.
 */
const META: readonly TutorialMeta[] = [
  {
    id: 'primeros-pasos',
    category: 'introduccion',
    level: 'basico',
    route: '/operaciones',
    estimatedMinutes: 4,
    recommended: true,
    essential: true,
  },
  {
    id: 'usar-listados',
    category: 'introduccion',
    level: 'basico',
    route: '/operaciones/crm/cuentas',
    estimatedMinutes: 3,
    recommended: true,
    essential: true,
    prerequisites: ['primeros-pasos'],
  },
  {
    id: 'crm-cuentas',
    category: 'crm',
    level: 'basico',
    route: '/operaciones/crm/cuentas',
    estimatedMinutes: 6,
    recommended: true,
    prerequisites: ['usar-listados'],
  },
  {
    id: 'crm-pipeline',
    category: 'crm',
    level: 'intermedio',
    route: '/operaciones/crm/oportunidades',
    estimatedMinutes: 4,
    prerequisites: ['crm-cuentas'],
  },
  {
    id: 'crm-onboarding',
    category: 'crm',
    level: 'avanzado',
    route: '/operaciones/crm/onboarding',
    estimatedMinutes: 5,
    prerequisites: ['crm-pipeline'],
  },
  {
    id: 'contabilidad-cuentas-gl',
    category: 'contabilidad',
    level: 'basico',
    route: '/operaciones/contabilidad/cuentas-gl',
    estimatedMinutes: 5,
    recommended: true,
  },
  {
    id: 'contabilidad-documento',
    category: 'contabilidad',
    level: 'intermedio',
    route: '/operaciones/contabilidad/documentos',
    estimatedMinutes: 6,
    prerequisites: ['contabilidad-cuentas-gl'],
  },
  {
    id: 'carga-masiva',
    category: 'contabilidad',
    level: 'intermedio',
    route: '/operaciones/crm/bulk-cuentas',
    estimatedMinutes: 4,
    prerequisites: ['usar-listados'],
  },
  {
    id: 'ads-campanas',
    category: 'ads',
    level: 'basico',
    route: '/operaciones/ads/campanas',
    estimatedMinutes: 4,
    recommended: true,
  },
  {
    id: 'control-usuarios',
    category: 'control',
    level: 'intermedio',
    route: '/operaciones/admin/seguridad',
    estimatedMinutes: 4,
  },
  {
    id: 'control-auditoria',
    category: 'control',
    level: 'intermedio',
    route: '/operaciones/auditoria/business-actions',
    estimatedMinutes: 3,
  },
  {
    id: 'portal-primeros-pasos',
    category: 'portal',
    level: 'basico',
    route: '/portal-comercio/planes',
    estimatedMinutes: 3,
    recommended: true,
    essential: true,
  },
  {
    id: 'portal-bnpl',
    category: 'portal',
    level: 'basico',
    route: '/portal-comercio/compras-bnpl',
    estimatedMinutes: 3,
    prerequisites: ['portal-primeros-pasos'],
  },
];

export const TUTORIAL_META: Readonly<Record<string, TutorialMeta>> = Object.fromEntries(
  META.map((meta) => [meta.id, meta]),
);

export function tutorialMeta(id: string): TutorialMeta | null {
  return TUTORIAL_META[id] ?? null;
}

/** Título legible. Cae al id si el recorrido no existe, para no mentir. */
export function tutorialTitle(id: string): string {
  return TUTORIALS[id]?.title ?? id;
}

/**
 * ¿Es un recorrido de la consola interna o del portal del comercio?
 *
 * Se deriva de la ruta y no de una lista aparte: las dos poblaciones ya están
 * separadas por el enrutador (`RequireAuth audience`), y duplicar aquí esa
 * decisión crearía una segunda fuente de verdad capaz de ofrecerle a un comercio
 * un recorrido sobre una pantalla que su sesión no puede ni abrir.
 */
export function audienceOf(meta: TutorialMeta): 'internal' | 'merchant' | 'any' {
  if (!meta.route) return 'any';
  if (meta.route.startsWith('/portal-comercio')) return 'merchant';
  if (meta.route.startsWith('/operaciones')) return 'internal';
  return 'any';
}

function toListing(meta: TutorialMeta): TutorialListing | null {
  const tutorial = TUTORIALS[meta.id];
  if (!tutorial) return null;
  return {
    ...meta,
    title: tutorial.title,
    intro: tutorial.intro,
    version: tutorial.version,
    stepCount: tutorial.steps.length,
  };
}

/** Catálogo completo con fichas, sin filtrar. */
export function allListings(): TutorialListing[] {
  return META.map(toListing).filter((entry): entry is TutorialListing => entry !== null);
}

/** Lo que ve ESTA población: nadie recibe un recorrido que no puede abrir. */
export function listingsForAudience(audience: 'internal' | 'merchant'): TutorialListing[] {
  return allListings().filter((listing) => {
    const scope = audienceOf(listing);
    return scope === 'any' || scope === audience;
  });
}

/**
 * Prerrequisitos que el usuario todavía no ha completado, ya filtrados por
 * audiencia: exigir un recorrido que su sesión ni siquiera puede ver sería un
 * callejón sin salida.
 */
export function pendingPrerequisites(
  listing: TutorialListing,
  isCompleted: (id: string) => boolean,
  audience: 'internal' | 'merchant',
): string[] {
  return (listing.prerequisites ?? [])
    .filter((id) => {
      const meta = TUTORIAL_META[id];
      if (!meta) return false;
      const scope = audienceOf(meta);
      return scope === 'any' || scope === audience;
    })
    .filter((id) => !isCompleted(id));
}
