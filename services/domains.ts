import { apiRequest } from '@/lib/apiClient';
import { cityOptions, countryOptions, currencyOptions, timezoneOptions } from '@/lib/catalogs';
import type { Option } from './optionLoaders';

/**
 * Los valores válidos de cada campo cerrado, pedidos al backend en vez de copiados.
 *
 * ## Por qué
 *
 * Hasta el 2026-09-15 cada pantalla escribía a mano su lista de estados, tipos y monedas —o peor,
 * pintaba un texto libre donde el backend sólo acepta un enum—, y el alta fallaba hasta que alguien
 * adivinaba la palabra exacta. El backend publica ahora sus dominios en `GET /catalog/domains`
 * (código + etiqueta + ayuda) y este módulo es la única puerta para leerlos.
 *
 * Un solo viaje por sesión: la primera pantalla que lo pide los trae todos y el resto los lee de
 * memoria. `sessionStorage` sólo evita el viaje al recargar; si no está disponible, no pasa nada.
 *
 * ## Dos fuentes
 *
 * - `domain:<nombre>` — vocabulario del negocio, dueño el backend (`crm.riskTier`, `ads.surface`…).
 * - `catalog:<nombre>` — listas geográficas e ISO que no pertenecen a ningún módulo del backend
 *   (moneda, país, ciudad, zona horaria). Viven en `lib/catalogs.ts`.
 */

export interface DomainOption {
  code: string;
  label: string;
  help?: string | undefined;
}

export type OptionsSource = `domain:${string}` | `catalog:${StaticCatalogName}`;

const STATIC_CATALOGS = {
  currency: currencyOptions,
  country: countryOptions,
  city: cityOptions,
  timezone: timezoneOptions,
} as const;
export type StaticCatalogName = keyof typeof STATIC_CATALOGS;

const STORAGE_KEY = 'atlas_erp_catalog_domains_v1';

let memory: Record<string, DomainOption[]> | null = null;
let inflight: Promise<Record<string, DomainOption[]>> | null = null;

function readStorage(): Record<string, DomainOption[]> | null {
  try {
    const raw = typeof window === 'undefined' ? null : window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, DomainOption[]>) : null;
  } catch {
    return null;
  }
}

function writeStorage(domains: Record<string, DomainOption[]>): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(domains));
  } catch {
    /* sin almacenamiento de sesión: se vuelven a pedir al recargar */
  }
}

/** Todos los dominios. La primera llamada viaja; las demás esperan a esa o leen de memoria. */
export function loadDomains(): Promise<Record<string, DomainOption[]>> {
  if (memory) return Promise.resolve(memory);
  const stored = readStorage();
  if (stored) {
    memory = stored;
    return Promise.resolve(stored);
  }
  if (!inflight) {
    inflight = apiRequest<{ domains: Record<string, DomainOption[]> }>('catalog/domains')
      .then((response) => {
        memory = response.domains;
        writeStorage(response.domains);
        return response.domains;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Olvida lo cargado (al cerrar sesión, o si el backend publicó dominios nuevos). */
export function forgetDomains(): void {
  memory = null;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nada que olvidar */
  }
}

function toOptions(options: readonly DomainOption[]): Option[] {
  return options.map((option) => ({
    value: option.code,
    label: option.label,
    ...(option.help ? { description: option.help } : {}),
  }));
}

function parse(source: OptionsSource): { kind: 'domain' | 'catalog'; name: string } {
  const separator = source.indexOf(':');
  return { kind: source.slice(0, separator) as 'domain' | 'catalog', name: source.slice(separator + 1) };
}

/**
 * Las opciones ya disponibles sin esperar: catálogos estáticos siempre, dominios si ya se
 * cargaron. Sirve para pintar el select con su valor desde el primer render.
 */
export function peekOptions(source: OptionsSource): Option[] | undefined {
  const { kind, name } = parse(source);
  if (kind === 'catalog') return [...STATIC_CATALOGS[name as StaticCatalogName]];
  const known = memory ?? readStorage();
  if (known && !memory) memory = known;
  const domain = known?.[name];
  return domain ? toOptions(domain) : undefined;
}

/**
 * Las opciones de una fuente. Un dominio que el backend no publica es un ERROR y no una lista
 * vacía: un select obligatorio vacío es exactamente el formulario imposible que esto vino a quitar.
 */
export async function resolveOptions(source: OptionsSource): Promise<Option[]> {
  const { kind, name } = parse(source);
  if (kind === 'catalog') {
    const catalog = STATIC_CATALOGS[name as StaticCatalogName];
    if (!catalog) throw new Error(`No existe el catálogo «${name}».`);
    return [...catalog];
  }
  const domains = await loadDomains();
  const domain = domains[name];
  if (!domain) throw new Error(`El servidor no publica el dominio «${name}».`);
  return toOptions(domain);
}

/** Loader para `optionsLoader` o `useOptions` en pantallas hechas a mano. */
export function domainLoader(source: OptionsSource): () => Promise<Option[]> {
  return () => resolveOptions(source);
}

/** Etiqueta de un código para pintarlo en una tabla; si no se conoce, el propio código. */
export function domainLabel(name: string, code: string | null | undefined): string {
  if (!code) return '';
  const domain = (memory ?? readStorage())?.[name];
  return domain?.find((option) => option.code === code)?.label ?? code;
}
