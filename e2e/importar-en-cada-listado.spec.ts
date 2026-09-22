import { expect, test, type Page } from '@playwright/test';
import { stubCatalogDomains } from './support/catalog-domains';
import { instalarContabilidad } from './support/contabilidad-backend';

const EVIDENCIA = 'docs/visual-evidence/importar';

/**
 * Que «Importar desde Excel» esté DONDE el usuario lo busca, y no sólo en el código.
 *
 * La carga masiva existía —el módulo, el lector, el modal— y aun así no se podía usar en los
 * listados que más se usan: `LiveDirectoryScreen` nunca recibió la entrada del cajón «Más», y los
 * listados cuya alta vive en su propia página no tenían de dónde sacar la plantilla. El síntoma no
 * era un error: era buscarla y no encontrarla, en Cuentas B2B, en Anunciantes, en Documentos.
 *
 * Por eso esta batería no prueba el lector (eso es `importacion-excel.spec.ts`): comprueba que la
 * opción aparece, abre el modal y lee lo que dice, pantalla por pantalla.
 */

async function abrirCajon(page: Page, testIdDelBoton: string) {
  const cabecera = page.locator('[data-tutorial-id="workspace-header"]');
  await expect(cabecera).toBeVisible({ timeout: 30_000 });
  await cabecera.getByTestId(testIdDelBoton).click();
  return page.getByRole('dialog');
}

test.describe('importar vive en el listado de cada registro', () => {
  test('el directorio en vivo ofrece importar, y el modal explica de dónde sale la plantilla', async ({ page }) => {
    await instalarContabilidad(page);
    await stubCatalogDomains(page);
    await page.goto('/operaciones/crm/cuentas');

    const cajon = await abrirCajon(page, 'directorio-mas');
    await expect(cajon.getByTestId('crud-importar')).toBeVisible();
    await cajon.getByTestId('crud-importar').click();

    const modal = page.getByRole('dialog');
    await expect(modal.getByText(/Importar empresas desde Excel/i)).toBeVisible();
    // La plantilla y el envío salen del MISMO módulo que el formulario de `/cuentas/crear`.
    await expect(modal.getByTestId('importar-plantilla')).toBeVisible();
    await expect(modal.getByTestId('importar-archivo')).toBeAttached();
    await page.screenshot({ path: `${EVIDENCIA}/cuentas-b2b-importar.png`, fullPage: true });
  });

  test('un listado con alta en modal lo hereda sin declarar nada', async ({ page }) => {
    await instalarContabilidad(page);
    await stubCatalogDomains(page);
    await page.goto('/operaciones/crm/tags');

    const cajon = await abrirCajon(page, 'crud-mas');
    await expect(cajon.getByTestId('crud-importar')).toBeVisible();
  });

  test('un registro con líneas pide una fila por línea y lo dice en el propio modal', async ({ page }) => {
    await instalarContabilidad(page);
    await stubCatalogDomains(page);
    await page.goto('/operaciones/contabilidad/documentos');

    const cajon = await abrirCajon(page, 'crud-mas');
    await cajon.getByTestId('crud-importar').click();

    const modal = page.getByRole('dialog');
    await expect(modal.getByText(/Importar asientos desde Excel/i)).toBeVisible();
    /*
     * Lo que hay que leer antes de rellenar nada: un asiento son varias filas con la misma
     * referencia. Sin decirlo, quien exporte su libro diario intentará meter el asiento en una fila
     * y la plantilla no le cuadrará con nada de lo que tiene.
     */
    await expect(modal.getByText(/una fila por línea/i)).toBeVisible();
    await expect(modal.getByText(/Referencia del asiento/i)).toBeVisible();
    await page.screenshot({ path: `${EVIDENCIA}/asientos-importar-por-lineas.png`, fullPage: true });
  });

  test('un monitor sin alta no finge que se puede importar', async ({ page }) => {
    await instalarContabilidad(page);
    await stubCatalogDomains(page);
    await page.goto('/operaciones/auditoria/business-actions');

    const cajon = await abrirCajon(page, 'directorio-mas');
    await expect(cajon.getByTestId('directorio-csv')).toBeVisible();
    /*
     * El registro de actividad es un histórico: no hay alta que reutilizar, así que ofrecer
     * «Importar» sería prometer que se pueden fabricar entradas de auditoría a mano.
     */
    await expect(cajon.getByTestId('crud-importar')).toHaveCount(0);
  });
});
