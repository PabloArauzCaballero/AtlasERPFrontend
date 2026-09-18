import { expect, test } from '@playwright/test';
import { installPartnerDossierBackend, seedMerchantSession } from './support/partner-dossier-backend';

/**
 * El portal del comercio después de la fusión del 2026-09-18, con el backend SIMULADO.
 *
 * Lo que se afirma aquí no lo cubre ninguna de las otras baterías, y es justo lo que un
 * type-check no ve: que juntar cinco pantallas en tres no dejó ninguna sin su contenido, que la
 * pestaña abierta se puede enlazar, y que la tabla de sucursales —la que más creció, porque ahora
 * lleva el QR de cada caja dentro— no desborda la pantalla de un teléfono.
 *
 * Va contra el simulado y no contra el stack real a propósito: esto es maquetación y navegación,
 * y lo que sí necesita datos de verdad —que el QR lleve el serial de la caja del comercio— vive
 * en `mi-empresa-real.spec.ts`, que además pasa la captura por el lector de códigos.
 */
const EVIDENCIA = 'docs/visual-evidence/portal-comercio';

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await installPartnerDossierBackend(page);
  await seedMerchantSession(page);
});

/**
 * Deja al comercio con expediente abierto.
 *
 * El simulado arranca en blanco en CADA prueba —es lo que permite que ninguna dependa del orden
 * de las otras—, y sin expediente «Mi empresa» enseña su estado vacío: el alta, sin pestañas.
 */
async function conExpediente(page: import('@playwright/test').Page) {
  await page.goto('/portal-comercio/expediente');
  await page.getByTestId('campo-legalName').fill('Comercial Andina S.R.L.');
  await page.getByTestId('campo-taxId').fill('1023456789');
  await page.getByTestId('campo-contactEmail').fill('contacto@andina.test');
  await page.getByTestId('btn-abrir-expediente').click();
  await expect(page.getByTestId('tab-sucursales')).toBeVisible({ timeout: 30_000 });
}

test('el menú son cinco entradas y ninguna de las retiradas', async ({ page }) => {
  await page.goto('/portal-comercio/gestion-pos');
  const menu = page.getByRole('navigation').first();
  await expect(menu.getByRole('link')).toHaveCount(5);
  for (const fuera of [/planes y suscripci/i, /^campañas$/i, /formularios en papel/i, /centro de tutoriales/i]) {
    await expect(menu.getByText(fuera), `sigue en el menú: ${String(fuera)}`).toHaveCount(0);
  }
  await page.screenshot({ path: `${EVIDENCIA}/menu-cinco-entradas.png`, fullPage: true });
});

test('Gestión POS abre la pestaña que dice la URL', async ({ page }) => {
  await page.goto('/portal-comercio/gestion-pos?tab=comprobantes');
  await expect(page.getByRole('tab', { name: /comprobantes por verificar/i })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: /solicitudes de compra/i })).toHaveAttribute('aria-selected', 'false');

  // Y cambiar de pestaña lo escribe en la URL: es lo que permite enlazar a una de las dos.
  await page.getByRole('tab', { name: /solicitudes de compra/i }).click();
  await expect(page).toHaveURL(/tab=solicitudes/);
  await page.screenshot({ path: `${EVIDENCIA}/gestion-pos.png`, fullPage: true });
});

test('Mi empresa tiene las cuatro secciones y el QR de la caja se lee en la tabla', async ({ page }) => {
  await conExpediente(page);

  for (const pestana of ['tab-estado', 'tab-ficha', 'tab-qr', 'tab-sucursales']) {
    await expect(page.getByTestId(pestana), `falta ${pestana}`).toBeVisible({ timeout: 30_000 });
  }

  await page.getByTestId('tab-sucursales').click();
  const sucursal = 'b0000000-0000-4000-8000-00000000ee01';
  await page.getByTestId(`habilitar-qr-${sucursal}`).click();
  await page.getByTestId(`btn-nueva-caja-${sucursal}`).click();
  await page.getByTestId(`campo-pos-serial-${sucursal}`).fill('SN-VITRINA');
  await page.getByTestId(`btn-registrar-pos-${sucursal}`).click();

  /*
   * La corrección pedida: el QR está EN la tabla. Se comprueba que no queda ningún desplegable
   * que abrir y que el código lleva dentro el serial de la caja —un cuadro gris pasaría igual—.
   */
  await expect(page.getByRole('button', { name: /cajas y qr/i })).toHaveCount(0);
  const celda = page.getByTestId(`cajas-de-${sucursal}`);
  await expect(celda.getByTestId('qr-terminal').first()).toHaveAttribute('data-qr-value', 'SN-VITRINA');
  await page.screenshot({ path: `${EVIDENCIA}/mi-empresa-sucursales-qr.png`, fullPage: true });
});

test('la tabla de sucursales no desborda la pantalla de un teléfono', async ({ page }) => {
  /*
   * La tabla creció: ahora lleva el QR de cada caja dentro. Su ancho mínimo lo absorbe el
   * contenedor con desplazamiento propio; lo que no puede pasar es que empuje la PÁGINA, porque
   * entonces el menú y la cabecera se salen y el portal deja de poder usarse desde el mostrador.
   */
  await page.setViewportSize({ width: 320, height: 720 });
  await conExpediente(page);
  await page.getByTestId('tab-sucursales').click();
  await expect(page.getByRole('heading', { name: /sucursales registradas/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('table').first()).toBeVisible();

  /*
   * Se espera a la tipografía ANTES de medir. Los iconos son ligaduras de Material Symbols: hasta
   * que la fuente carga, cada uno se pinta como su palabra entera («point_of_sale») y ocupa cinco
   * veces su ancho real. Medir antes fabrica un desbordamiento que no existe en la pantalla.
   */
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(desborde, 'la página se desplaza en horizontal a 320 px').toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${EVIDENCIA}/mi-empresa-sucursales-320.png`, fullPage: true });
});

test('Soporte y tutoriales son dos pestañas de la misma pantalla', async ({ page }) => {
  await page.goto('/portal-comercio/soporte?tab=tutoriales');
  await expect(page.locator('[data-tutorial-id="tutorial-center"]')).toBeVisible({ timeout: 30_000 });
  // El centro de tutoriales embebido no repite su propia cabecera sobre la de la pantalla.
  await expect(page.getByRole('heading', { name: /centro de tutoriales/i })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /soporte y tutoriales/i })).toBeVisible();

  // Y «Abrir un caso» sólo se ofrece en la pestaña donde significa algo.
  await expect(page.getByRole('button', { name: /abrir un caso/i })).toHaveCount(0);
  await page.getByTestId('tab-soporte').click();
  await expect(page.getByRole('button', { name: /abrir un caso/i })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCIA}/soporte-y-tutoriales.png`, fullPage: true });
});
