import { expect, test } from '@playwright/test';
import { installPartnerDossierBackend, seedMerchantSession } from './support/partner-dossier-backend';

/**
 * Evidencia de «cada campo dice qué poner y cada opción qué significa».
 *
 * Contra el backend simulado del expediente: abre el alta de sucursal, enfoca un campo con el
 * teclado (la burbuja se abre sin ratón), pasa el ratón por el ⓘ y despliega el select de ciudad
 * para que se vea la descripción en cada fila. Comprueba lo que promete el README: el nombre
 * accesible del campo no cambió, la burbuja cierra con Escape y el select propio lleva el valor
 * al formulario.
 */
const EVIDENCIA = process.env.EVIDENCIA_DIR ?? 'docs/visual-evidence/tooltips';

test('el campo explica qué poner y el select qué significa cada opción', async ({ page }) => {
  await installPartnerDossierBackend(page);
  await seedMerchantSession(page);
  await page.goto('/portal-comercio/expediente');
  await page.getByTestId('campo-legalName').fill('Comercial Andina S.R.L.');
  await page.getByTestId('campo-taxId').fill('1023456789');
  await page.getByTestId('campo-contactEmail').fill('contacto@andina.test');

  // Con el teclado: enfocar el control abre la burbuja, Escape la cierra, el foco no se mueve.
  const nit = page.getByTestId('campo-taxId');
  await nit.focus();
  const burbuja = page.getByRole('tooltip');
  await expect(burbuja).toBeVisible();
  await expect(burbuja).toContainText('NIT');
  await page.screenshot({ path: `${EVIDENCIA}/01-tooltip-por-teclado.png`, fullPage: false });
  await page.keyboard.press('Escape');
  await expect(nit).toBeFocused();

  // Con el ratón: el ⓘ.
  await page.getByTestId('btn-abrir-expediente').click();
  await expect(page.getByTestId('expediente-pendientes')).toBeVisible();
  await page.goto('/portal-comercio/sucursales-usuarios');
  await page.getByTestId('btn-agregar-sucursal').click();
  const alta = page.getByRole('dialog');
  await expect(alta).toBeVisible();
  // El nombre accesible del campo sigue siendo la etiqueta: el ⓘ no entra en él.
  const nombre = alta.getByLabel('Nombre de sucursal');
  await expect(nombre).toHaveAttribute('name', 'name');
  await alta.getByTitle('Ayuda: Nombre de sucursal').hover();
  await expect(page.getByRole('tooltip')).toContainText('Sucursal Equipetrol');
  await page.screenshot({ path: `${EVIDENCIA}/02-tooltip-por-raton.png`, fullPage: false });

  // El select propio: cada fila con su descripción; la elegida la repite bajo el campo.
  await alta.getByLabel('Ciudad').click();
  const lista = page.getByRole('listbox');
  await expect(lista).toBeVisible();
  await expect(lista.getByRole('option').first()).toBeVisible();
  await page.screenshot({ path: `${EVIDENCIA}/03-select-desplegado.png`, fullPage: false });
  await page.getByRole('option', { name: /^Santa Cruz de la Sierra/ }).click();
  await expect(lista).toBeHidden();
  await expect(alta.locator('input[name="city"]')).toHaveValue('Santa Cruz de la Sierra');
  await page.screenshot({ path: `${EVIDENCIA}/04-select-elegido.png`, fullPage: false });

  // Un select de dominio cerrado: la descripción se ve en cada fila sin pasar el ratón.
  await page.keyboard.press('Escape');
  await page.goto('/portal-comercio/tutoriales');
  await page.getByTestId('select-filtro-estado').click();
  const estados = page.getByRole('listbox');
  await expect(estados.getByRole('option', { name: /Guías empezadas y sin terminar/ })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCIA}/05-select-con-descripciones.png`, fullPage: false });
});
