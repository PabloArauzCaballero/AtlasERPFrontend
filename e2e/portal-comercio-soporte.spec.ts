import { expect, test } from '@playwright/test';

/**
 * El soporte del comercio, de punta a punta y contra el stack real.
 *
 * Comprueba lo que un type-check no puede: que la entrada exista en el menú, que la pantalla cargue
 * dentro del portal autenticado y que abrir la conversación devuelva un chat con el aviso de
 * seguridad ya puesto por el sistema.
 *
 * No inventa datos: entra con el mismo comercio que usa el resto de la suite del portal, pero la
 * credencial llega por entorno (`PW_MERCHANT_EMAIL` / `PW_MERCHANT_PASSWORD`) y no escrita aquí: es
 * una cuenta real, y una contraseña en el repositorio se queda en el historial para siempre. Sin
 * ellas la prueba se salta, que es honesto — no pasa en verde sin haber probado nada.
 */
const COMERCIO = {
  email: process.env.PW_MERCHANT_EMAIL ?? '',
  password: process.env.PW_MERCHANT_PASSWORD ?? '',
};

test.beforeEach(async ({ page }) => {
  test.skip(!COMERCIO.email || !COMERCIO.password, 'Sin PW_MERCHANT_EMAIL/PW_MERCHANT_PASSWORD.');
  await page.goto('/login');
  await page.getByRole('tab', { name: /comercio afiliado/i }).click();
  await page.locator('input[name="email"]').fill(COMERCIO.email);
  await page.locator('input[name="password"]').fill(COMERCIO.password);
  await page.getByRole('button', { name: /iniciar sesi/i }).click();
  await page.waitForURL(/\/portal-comercio\//, { timeout: 120_000 });
});

test('el menú del comercio ofrece Soporte y la pantalla carga', async ({ page }) => {
  const menu = page.getByRole('navigation').first();
  await expect(menu.getByText(/^soporte$/i)).toBeVisible();

  await menu.getByText(/^soporte$/i).click();
  await page.waitForURL(/\/portal-comercio\/soporte/, { timeout: 60_000 });

  await expect(page.getByRole('heading', { name: /soporte/i }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /hablar con soporte/i })).toBeVisible();
  await expect(page.getByText(/mis casos/i)).toBeVisible();

  await page.screenshot({ path: 'test-results/soporte-comercio.png', fullPage: true });
});

/**
 * Abrir la conversación.
 *
 * El aviso de seguridad lo escribe el SISTEMA al abrir el canal, así que su presencia prueba que el
 * backend creó el canal de verdad y que la transcripción llegó a la pantalla — no sólo que el botón
 * responde.
 */
test('abrir la conversación deja un chat utilizable', async ({ page }) => {
  await page.goto('/portal-comercio/soporte');
  await page.getByRole('button', { name: /hablar con soporte/i }).click();

  await expect(page.getByText(/nunca te pedir/i)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: /^enviar$/i })).toBeVisible();

  await page.screenshot({ path: 'test-results/soporte-comercio-chat.png', fullPage: true });
});
