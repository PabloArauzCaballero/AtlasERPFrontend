/**
 * Batería contra el BACKEND REAL del portal del comercio.
 *
 * A diferencia de `partner-dossier.spec.ts`, aquí no hay simulado: se entra con la sesión real del
 * comercio y cada aserción mira lo que el backend sirve de verdad. Existe porque un typecheck
 * verde no prueba que la aplicación arranque —lo aprendimos con un módulo que compilaba y dejaba
 * al contenedor en bucle de reinicio— ni que una pantalla lea de donde dice leer.
 *
 * Requiere el stack levantado: AtlasERPFrontend en 3010 y su backend en 3007.
 */
import { expect, test } from '@playwright/test';

/**
 * Las capturas se versionan: son documentación del flujo, no un artefacto de la corrida. Cada
 * prueba deja la suya con el nombre de lo que demuestra, así que un cambio que rompa la pantalla
 * se ve en el diff de la imagen y no sólo en un aserto rojo.
 */
const EVIDENCIA = 'docs/visual-evidence/portal-comercio';

const COMERCIO = { email: 'pabliarca@gmail.com', password: '72107014Casa_' };

test.describe.configure({ mode: 'serial' });

/*
 * Margen amplio a propósito. Esto corre contra el stack local COMPLETO —dos backends, Postgres,
 * Redis, MinIO y el servidor de desarrollo— en la misma máquina, y el login hace hash de contraseña,
 * que es CPU pura. Con la máquina cargada el mismo login pasa de 0,2 s a 6 s sin que nada esté roto.
 * Un timeout corto aquí no detecta un fallo: fabrica uno.
 */
test.setTimeout(180_000);

/**
 * Ninguna pantalla puede quedarse en un error.
 *
 * Se comprueba aparte porque la primera version de estas pruebas miraba solo que las ETIQUETAS
 * estuvieran, y pasaba en verde con la cartera entera en cero y un «Error interno no controlado»
 * encima: el modelo del reclamo no estaba registrado en Sequelize. Una prueba que no mira el error
 * da una confianza peor que no tener prueba.
 */
async function sinErrores(page: import('@playwright/test').Page, donde: string) {
  await expect(page.getByText(/error interno|no se pudo|no fue posible/i), `error visible en ${donde}`).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  // La pestaña del comercio: su canal es distinto del interno a propósito.
  await page.getByRole('tab', { name: /comercio afiliado/i }).click();
  await page.locator('input[name="email"]').fill(COMERCIO.email);
  await page.locator('input[name="password"]').fill(COMERCIO.password);
  await page.getByRole('button', { name: /iniciar sesi/i }).click();
  await page.waitForURL(/\/portal-comercio\//, { timeout: 120_000 });
});

test('el menú ya no ofrece «Registro BNPL»', async ({ page }) => {
  const menu = page.getByRole('navigation').first();
  await expect(menu.getByText(/registro bnpl/i)).toHaveCount(0);
  // Y sí ofrece lo que lo sustituye.
  await expect(menu.getByText(/solicitudes de compra/i)).toBeVisible();
});

test('las tarifas se cobran por alcance y por clic, sin cuota ni tope de sucursales', async ({ page }) => {
  await page.goto('/portal-comercio/planes');
  await expect(page.getByRole('heading', { name: /tarifas de publicidad/i })).toBeVisible({ timeout: 120_000 });

  // Las dos unidades de cobro, en las tres tarifas.
  await expect(page.getByText(/por cada 1\.000 personas/i).first()).toBeVisible();
  await expect(page.getByText(/por clic recibido/i).first()).toBeVisible();
  expect(await page.getByText(/por cada 1\.000 personas/i).count()).toBe(3);

  // Ni cuota mensual ni topes de sucursal en ninguna tarjeta.
  await expect(page.getByText(/\/ mes/i)).toHaveCount(0);
  await expect(page.getByText(/hasta \d+ sucursal/i)).toHaveCount(0);
  expect(await page.getByText(/sucursales ilimitadas/i).count()).toBe(3);
  await page.screenshot({ path: `${EVIDENCIA}/05-tarifas.png`, fullPage: true });
});

test('las solicitudes de compra no tienen ningún campo editable', async ({ page }) => {
  await page.goto('/portal-comercio/solicitudes');
  await expect(page.getByRole('heading', { name: /solicitudes de compra/i })).toBeVisible({ timeout: 120_000 });

  // El expediente se resuelve solo: el portal sabe cuál es su comercio.
  await expect(page.getByText(/expediente \d+/i)).toBeVisible();
  await expect(page.getByText(/usted no puede editarlas/i)).toBeVisible();

  // Dentro de la cola no hay un solo control de entrada: sólo se acepta o se rechaza.
  const cola = page.locator('section, article').filter({ hasText: /esperando su respuesta/i }).first();
  await expect(cola.locator('input:not([type=hidden]), textarea')).toHaveCount(0);
  await sinErrores(page, 'solicitudes');
  await page.screenshot({ path: `${EVIDENCIA}/06-solicitudes.png`, fullPage: true });
});

test('el comercio es su propio anunciante: no hay que elegirlo', async ({ page }) => {
  await page.goto('/portal-comercio/campanas');
  await expect(page.getByRole('heading', { name: /campa/i }).first()).toBeVisible({ timeout: 120_000 });
  // El desplegable de anunciante desaparece cuando sólo hay uno, que es siempre para un comercio.
  await expect(page.getByLabel(/^anunciante$/i)).toHaveCount(0);
});

test('las sucursales se pueden crear, editar y dar de baja', async ({ page }) => {
  await page.goto('/portal-comercio/sucursales-usuarios');
  await expect(page.getByRole('heading', { name: /sucursales/i }).first()).toBeVisible({ timeout: 120_000 });

  const tabla = page.locator('table').first();
  await expect(tabla).toBeVisible({ timeout: 30_000 });

  // Las acciones que faltaban: antes sólo se podían crear.
  const editar = tabla.getByRole('button', { name: /editar/i }).first();
  await expect(editar).toBeVisible();
  await expect(tabla.getByRole('button', { name: /dar de baja|reactivar/i }).first()).toBeVisible();

  // Editar abre el formulario con los valores actuales, no vacío.
  await editar.click();
  const nombre = page.getByLabel(/nombre de sucursal/i).last();
  await expect(nombre).toBeVisible();
  await expect(nombre).not.toHaveValue('');
  await page.screenshot({ path: `${EVIDENCIA}/07-sucursales.png`, fullPage: true });
});

test('los comprobantes de transferencia los verifica el comercio', async ({ page }) => {
  await page.goto('/portal-comercio/comprobantes');
  await expect(page.getByRole('heading', { name: /comprobantes por verificar/i })).toBeVisible({ timeout: 120_000 });

  // El expediente se resuelve solo, igual que en solicitudes.
  await expect(page.getByText(/expediente \d+/i)).toBeVisible();
  // Y la pantalla dice de quién es la decisión y por qué.
  await expect(page.getByText(/el dinero entra en su cuenta/i)).toBeVisible();
  await expect(page.getByText(/por qué lo confirma usted/i)).toBeVisible();

  /*
   * Lee del backend: o hay comprobantes, o dice que no hay ninguno. Nunca un error.
   *
   * Se busca DENTRO del panel de la cola y no en toda la pagina: la tarjeta de metrica «Por
   * verificar» tambien es un `<article>`, asi que un localizador suelto casaba con dos cosas
   * distintas y fallaba por ambiguo en vez de por lo que se quiere comprobar.
   */
  const cola = page.locator('[data-tutorial-id="comprobantes-cola"]');
  await expect(cola).toBeVisible({ timeout: 30_000 });
  const vacio = cola.getByText(/no hay comprobantes esperando/i);
  const filas = cola.locator('article');
  await expect(vacio.or(filas.first())).toBeVisible({ timeout: 30_000 });
  await sinErrores(page, 'comprobantes');
  await page.screenshot({ path: `${EVIDENCIA}/04-comprobantes.png`, fullPage: true });
});

test('el menú ofrece verificar comprobantes', async ({ page }) => {
  const menu = page.getByRole('navigation').first();
  await expect(menu.getByText(/comprobantes por verificar/i)).toBeVisible();
});

test('la cartera resume, detalla y calendariza los cobros', async ({ page }) => {
  await page.goto('/portal-comercio/cartera');
  await expect(page.getByRole('heading', { name: /mi cartera/i })).toBeVisible({ timeout: 120_000 });

  // El panel: las cuatro cifras que el comercio mira primero.
  const resumen = page.locator('[data-tutorial-id="cartera-resumen"]');
  await expect(resumen.getByText(/por cobrar/i)).toBeVisible();
  await expect(resumen.getByText(/vencido/i).first()).toBeVisible();
  await expect(resumen.getByText(/cobrado/i)).toBeVisible();
  // La cuarta tarjeta pasó a ser la comisión: es la cifra que el comercio pregunta más.
  await expect(resumen.getByText(/debe a atlas/i)).toBeVisible();
  await sinErrores(page, 'cartera · panel');
  await page.screenshot({ path: `${EVIDENCIA}/01-panel.png`, fullPage: true });

  // Créditos pendientes con su detalle.
  await page.getByRole('button', { name: /^créditos$/i }).click();
  await expect(page.locator('[data-tutorial-id="cartera-creditos"]')).toBeVisible();
  await sinErrores(page, 'cartera · créditos');
  await page.screenshot({ path: `${EVIDENCIA}/02-creditos.png`, fullPage: true });

  // Calendario de cobros por día.
  await page.getByRole('button', { name: /^calendario$/i }).click();
  await expect(page.locator('[data-tutorial-id="cartera-calendario"]')).toBeVisible();
  await sinErrores(page, 'cartera · calendario');
  await page.screenshot({ path: `${EVIDENCIA}/03-calendario.png`, fullPage: true });

  // Comision: cuanto se le cobra por venta y cuanto le debe a Atlas.
  await page.getByRole('button', { name: /^comisión$/i }).click();
  await expect(page.locator('[data-tutorial-id="cartera-comision"]')).toBeVisible();
  await expect(page.getByText(/debe a atlas/i).first()).toBeVisible();
  await expect(page.getByText(/de dónde sale este porcentaje/i)).toBeVisible();
  await sinErrores(page, 'cartera · comisión');
  await page.screenshot({ path: `${EVIDENCIA}/09-comision.png`, fullPage: true });

  // La cartera no revela a quién se le debe.
  await expect(page.getByText(/por qué no ve nombres/i)).toBeVisible();
});

test('ninguna pantalla del portal pide escribir un UUID', async ({ page }) => {
  for (const ruta of ['/portal-comercio/solicitudes', '/portal-comercio/comprobantes', '/portal-comercio/cartera', '/portal-comercio/planes', '/portal-comercio/sucursales-usuarios', '/portal-comercio/facturacion']) {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/\bUUID\b/i), `«UUID» visible en ${ruta}`).toHaveCount(0);
    await sinErrores(page, ruta);
  }
});
