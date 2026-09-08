/**
 * Evidencia de la cola de onboarding contra el BACKEND REAL, con la sesión fingida.
 *
 * Lo único simulado es `auth/me` y el token: el backend corre con
 * `AUTH_DISABLED_FOR_LOCAL_TESTING=true`, que da un ADMIN local a las peticiones SIN
 * `Authorization`, así que aquí se quita esa cabecera antes de dejar pasar cada llamada. Todo lo
 * demás —la cola, el tablero, los filtros, las acciones de fila— llega de `/b2b/onboarding/*` de
 * verdad. Corre con `PW_ONBOARDING_EVIDENCIA=1`; sin eso se salta, porque necesita ese backend.
 */
import { expect, test, type Page } from '@playwright/test';

const ADMIN = {
  id: '1', tenantId: '1', email: 'admin@atlas.test', fullName: 'Admin de pruebas', name: 'Admin de pruebas',
  userCode: null, status: 'ACTIVE', department: null, jobTitle: null, mustChangePassword: false, mfaEnabled: false,
  roles: ['ADMIN'], legacyRoles: ['ADMIN'], permissions: [],
};

async function sesionInternaFingida(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('atlas_access_token', 'e2e-internal-token');
    window.localStorage.setItem('atlas_session_kind', 'internal');
  });
  await page.route('**/api/v1/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { user: ADMIN } }) }));
  await page.route('**/api/v1/**', (route) => {
    if (route.request().url().includes('/auth/me')) return route.fallback();
    const { authorization: _quitada, Authorization: _quitada2, ...headers } = route.request().headers();
    return route.continue({ headers });
  });
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

const API = process.env.PW_ERP_API ?? 'http://127.0.0.1:3017/api/v1';

/** El comercio con caso abierto que usan las pruebas. Lo abre la propia batería si no hay ninguno. */
let comercio = '';

test.beforeAll(async ({ request }) => {
  test.skip(!process.env.PW_ONBOARDING_EVIDENCIA, 'Necesita el backend local sin auth (PW_ONBOARDING_EVIDENCIA=1).');
  const abiertos = await (await request.get(`${API}/b2b/onboarding/cases?scope=abiertos`)).json();
  const primero = abiertos.data?.items?.[0];
  if (primero) { comercio = String(primero.tradeName); return; }

  // Ninguno abierto: se abre uno sobre la primera cuenta que no tenga caso, por la API real.
  const cuentas = (await (await request.get(`${API}/b2b/accounts?page=1&limit=50`)).json()).data.items as Array<{ id: string; tradeName: string }>;
  const todos = (await (await request.get(`${API}/b2b/onboarding/cases?scope=todos&limit=200`)).json()).data.items as Array<{ accountId: string }>;
  const ocupadas = new Set(todos.map((c) => c.accountId));
  const libre = cuentas.find((c) => !ocupadas.has(c.id));
  if (!libre) throw new Error('No hay cuenta B2B sin caso de onboarding para abrir uno.');
  const usuarios = (await (await request.get(`${API}/auth/users`)).json()).data?.items as Array<{ id: string }> | undefined;
  const ownerUserId = usuarios?.[0]?.id ?? '00000000-0000-0000-0000-000000000001';
  const creado = await request.post(`${API}/b2b/onboarding/cases`, { data: { accountId: libre.id, ownerUserId, checklistItems: [{ itemType: 'LEGAL', description: 'NIT vigente' }] } });
  if (!creado.ok()) throw new Error(`No se pudo abrir el caso: ${await creado.text()}`);
  comercio = libre.tradeName;
});

test.beforeEach(async ({ page }) => {
  test.skip(!process.env.PW_ONBOARDING_EVIDENCIA, 'Necesita el backend local sin auth (PW_ONBOARDING_EVIDENCIA=1).');
  await sesionInternaFingida(page);
});

test('la cola arranca en «Por atender» y los activados sólo salen en el historial', async ({ page }) => {
  await page.goto('/operaciones/crm/onboarding');
  await expect(page.getByRole('heading', { name: /casos de onboarding/i })).toBeVisible({ timeout: 120_000 });

  // Dos pestañas y nada más.
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.getByTestId('tab-usuarios')).toHaveCount(0);
  await expect(page.getByTestId('tab-mdr')).toHaveCount(0);

  const tabla = page.locator('[data-tutorial-id="crud-tabla"]');
  await expect(page.locator('[data-tutorial-id="onboarding-tablero"]')).toBeVisible();
  await expect(page.getByTestId('onboarding-scope-abiertos')).toHaveAttribute('aria-checked', 'true');
  await expect(tabla.getByText(comercio)).toBeVisible();
  await expect(tabla.getByText(/^COMPLETED$/)).toHaveCount(0);
  await page.screenshot({ path: 'docs/visual-evidence/operaciones/onboarding-01-por-atender.png', fullPage: true });

  await page.getByTestId('onboarding-scope-historial').click();
  await expect(tabla.getByText(/^COMPLETED$/).first()).toBeVisible();
  await expect(tabla.getByText(comercio)).toHaveCount(0);
  await page.screenshot({ path: 'docs/visual-evidence/operaciones/onboarding-02-activados.png', fullPage: true });
});

test('todo se hace desde la fila: requisito, contrato, credenciales, activar', async ({ page }) => {
  await page.goto('/operaciones/crm/onboarding');
  const fila = page.locator('[data-tutorial-id="crud-tabla"] tbody tr', { hasText: comercio });
  await expect(fila).toBeVisible({ timeout: 120_000 });
  await expect(fila.getByTitle(/mover un requisito/i)).toBeVisible();
  await expect(fila.getByTitle(/pactar contrato/i)).toBeVisible();
  await expect(fila.getByTitle(/pedir credenciales/i)).toBeVisible();
  await expect(fila.getByTitle(/activar comercio/i)).toBeVisible();

  await fila.getByTitle(/mover un requisito/i).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('select[name="checklistItemId"] option', { hasText: /NIT vigente/ })).toHaveCount(1);
  await page.screenshot({ path: 'docs/visual-evidence/operaciones/onboarding-03-mover-requisito.png', fullPage: true });
  await page.keyboard.press('Escape');

  await page.getByTestId('tab-nuevo').click();
  await expect(page.locator('select[name="accountId"]')).toBeVisible();
  await expect(page.locator('select[name="caseId"]')).toHaveCount(0);
  await page.screenshot({ path: 'docs/visual-evidence/operaciones/onboarding-04-nuevo-caso.png', fullPage: true });
});

test('la pantalla de activación redirige y la comisión vive con el contrato', async ({ page }) => {
  await page.goto('/operaciones/crm/activacion-comercio');
  await expect(page).toHaveURL(/\/operaciones\/crm\/onboarding/, { timeout: 120_000 });

  await page.goto('/operaciones/crm/contratos');
  await expect(page.locator('[data-tutorial-id="mdr-reglas"]')).toBeVisible({ timeout: 120_000 });
});
