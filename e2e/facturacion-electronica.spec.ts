import { expect, test } from '@playwright/test';
import { stubCatalogDomains } from './support/catalog-domains';
import { DOC_ERROR, DOC_OBSERVADO, DOC_RECHAZADO, DOC_VALIDADO, instalarFacturacionElectronica, type FiscalDoble } from './support/facturacion-electronica-backend';

/**
 * Facturación electrónica (Contabilidad), con el backend SIMULADO con estado.
 *
 * Lo que se afirma y un type-check no ve: que la tabla habla en las etiquetas del dominio y no en
 * códigos; que «Reintentar envío» sólo existe en «Error de envío» y «Anular» sólo en lo que
 * Impuestos ya registró; que la anulación manda el motivo del catálogo del SIN (se mira el CUERPO
 * del POST); y que con la facturación apagada la pantalla lo dice en vez de ofrecer botones que
 * fallarían.
 */

const RUTA = '/operaciones/contabilidad/facturacion-electronica';
let doble: FiscalDoble;

async function abrir(page: import('@playwright/test').Page, opciones: { activo?: boolean; simulado?: boolean } = {}) {
  doble = await instalarFacturacionElectronica(page, opciones);
  /* Los dominios DESPUÉS del comodín: gana la última ruta registrada. */
  await stubCatalogDomains(page);
  await page.goto(RUTA);
  await expect(page.getByRole('heading', { name: 'Facturación electrónica' })).toBeVisible({ timeout: 30_000 });
}

test('listado: cada documento con su cliente, NIT, total y el estado en palabras', async ({ page }) => {
  await abrir(page);
  const tabla = page.locator('[data-tutorial-id="crud-tabla"]');
  const validado = tabla.getByRole('row').filter({ hasText: 'Comercial Andina S.R.L.' });
  await expect(validado).toContainText('1020304050');
  await expect(validado).toContainText('908');
  await expect(validado).toContainText(/validada por impuestos/i);
  await expect(tabla).not.toContainText('ACCEPTED');
  await expect(page.getByText('4 registros.')).toBeVisible();
  /* Con la facturación encendida no hay aviso de «apagada». */
  await expect(page.getByText(/está apagada en este entorno/)).toHaveCount(0);
});

test('filtro por estado: «Error de envío» deja sólo ese documento', async ({ page }) => {
  await abrir(page);
  await page.getByLabel('Estado').first().click();
  await page.getByRole('option', { name: /error de envío/i }).click();
  await expect(page.getByText('1 de 4 registros con estos filtros.')).toBeVisible();
  const tabla = page.locator('[data-tutorial-id="crud-tabla"]');
  await expect(tabla).toContainText('Distribuidora del Sur Ltda.');
  await expect(tabla).not.toContainText('Comercial Andina S.R.L.');
});

test('reintentar: sólo en «Error de envío», y pide al sistema adelantar el envío', async ({ page }) => {
  await abrir(page);
  for (const id of [DOC_VALIDADO, DOC_OBSERVADO, DOC_RECHAZADO]) {
    await expect(page.getByTestId(`accion-reintentar-${id}`)).toHaveCount(0);
  }
  await page.getByTestId(`accion-reintentar-${DOC_ERROR}`).click();
  const confirmar = page.getByRole('dialog');
  await expect(confirmar).toContainText(/mismo número/);
  await confirmar.getByRole('button', { name: 'Reintentar envío' }).click();
  await expect.poll(() => doble.llamadas.some((l) => l.metodo === 'POST' && l.ruta === `/documents/${DOC_ERROR}/retry`)).toBe(true);
});

test('anular: sólo en validada u observada, con el motivo del catálogo del SIN', async ({ page }) => {
  await abrir(page);
  await expect(page.getByTestId(`accion-anular-${DOC_ERROR}`)).toHaveCount(0);
  await expect(page.getByTestId(`accion-anular-${DOC_RECHAZADO}`)).toHaveCount(0);
  await expect(page.getByTestId(`accion-anular-${DOC_OBSERVADO}`)).toBeVisible();

  await page.getByTestId(`accion-anular-${DOC_VALIDADO}`).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText(/definitiva/);
  await modal.getByLabel('Motivo de la anulación').click();
  await page.getByRole('option', { name: /DATOS DE EMISION INCORRECTOS/ }).click();
  await modal.getByRole('button', { name: 'Anular factura' }).click();
  await expect(modal).toBeHidden();

  const envio = doble.llamadas.find((l) => l.ruta === `/documents/${DOC_VALIDADO}/annul`);
  expect(envio?.cuerpo).toEqual({ codigoMotivo: 3 });
  /* La tabla se relee y la fila ya dice lo que dijo Impuestos. */
  const fila = page.locator('[data-tutorial-id="crud-tabla"]').getByRole('row').filter({ hasText: 'Comercial Andina S.R.L.' });
  await expect(fila).toContainText(/anulada ante el siat/i);
  await expect(fila).toContainText('905');
});

test('apagada: la pantalla lo dice y no ofrece lo que habla con Impuestos', async ({ page }) => {
  await abrir(page, { activo: false });
  await expect(page.getByText('La facturación electrónica está apagada en este entorno')).toBeVisible();
  await expect(page.getByText(/representación interna/)).toBeVisible();
  await expect(page.getByTestId(`accion-anular-${DOC_VALIDADO}`)).toHaveCount(0);
});

test('catálogos: si las filas son de pruebas, se avisa', async ({ page }) => {
  await abrir(page, { simulado: true });
  await page.getByRole('tab', { name: /catálogos del sin/i }).click();
  await expect(page.getByText('Catálogo de pruebas')).toBeVisible();
  await expect(page.getByText('ACTIVIDADES DE PROGRAMACION INFORMATICA')).toBeVisible();
});

test('factura de comercio: con la facturación encendida no se ofrece la referencia fiscal a mano', async ({ page }) => {
  doble = await instalarFacturacionElectronica(page);
  await stubCatalogDomains(page);
  await page.goto('/operaciones/crm/facturacion');
  /* La columna fiscal sólo aparece cuando la pantalla ya sabe que está encendida. */
  await expect(page.getByRole('columnheader', { name: 'Ante Impuestos' })).toBeVisible();
  await page.getByTestId('crud-crear').first().click();
  const alta = page.getByRole('dialog');
  await expect(alta.getByLabel('Cuenta B2B')).toBeVisible();
  await expect(alta.getByLabel('Referencia fiscal externa')).toHaveCount(0);
});

test('factura de comercio: apagada, la referencia fiscal externa sigue disponible', async ({ page }) => {
  doble = await instalarFacturacionElectronica(page, { activo: false });
  await stubCatalogDomains(page);
  await page.goto('/operaciones/crm/facturacion');
  await expect.poll(() => doble.llamadas.some((l) => l.ruta === '/status')).toBe(true);
  await page.getByTestId('crud-crear').first().click();
  await expect(page.getByRole('dialog').getByLabel('Referencia fiscal externa')).toBeVisible();
});
