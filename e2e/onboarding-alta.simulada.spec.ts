import { expect, test, type Page, type Route } from '@playwright/test';

const GANADORA = '22222222-2222-4222-8222-222222222222';
const SIN_GANAR = '33333333-3333-4333-8333-333333333333';
const CON_CASO = '44444444-4444-4444-8444-444444444444';
const CASO_ID = '11111111-1111-4111-8111-111111111111';
const NIT_ID = '55555555-5555-4555-8555-555555555555';

function responder(route: Route, status: number, data: unknown) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
}

async function instalar(page: Page) {
  const llamadas: string[] = [];
  await page.addInitScript(() => {
    window.localStorage.setItem('atlas_session_kind', 'internal');
  });
  await page.route('**/api/v1/**', (route) => {
    const { pathname, searchParams } = new URL(route.request().url());
    const metodo = route.request().method();
    if (pathname.endsWith('/auth/refresh')) return responder(route, 200, { accessToken: 'e2e-internal-token' });
    if (pathname.endsWith('/auth/me')) {
      return responder(route, 200, { user: { id: '1', email: 'admin@atlas.test', fullName: 'Admin', status: 'ACTIVE', roles: ['ADMIN'], permissions: [] } });
    }
    if (pathname.endsWith('/b2b/accounts')) {
      return responder(route, 200, { items: [
        { id: GANADORA, tradeName: 'Con oportunidad ganada' },
        { id: SIN_GANAR, tradeName: 'Sin oportunidad ganada' },
        { id: CON_CASO, tradeName: 'Ya tiene caso' },
      ], total: 3 });
    }
    if (pathname.endsWith('/b2b/opportunities')) {
      llamadas.push(`opp:${searchParams.get('stage')}`);
      return responder(route, 200, [{ id: 'o1', accountId: GANADORA }, { id: 'o2', accountId: CON_CASO }]);
    }
    if (pathname.endsWith('/b2b/onboarding/cases') && metodo === 'GET') {
      return responder(route, 200, { items: [{ id: 'c0', accountId: CON_CASO }], total: 1 });
    }
    if (pathname.endsWith('/b2b/onboarding/cases') && metodo === 'POST') {
      llamadas.push('crear');
      return responder(route, 201, { id: CASO_ID, checklistItems: [{ id: NIT_ID, itemType: 'LEGAL', description: 'NIT vigente del comercio' }] });
    }
    if (pathname.endsWith(`/cases/${CASO_ID}/contract-options`)) {
      return responder(route, 200, [{ id: 'v1', vigente: true }]);
    }
    if (pathname.endsWith(`/cases/${CASO_ID}/contract`)) { llamadas.push('contrato'); return responder(route, 200, { id: CASO_ID }); }
    if (pathname.endsWith('/evidence/upload-url')) { llamadas.push('permiso'); return responder(route, 200, { storageKey: 'k', uploadUrl: 'http://localhost/x', method: 'PUT', headers: {}, expiresAt: '2099-01-01T00:00:00Z' }); }
    if (pathname.endsWith('/evidence')) { llamadas.push('registro'); return responder(route, 200, {}); }
    return responder(route, 200, { items: [], total: 0 });
  });
  await page.route('**/almacen/subida', (route) => route.fulfill({ status: 200, body: '' }));
  return llamadas;
}

test('sólo ofrece comercios con oportunidad ganada y sin caso', async ({ page }) => {
  await instalar(page);
  await page.goto('/operaciones/crm/onboarding/crear');
  await page.getByTestId('select-accountId').click();
  await expect(page.getByRole('option', { name: 'Con oportunidad ganada' })).toHaveCount(1);
  await expect(page.getByRole('option', { name: 'Sin oportunidad ganada' })).toHaveCount(0);
  await expect(page.getByRole('option', { name: 'Ya tiene caso' })).toHaveCount(0);
});

test('cada requisito trae su espacio para el archivo desde el alta', async ({ page }) => {
  await instalar(page);
  await page.goto('/operaciones/crm/onboarding/crear');
  await expect(page.getByTestId('requisito-nit').getByRole('button', { name: /adjuntar archivo/i })).toBeVisible();
  await page.getByRole('button', { name: /agregar requisito adicional/i }).click();
  await expect(page.getByRole('button', { name: /adjuntar archivo/i })).toHaveCount(2);
  await expect(page.getByRole('button', { name: /pactar contrato/i })).toHaveCount(0);
});
