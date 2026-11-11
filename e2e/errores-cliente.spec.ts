import { expect, test } from '@playwright/test';

/**
 * Un error de JavaScript en el navegador llega a `POST /errores-cliente` de este mismo origen, sin
 * sesión (desde el login), con la ruta SIN query, y el servidor responde 202 aunque el núcleo no
 * esté (aquí no lo está: el alias `atlas-backend` no resuelve fuera de la red de Coolify).
 */
test('un error sin capturar del login llega a /errores-cliente y el servidor responde 202', async ({ page }) => {
  await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, error: { message: 'Sin sesión' } }),
  }));
  await page.goto('/login/comercios?next=%2Fportal-comercio&ci=1234567');
  await expect(page.getByLabel(/Correo del comercio/i)).toBeVisible();

  const peticion = page.waitForRequest((r) => r.url().endsWith('/errores-cliente') && r.method() === 'POST');
  const respuesta = page.waitForResponse((r) => r.url().endsWith('/errores-cliente'));
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error('error provocado por la prueba e2e');
    }, 0);
  });

  const enviado = (await peticion).postDataJSON() as Record<string, unknown>;
  expect(enviado).toMatchObject({ kind: 'error', message: expect.stringContaining('error provocado por la prueba e2e'), route: '/login/comercios' });
  expect(JSON.stringify(enviado)).not.toContain('1234567');
  expect((await respuesta).status()).toBe(202);
});
