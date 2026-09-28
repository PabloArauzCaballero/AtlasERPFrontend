/**
 * Un requisito guarda UN archivo, y la carpeta del comercio se enlaza UNA vez: la pantalla lo dice.
 *
 * Backend simulado. Lo que se comprueba es lo que vio Pablo el 2026-09-28: tras subir el archivo de
 * un requisito, el modal seguía diciendo «pendiente» y el segundo archivo pisaba al primero sin
 * aviso; y «Enlazar expediente de Atlas» respondía «Operación registrada» aunque la carpeta ya
 * estuviera asignada.
 */
import { expect, test, type Page, type Route } from '@playwright/test';

const CASO_ID = '22222222-2222-4222-8222-222222222222';
const ITEM_ID = '33333333-3333-4333-8333-333333333333';
const COMERCIO = 'Comercio con carpeta';

function responder(route: Route, status: number, data: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(status < 400 ? { success: true, data } : { success: false, error: data }),
  });
}

async function instalar(page: Page, { enlazado }: { enlazado: boolean }) {
  let evidenciaSubidaEn: string | null = null;
  const llamadas = { registros: 0, enlaces: 0 };
  const caso = () => ({
    id: CASO_ID, tradeName: COMERCIO, status: 'OPEN', pendingItems: 1,
    partnerProfileId: enlazado ? '44444444-4444-4444-8444-444444444444' : null,
    checklistItems: [{
      id: ITEM_ID, itemType: 'LEGAL', description: 'NIT vigente del comercio', status: 'PENDING',
      requiresEvidence: true, hasEvidence: Boolean(evidenciaSubidaEn), evidenceUploadedAt: evidenciaSubidaEn,
    }],
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('atlas_session_kind', 'internal');
  });
  await page.route('**/almacen/subida', (route) => route.fulfill({ status: 200, body: '' }));
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    // La cookie de refresco real es httpOnly: se finge la respuesta que la canjea por un token.
    if (path.endsWith('/auth/refresh')) return responder(route, 200, { accessToken: 'e2e-internal-token' });
    if (path.endsWith('/auth/me')) {
      return responder(route, 200, { user: { id: '1', email: 'admin@atlas.test', fullName: 'Admin', status: 'ACTIVE', roles: ['ADMIN'], permissions: ['partner.kyb.request', 'merchant.users.request'] } });
    }
    if (path.endsWith('/evidence/upload-url')) {
      return responder(route, 200, { storageKey: 'erp/evidencia.pdf', uploadUrl: 'http://minio.local/erp/evidencia.pdf', method: 'PUT', requiredHeaders: {}, expiresAt: '2099-01-01T00:00:00Z' });
    }
    if (path.endsWith(`/checklist/${ITEM_ID}/evidence`) && route.request().method() === 'POST') {
      llamadas.registros += 1;
      evidenciaSubidaEn = '2026-09-28T12:00:00.000Z';
      return responder(route, 200, caso());
    }
    if (path.endsWith(`/cases/${CASO_ID}/partner-link`)) {
      llamadas.enlaces += 1;
      return responder(route, 200, { id: CASO_ID, partnerProfileId: null, linked: false, reason: 'SIN_EXPEDIENTE_EN_ATLAS' });
    }
    if (path.endsWith('/b2b/onboarding/cases/summary')) return responder(route, 200, { abiertos: 1 });
    if (path.endsWith('/b2b/onboarding/cases')) return responder(route, 200, { items: [caso()], total: 1 });
    return responder(route, 200, { items: [], total: 0 });
  });
  return llamadas;
}

const pdf = (nombre: string) => ({ name: nombre, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') });

async function abrirAccion(page: Page, nombre: RegExp) {
  const fila = page.locator('[data-tutorial-id="crud-tabla"] tbody tr', { hasText: COMERCIO });
  await expect(fila).toBeVisible({ timeout: 120_000 });
  const directa = fila.getByTitle(nombre);
  if (await directa.count()) { await directa.first().click(); return; }
  await fila.getByTitle(/más acciones/i).click();
  await page.getByRole('button', { name: nombre }).first().click();
}

test('el segundo archivo de un requisito avisa de que reemplaza al primero', async ({ page }) => {
  const llamadas = await instalar(page, { enlazado: true });
  await page.goto('/operaciones/crm/onboarding');
  await abrirAccion(page, /adjuntar archivo de un requisito/i);

  const modal = page.getByRole('dialog');
  await expect(modal.getByText(/este requisito ya tiene un archivo/i)).toHaveCount(0);
  await modal.getByTestId('campo-evidencia').setInputFiles(pdf('nit-primero.pdf'));
  await expect(modal.getByTestId('btn-adjuntar-evidencia')).toHaveText(/adjuntar archivo/i);
  await modal.getByTestId('btn-adjuntar-evidencia').click();
  await expect(modal.getByText(/quedó registrado/i)).toBeVisible();

  // Sin cerrar el modal: el requisito ya dice que tiene archivo y el botón, que reemplaza.
  await expect(modal.getByText(/este requisito ya tiene un archivo/i)).toBeVisible();
  await expect(modal.getByText(/reemplazará al anterior/i)).toBeVisible();
  await modal.getByTestId('campo-evidencia').setInputFiles(pdf('nit-segundo.pdf'));
  await expect(modal.getByTestId('btn-adjuntar-evidencia')).toHaveText(/reemplazar archivo/i);
  await page.screenshot({ path: 'test-results/onboarding-reemplazo-archivo.png', fullPage: true });
  await modal.getByTestId('btn-adjuntar-evidencia').click();
  await expect(modal.getByText(/reemplazó al archivo anterior/i)).toBeVisible();
  expect(llamadas.registros).toBe(2);
});

test('enlazar con la carpeta ya asignada lo dice y no vuelve a llamar', async ({ page }) => {
  const llamadas = await instalar(page, { enlazado: true });
  await page.goto('/operaciones/crm/onboarding');
  await abrirAccion(page, /enlazar expediente de atlas/i);
  await expect(page.getByText(/esta cuenta ya tiene su carpeta en atlas/i)).toBeVisible();
  await expect(page.getByText(/operación registrada/i)).toHaveCount(0);
  await page.screenshot({ path: 'test-results/onboarding-enlace-ya-hecho.png', fullPage: true });
  expect(llamadas.enlaces).toBe(0);
});

test('enlazar sin expediente en Atlas avisa en vez de dar por hecho', async ({ page }) => {
  const llamadas = await instalar(page, { enlazado: false });
  await page.goto('/operaciones/crm/onboarding');
  await abrirAccion(page, /enlazar expediente de atlas/i);
  await expect(page.getByText(/atlas no tiene expediente para este comercio/i)).toBeVisible();
  await expect(page.getByText(/operación registrada/i)).toHaveCount(0);
  expect(llamadas.enlaces).toBe(1);
});
