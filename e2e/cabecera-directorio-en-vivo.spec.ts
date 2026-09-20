import { expect, test } from '@playwright/test';
import { stubCatalogDomains } from './support/catalog-domains';
import { instalarContabilidad } from './support/contabilidad-backend';

/**
 * La otra mitad de las pantallas.
 *
 * `CrudDirectory` no es el único listado del ERP: `LiveDirectoryScreen` pinta Cuentas del CRM,
 * la auditoría y las cinco de Publicidad, con su propia cabecera. Cuando se recortó la barra a
 * «¿Qué es esto?» · «Más» · la acción, había que tocar los DOS, y un cambio hecho sólo en el
 * primero no se nota hasta que alguien abre una pantalla del otro. El doble de contabilidad sirve
 * igual: aquí sólo se mira la cabecera, no los datos.
 */
test('el directorio en vivo también trae su cajón «Más»', async ({ page }) => {
  await instalarContabilidad(page);
  await stubCatalogDomains(page);
  await page.goto('/operaciones/crm/cuentas');
  const cabecera = page.locator('[data-tutorial-id="workspace-header"]');
  await expect(cabecera).toBeVisible({ timeout: 30_000 });
  await expect(cabecera.getByRole('button', { name: /recorrido/i })).toHaveCount(0);
  await expect(cabecera.getByRole('button', { name: /^PDF$/ })).toHaveCount(0);
  await cabecera.getByTestId('directorio-mas').click();
  const cajon = page.getByRole('dialog');
  await expect(cajon.getByTestId('directorio-pdf')).toBeVisible();
  await expect(cajon.getByTestId('directorio-csv')).toBeVisible();
});
