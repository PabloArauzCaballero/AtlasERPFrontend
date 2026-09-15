import type { Page } from '@playwright/test';
import fixture from './catalog-domains.json';

/**
 * `GET /catalog/domains` simulado con los dominios REALES del backend.
 *
 * Los formularios del ERP ya no copian sus listas de estados, monedas o tipos: las piden a ese
 * endpoint. Una prueba que simula el backend con un comodín (`**\/api/v1/**`) le devolvería otra
 * cosa, cada select quedaría vacío y saldría el aviso «No se pudieron cargar las opciones».
 *
 * `catalog-domains.json` es una foto del registro de AtlasERPBackend
 * (`src/modules/catalog/domains`). Si un dominio cambia, se regenera con `CatalogService().list()`.
 *
 * Playwright da prioridad a la ÚLTIMA ruta registrada: llamar a esto DESPUÉS del comodín.
 */
export async function stubCatalogDomains(page: Page): Promise<void> {
  await page.route('**/api/v1/catalog/domains**', (route) => {
    const url = new URL(route.request().url());
    const single = /\/catalog\/domains\/([^/?]+)/.exec(url.pathname)?.[1];
    const all = fixture.domains as Record<string, Array<{ code: string; label: string; help?: string }>>;
    if (single) {
      const options = all[decodeURIComponent(single)];
      return route.fulfill({
        status: options ? 200 : 404,
        contentType: 'application/json',
        body: JSON.stringify(
          options
            ? { success: true, data: { name: single, description: '', options } }
            : { success: false, error: { code: 'CATALOG_DOMAIN_NOT_FOUND', message: single } },
        ),
      });
    }
    const names = url.searchParams.get('names')?.split(',').map((name) => name.trim()).filter(Boolean);
    const domains = names?.length ? Object.fromEntries(names.filter((name) => all[name]).map((name) => [name, all[name]])) : all;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { domains } }) });
  });
}
