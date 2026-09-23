import type { Page } from '@playwright/test';

/** La cookie real es httpOnly; el doble solo responde al refresh del canal elegido. */
export async function seedRefreshSession(page: Page, kind: 'internal' | 'merchant') {
  const path = kind === 'merchant' ? 'auth/merchant/refresh' : 'auth/refresh';
  await page.route(`**/api/v1/${path}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { accessToken: `e2e-${kind}-token` } }),
    }),
  );
  await page.addInitScript((sessionKind) => {
    window.localStorage.setItem('atlas_session_kind', sessionKind);
  }, kind);
}
