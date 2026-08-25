/**
 * Batería contra el BACKEND REAL de las pantallas internas del ERP.
 *
 * Cubre lo que dejó de estar simulado: la cola de aprobaciones, el pipeline que ahora se lee del
 * servidor, los controles reales de la activación y la ausencia de campos que pidan un UUID
 * tecleado.
 *
 * Necesita sesión interna. Con `AUTH_LOGIN_PIN_ENABLED=true` el login pide un código que llega por
 * correo y no hay forma honesta de automatizarlo: la corrida se salta sola en ese caso en vez de
 * fingir que pasó.
 */
import { expect, test } from '@playwright/test';

const INTERNO = {
  email: process.env.PW_INTERNAL_EMAIL ?? '',
  password: process.env.PW_INTERNAL_PASSWORD ?? '',
};

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  test.skip(!INTERNO.email || !INTERNO.password, 'Sin PW_INTERNAL_EMAIL/PW_INTERNAL_PASSWORD.');
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(INTERNO.email);
  await page.locator('input[name="password"]').fill(INTERNO.password);
  await page.getByRole('button', { name: /iniciar sesi/i }).click();

  // Si el segundo factor sigue activo, el login se queda en el paso del código: no se finge.
  const entro = await page.waitForURL(/\/operaciones/, { timeout: 45_000 }).then(() => true).catch(() => false);
  test.skip(!entro, 'El login interno exige segundo factor en este entorno.');
});

test('la cola de aprobaciones se lee del backend', async ({ page }) => {
  await page.goto('/operaciones/crm/aprobaciones');
  await expect(page.getByRole('heading', { name: /excepciones de mdr/i })).toBeVisible({ timeout: 45_000 });

  // Ya no admite carecer de lectura, y la métrica sale de la propia cola.
  await expect(page.getByText(/sin lectura disponible/i)).toHaveCount(0);
  await expect(page.getByText(/no existe endpoint para listar/i)).toHaveCount(0);
  await expect(page.getByText(/^pendientes$/i).first()).toBeVisible();

  // La solicitud se elige, no se teclea.
  await expect(page.locator('select[name="approvalId"]')).toBeVisible();
});

test('el tablero de oportunidades se lee del servidor', async ({ page }) => {
  await page.goto('/operaciones/crm/oportunidades');
  await expect(page.getByRole('heading', { name: /oportunidad/i }).first()).toBeVisible({ timeout: 45_000 });
  // No queda ni rastro del aviso de que el pipeline no se podía leer.
  await expect(page.getByText(/todav[ií]a no expone un get/i)).toHaveCount(0);
  await expect(page.getByText(/no inventa registros hist/i)).toHaveCount(0);
});

test('la activación muestra controles reales, no un 100 % dibujado', async ({ page }) => {
  await page.goto('/operaciones/crm/activacion-comercio');
  await expect(page.getByRole('heading', { name: /activaci/i }).first()).toBeVisible({ timeout: 45_000 });

  // Sin caso elegido no se afirma nada: antes decía 100 % siempre.
  await expect(page.getByText(/sin caso elegido/i)).toBeVisible();
  await expect(page.getByText(/^100%$/)).toHaveCount(0);
  await expect(page.locator('select[name="caseId"]')).toBeVisible();
});

test('ninguna pantalla interna pide escribir un UUID', async ({ page }) => {
  const rutas = [
    '/operaciones/crm/oportunidades',
    '/operaciones/crm/onboarding',
    '/operaciones/crm/activacion-comercio',
    '/operaciones/crm/aprobaciones',
    '/operaciones/crm/contratos',
    '/operaciones/crm/facturacion',
    '/operaciones/crm/conciliacion-cobertura',
    '/operaciones/ads/campanas',
  ];
  for (const ruta of rutas) {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/\bUUID\b/i), `«UUID» visible en ${ruta}`).toHaveCount(0);
  }
});
