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

/*
 * Margen amplio a propósito. Esto corre contra el stack local COMPLETO —dos backends, Postgres,
 * Redis, MinIO y el servidor de desarrollo— en la misma máquina, y el login hace hash de contraseña,
 * que es CPU pura. Con la máquina cargada el mismo login pasa de 0,2 s a 6 s sin que nada esté roto.
 * Un timeout corto aquí no detecta un fallo: fabrica uno.
 */
test.setTimeout(180_000);

test.beforeEach(async ({ page }) => {
  test.skip(!INTERNO.email || !INTERNO.password, 'Sin PW_INTERNAL_EMAIL/PW_INTERNAL_PASSWORD.');
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(INTERNO.email);
  await page.locator('input[name="password"]').fill(INTERNO.password);
  await page.getByRole('button', { name: /iniciar sesi/i }).click();

  // Si el segundo factor sigue activo, el login se queda en el paso del código: no se finge.
  const entro = await page.waitForURL(/\/operaciones/, { timeout: 120_000 }).then(() => true).catch(() => false);
  test.skip(!entro, 'El login interno exige segundo factor en este entorno.');
});

test('la cola de aprobaciones muestra TODAS las solicitudes, no solo las pendientes', async ({ page }) => {
  await page.goto('/operaciones/crm/aprobaciones');
  await expect(page.getByRole('heading', { name: /excepciones comerciales/i })).toBeVisible({ timeout: 120_000 });

  // Ya no admite carecer de lectura.
  await expect(page.getByText(/sin lectura disponible/i)).toHaveCount(0);
  await expect(page.getByText(/no existe endpoint para listar/i)).toHaveCount(0);

  /*
   * La tabla abre la vista, con filtro por estado. Antes esta pantalla pedía solo `onlyPending`,
   * así que una solicitud ya decidida desaparecía y la vista quedaba vacía sin explicar por qué.
   */
  await expect(page.locator('[data-tutorial-id="crud-tabla"]')).toBeVisible();
  await expect(page.locator('select[name="filtro-status"]')).toBeVisible();

  /*
   * La decisión se toma DESDE la fila: ya no hay pestaña que vuelva a pedir en un desplegable la
   * solicitud que se está mirando. El icono solo aparece en las que siguen pendientes.
   */
  const pendiente = page.locator('tr', { has: page.getByText('PENDING') }).first();
  if (await pendiente.count()) {
    await pendiente.getByRole('button', { name: /registrar decisi/i }).click();
    await expect(page.locator('select[name="status"]')).toBeVisible();
    await expect(page.locator('textarea[name="reason"]')).toBeVisible();
  }
});

test('las propuestas se leen, se filtran y se pueden corregir desde la propia fila', async ({ page }) => {
  await page.goto('/operaciones/crm/propuestas');
  await expect(page.getByRole('heading', { name: /propuestas comerciales/i })).toBeVisible({ timeout: 120_000 });

  // La tabla es la pantalla: el alta es un botón, no lo primero que se ve.
  await expect(page.locator('[data-tutorial-id="crud-tabla"]')).toBeVisible();
  await expect(page.getByTestId('crud-buscar')).toBeVisible();
  await expect(page.getByTestId('crud-crear')).toBeVisible();

  // Y el constructor sigue estando, en su pestaña.
  await page.getByTestId('tab-nueva').click();
  await expect(page.locator('select[name="opportunityId"]')).toBeVisible();
});

test('el tablero de oportunidades se lee del servidor', async ({ page }) => {
  await page.goto('/operaciones/crm/oportunidades');
  await expect(page.getByRole('heading', { name: /oportunidad/i }).first()).toBeVisible({ timeout: 120_000 });
  // No queda ni rastro del aviso de que el pipeline no se podía leer.
  await expect(page.getByText(/todav[ií]a no expone un get/i)).toHaveCount(0);
  await expect(page.getByText(/no inventa registros hist/i)).toHaveCount(0);
});

test('la activación muestra controles reales, no un 100 % dibujado', async ({ page }) => {
  await page.goto('/operaciones/crm/activacion-comercio');
  await expect(page.getByRole('heading', { name: /activaci/i }).first()).toBeVisible({ timeout: 120_000 });

  // Lo primero es qué casos hay y cuántos requisitos les faltan.
  await expect(page.locator('[data-tutorial-id="crud-tabla"]')).toBeVisible();

  // El control vive en su pestaña. Sin caso elegido no se afirma nada: antes decía 100 % siempre.
  await page.getByTestId('tab-activar').click();
  await expect(page.getByText(/sin caso elegido/i)).toBeVisible();
  await expect(page.getByText(/^100%$/)).toHaveCount(0);
  await expect(page.locator('select[name="caseId"]')).toBeVisible();
});

test('la comisión por venta se configura en el alta, por segmento', async ({ page }) => {
  await page.goto('/operaciones/crm/onboarding');
  // El alta se repartió en pestañas; las reglas de comisión tienen la suya.
  await page.getByTestId('tab-mdr').click();
  const panel = page.locator('[data-tutorial-id="mdr-reglas"]');
  await expect(panel).toBeVisible({ timeout: 120_000 });

  // Es parte del alta, no una pantalla suelta.
  await expect(panel.getByText(/se acuerda en el alta/i)).toBeVisible();
  // Y la segmentación es lo que la hace flexible.
  await expect(panel.locator('select[name="contractVersionId"]')).toBeVisible();
  await page.screenshot({ path: 'docs/visual-evidence/operaciones/01-comision-en-el-alta.png', fullPage: true });
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
    '/operaciones/crm/propuestas',
    '/operaciones/ads/campanas',
  ];
  for (const ruta of rutas) {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/\bUUID\b/i), `«UUID» visible en ${ruta}`).toHaveCount(0);
  }
});
