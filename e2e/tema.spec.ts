import { expect, test } from '@playwright/test';

/**
 * El tema se decide ANTES del primer pintado, con el script en línea del <head> (con nonce).
 *
 * No necesita backend: el acceso interno se pinta sin sesión. Lo que un type-check no ve es que la
 * CSP deje correr ese script y que las variables del tema lleguen de verdad al <body>.
 */
const CANVAS = { claro: 'rgb(246, 246, 241)', oscuro: 'rgb(17, 17, 17)' };

test('sin preferencia guardada sigue al sistema', async ({ browser }) => {
  for (const [esquema, tema, fondo] of [['light', 'light', CANVAS.claro], ['dark', 'dark', CANVAS.oscuro]] as const) {
    const contexto = await browser.newContext({ colorScheme: esquema });
    const page = await contexto.newPage();
    await page.goto('/login/interno');
    await expect(page.locator('html')).toHaveAttribute('data-theme', tema);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(fondo);
    await contexto.close();
  }
});

test('la preferencia guardada se aplica antes de hidratar y cambia la paleta', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('cuotea-tema', 'dark'));
  await page.goto('/login/interno');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(CANVAS.oscuro);
  // El script va en el <head>, no al final del <body>: es lo que evita el destello.
  await expect(page.locator('head script#tema-inicial')).toHaveCount(1);
});

test('la tipografía es Outfit y se sirve desde este origen', async ({ page }) => {
  const remotas: string[] = [];
  page.on('request', (peticion) => {
    const url = peticion.url();
    if (/fonts\.gstatic\.com/.test(url) && /outfit|inter|jetbrains/i.test(url)) remotas.push(url);
  });
  await page.goto('/login/interno');
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/Outfit/i);
  expect(remotas).toEqual([]);
});

test('el conmutador cambia el tema en el acto y lo recuerda', async ({ page }) => {
  await page.goto('/login/interno');
  await page.getByTestId('tema-dark').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByTestId('tema-dark')).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByTestId('tema-light').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
