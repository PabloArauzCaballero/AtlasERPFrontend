import { expect, test } from '@playwright/test';

test('CSP de producción usa nonce único y permite hidratar el login', async ({ page }) => {
  await page.route('**/api/v1/auth/refresh', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, error: { message: 'Sin sesión' } }),
  }));
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy|Refused to/i.test(message.text())) violations.push(message.text());
  });
  page.on('pageerror', (error) => violations.push(error.message));

  const first = await page.goto('/login');
  const firstPolicy = first?.headers()['content-security-policy'] ?? '';
  const nonce = firstPolicy.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toMatch(/^[a-f0-9]{32}$/);
  const scriptNonces = await page.locator('script').evaluateAll((scripts) => scripts.map((script) => (script as HTMLScriptElement).nonce));
  expect(scriptNonces.length).toBeGreaterThan(0);
  expect(scriptNonces.every((value) => value === nonce)).toBe(true);

  await page.getByRole('tab', { name: 'Comercio afiliado' }).click();
  await expect(page.getByRole('tab', { name: 'Comercio afiliado' })).toHaveAttribute('aria-selected', 'true');
  const second = await page.reload();
  expect(second?.headers()['content-security-policy']).not.toBe(firstPolicy);
  expect(violations).toEqual([]);
});
