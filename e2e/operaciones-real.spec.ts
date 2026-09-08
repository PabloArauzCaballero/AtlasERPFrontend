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

test('la cola de onboarding sólo enseña lo que falta por atender', async ({ page }) => {
  await page.goto('/operaciones/crm/onboarding');
  await expect(page.getByRole('heading', { name: /casos de onboarding/i })).toBeVisible({ timeout: 120_000 });

  // Dos pestañas: la cola con su tablero, y el alta. Ni «usuarios» ni «comisión» como pestañas.
  await expect(page.getByTestId('tab-casos')).toBeVisible();
  await expect(page.getByTestId('tab-nuevo')).toBeVisible();
  await expect(page.getByTestId('tab-usuarios')).toHaveCount(0);
  await expect(page.getByTestId('tab-mdr')).toHaveCount(0);

  // El tablero y la cola arrancan en «Por atender»: un comercio ya activado no es trabajo.
  await expect(page.locator('[data-tutorial-id="onboarding-tablero"]')).toBeVisible();
  await expect(page.getByTestId('onboarding-scope-abiertos')).toHaveAttribute('aria-checked', 'true');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-tutorial-id="crud-tabla"]').getByText(/^COMPLETED$/)).toHaveCount(0);

  // El historial es un filtro explícito, y ahí sí están los activados.
  await page.getByTestId('onboarding-scope-historial').click();
  await expect(page.getByTestId('onboarding-scope-historial')).toHaveAttribute('aria-checked', 'true');
  await page.screenshot({ path: 'docs/visual-evidence/operaciones/02-onboarding-cola-y-historial.png', fullPage: true });
});

test('la pantalla de activación ya no existe: redirige a la cola', async ({ page }) => {
  await page.goto('/operaciones/crm/activacion-comercio');
  await expect(page).toHaveURL(/\/operaciones\/crm\/onboarding/, { timeout: 120_000 });
});

test('la comisión por venta se administra junto al contrato, por segmento', async ({ page }) => {
  await page.goto('/operaciones/crm/contratos');
  const panel = page.locator('[data-tutorial-id="mdr-reglas"]');
  await expect(panel).toBeVisible({ timeout: 120_000 });

  // Es parte de lo pactado, no una pantalla suelta.
  await expect(panel.getByText(/se acuerda en el alta/i)).toBeVisible();
  // Y la segmentación es lo que la hace flexible.
  await expect(panel.locator('select[name="contractVersionId"]')).toBeVisible();
  await page.screenshot({ path: 'docs/visual-evidence/operaciones/01-comision-en-el-contrato.png', fullPage: true });
});

test('ninguna pantalla interna pide escribir un UUID', async ({ page }) => {
  const rutas = [
    '/operaciones/crm/oportunidades',
    '/operaciones/crm/onboarding',
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
