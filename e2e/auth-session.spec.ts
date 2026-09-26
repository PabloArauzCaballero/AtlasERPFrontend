import { expect, test } from '@playwright/test';

test('el reload recupera la sesión interna sin guardar ni reutilizar el bearer', async ({ page }) => {
  let refreshes = 0;
  const meHeaders: Array<string | undefined> = [];
  await page.addInitScript(() => {
    window.localStorage.setItem('atlas_session_kind', 'internal');
    window.localStorage.setItem('atlas_access_token', 'bearer-heredado');
  });
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const respond = (data: unknown) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }),
    });
    if (path.endsWith('/auth/refresh')) {
      refreshes += 1;
      expect(route.request().headers().authorization).toBeUndefined();
      return respond({ accessToken: `nuevo-${refreshes}` });
    }
    if (path.endsWith('/auth/me')) {
      meHeaders.push(route.request().headers().authorization);
      return respond({ user: { id: '1', email: 'qa@atlas.test', fullName: 'QA Atlas', roleCode: 'SUPER_ADMIN', status: 'ACTIVE', permissions: [] } });
    }
    return respond({ items: [], total: 0 });
  });

  await page.goto('/login');
  await expect(page).toHaveURL(/\/operaciones/);
  expect(await page.evaluate(() => window.localStorage.getItem('atlas_access_token'))).toBeNull();
  await page.reload();
  await expect(page).toHaveURL(/\/operaciones/);
  await expect.poll(() => refreshes).toBe(2);
  expect(meHeaders).toContain('Bearer nuevo-1');
  expect(meHeaders).toContain('Bearer nuevo-2');
  expect(await page.evaluate(() => window.localStorage.getItem('atlas_access_token'))).toBeNull();
});

test('un refresh rechazado deja anónima la sesión sin rescatar un token heredado', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('atlas_session_kind', 'merchant');
    window.localStorage.setItem('atlas_access_token', 'bearer-heredado');
  });
  await page.route('**/api/v1/auth/merchant/refresh', (route) => route.fulfill({
    status: 401, contentType: 'application/json', body: JSON.stringify({ success: false, error: { message: 'Sesión vencida' } }),
  }));
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem('atlas_access_token'))).toBeNull();
});

test('login y logout internos usan el bearer en memoria y revocan la sesión del servidor', async ({ page }) => {
  let serverSession = false;
  let logoutCalls = 0;
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const respond = (data: unknown, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(status === 200 ? { success: true, data } : { success: false, error: { message: 'Sin sesión' } }),
    });
    if (path.endsWith('/auth/refresh')) return respond({ accessToken: 'login-token' }, serverSession ? 200 : 401);
    if (path.endsWith('/auth/login')) {
      serverSession = true;
      return respond({
        accessToken: 'login-token',
        user: { id: '1', email: 'qa@atlas.test', fullName: 'QA Atlas', roleCode: 'SUPER_ADMIN', status: 'ACTIVE', permissions: [] },
      });
    }
    if (path.endsWith('/auth/logout')) {
      expect(route.request().headers().authorization).toBe('Bearer login-token');
      logoutCalls += 1;
      serverSession = false;
      return respond({ loggedOut: true });
    }
    return respond({ items: [], total: 0 });
  });
  await page.goto('/login');
  await page.locator('input[name=email]').fill('qa@atlas.test');
  await page.locator('input[name=password]').fill('password-de-prueba');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/operaciones/);
  expect(await page.evaluate(() => window.localStorage.getItem('atlas_access_token'))).toBeNull();
  await page.getByRole('button', { name: 'Cerrar sesión' }).first().click();
  await expect(page).toHaveURL(/\/login/);
  expect(logoutCalls).toBe(1);
  expect(await page.evaluate(() => window.localStorage.getItem('atlas_session_kind'))).toBeNull();
});
