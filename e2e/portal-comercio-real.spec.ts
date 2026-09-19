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

/*
 * Las credenciales NO viven aqui. Este repositorio es PUBLICO y una contrasena commiteada se queda
 * en el historial para siempre aunque se borre despues: hay que rotarla, no solo quitarla. Sin las
 * variables la prueba se SALTA, que es honesto — no pasa en verde sin haber probado nada.
 */
const COMERCIO = {
  email: process.env.PW_MERCHANT_EMAIL ?? '',
  password: process.env.PW_MERCHANT_PASSWORD ?? '',
};

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
  test.skip(!COMERCIO.email || !COMERCIO.password, 'Sin PW_MERCHANT_EMAIL/PW_MERCHANT_PASSWORD.');
  await page.goto('/login');
  // La pestaña del comercio: su canal es distinto del interno a propósito.
  await page.getByRole('tab', { name: /comercio afiliado/i }).click();
  await page.locator('input[name="email"]').fill(COMERCIO.email);
  await page.locator('input[name="password"]').fill(COMERCIO.password);
  await page.getByRole('button', { name: /iniciar sesi/i }).click();
  await page.waitForURL(/\/portal-comercio\//, { timeout: 120_000 });
});

test('el menú del comercio son cinco entradas, y ni «Planes» ni «Campañas» están entre ellas', async ({ page }) => {
  const menu = page.getByRole('navigation').first();
  await expect(menu.getByText(/registro bnpl/i)).toHaveCount(0);
  /*
   * Las tres que se retiraron el 2026-09-18. Se comprueban por ausencia y no sólo contando: un
   * menú de cinco con la entrada equivocada dentro también daría cinco.
   */
  await expect(menu.getByText(/planes y suscripci/i)).toHaveCount(0);
  await expect(menu.getByText(/^campañas$/i)).toHaveCount(0);
  await expect(menu.getByText(/formularios en papel/i)).toHaveCount(0);
  for (const entrada of [/gestión pos/i, /mi cartera/i, /consumo y facturación/i, /mi empresa/i, /soporte y tutoriales/i]) {
    await expect(menu.getByText(entrada)).toBeVisible();
  }
  await expect(menu.getByRole('link')).toHaveCount(5);
});

test('las rutas retiradas del portal llevan a donde vive ahora su contenido', async ({ page }) => {
  /*
   * Las URLs viejas siguen existiendo fuera de aquí —marcadores del comercio, enlaces que soporte
   * mandó por escrito—, así que no pueden morir en un 404.
   */
  const destinos: Array<[string, RegExp]> = [
    ['/portal-comercio/solicitudes', /\/portal-comercio\/gestion-pos\?tab=solicitudes$/],
    ['/portal-comercio/comprobantes', /\/portal-comercio\/gestion-pos\?tab=comprobantes$/],
    ['/portal-comercio/qr-cobro', /\/portal-comercio\/expediente\?tab=qr$/],
    ['/portal-comercio/sucursales-usuarios', /\/portal-comercio\/expediente\?tab=sucursales$/],
    ['/portal-comercio/tutoriales', /\/portal-comercio\/soporte\?tab=tutoriales$/],
    ['/portal-comercio/planes', /\/portal-comercio\/gestion-pos$/],
    ['/portal-comercio/campanas', /\/portal-comercio\/gestion-pos$/],
    ['/portal-comercio/formularios', /\/portal-comercio\/expediente$/],
  ];
  for (const [vieja, destino] of destinos) {
    await page.goto(vieja);
    await expect(page, `${vieja} no redirige`).toHaveURL(destino, { timeout: 60_000 });
  }
});

test('las solicitudes de compra no tienen ningún campo editable', async ({ page }) => {
  await page.goto('/portal-comercio/gestion-pos?tab=solicitudes');
  await expect(page.getByRole('heading', { name: /gestión pos/i })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole('tab', { name: /solicitudes de compra/i })).toHaveAttribute('aria-selected', 'true');

  // El expediente se resuelve solo: el portal sabe cuál es su comercio.
  await expect(page.getByText(/expediente \d+/i).first()).toBeVisible();
  await expect(page.getByText(/usted no puede editarlas/i)).toBeVisible();

  // Dentro de la cola no hay un solo control de entrada: sólo se acepta o se rechaza.
  const cola = page.locator('section, article').filter({ hasText: /esperando su respuesta/i }).first();
  await expect(cola.locator('input:not([type=hidden]), textarea')).toHaveCount(0);
  await sinErrores(page, 'solicitudes');
  await page.screenshot({ path: `${EVIDENCIA}/06-solicitudes.png`, fullPage: true });
});

test('las sucursales se pueden crear, editar y dar de baja', async ({ page }) => {
  await page.goto('/portal-comercio/expediente?tab=sucursales');
  await expect(page.getByRole('heading', { name: /mi empresa/i }).first()).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole('tab', { name: /^sucursales$/i })).toHaveAttribute('aria-selected', 'true');

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
  await page.goto('/portal-comercio/gestion-pos?tab=comprobantes');
  await expect(page.getByRole('tab', { name: /comprobantes por verificar/i })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: /esperando su confirmación/i })).toBeVisible({ timeout: 120_000 });

  // El expediente se resuelve solo, igual que en solicitudes.
  await expect(page.getByText(/expediente \d+/i).first()).toBeVisible();
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

test('verificar comprobantes se alcanza desde el menú en dos pasos', async ({ page }) => {
  /*
   * Ya no es una entrada del menú: es una pestaña de «Gestión POS». Lo que hay que seguir
   * garantizando es que se llegue sin saber la URL, porque es trabajo diario del mostrador.
   */
  const menu = page.getByRole('navigation').first();
  await menu.getByText(/gestión pos/i).click();
  await page.getByRole('tab', { name: /comprobantes por verificar/i }).click();
  await expect(page).toHaveURL(/tab=comprobantes/, { timeout: 60_000 });
  await expect(page.getByRole('heading', { name: /esperando su confirmación/i })).toBeVisible({ timeout: 60_000 });
});

test('la cartera resume, detalla y calendariza los cobros', async ({ page }) => {
  await page.goto('/portal-comercio/cartera');
  await expect(page.getByRole('heading', { name: /mi cartera/i })).toBeVisible({ timeout: 120_000 });

  // El panel: las cuatro cifras que el comercio mira primero.
  const resumen = page.locator('[data-tutorial-id="cartera-resumen"]');
  await expect(resumen.getByText(/por cobrar/i)).toBeVisible();
  await expect(resumen.getByText(/vencido/i).first()).toBeVisible();
  // `.first()` como en «vencido»: el detalle bajo la cifra repite la palabra, y el modo estricto
  // de Playwright convierte esa repetición en un fallo que no habla de la pantalla.
  await expect(resumen.getByText(/cobrado/i).first()).toBeVisible();
  // La cuarta tarjeta pasó a ser la comisión: es la cifra que el comercio pregunta más. El rótulo
  // que pinta la pantalla es «Comisión a Atlas»; la prueba se había quedado con uno anterior.
  await expect(resumen.getByText(/comisión a atlas/i)).toBeVisible();
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
  await expect(page.getByText(/comisión a atlas/i).first()).toBeVisible();
  // El aviso que explica que la comisión se devenga al cobrar, no al vender. Se llamaba «De dónde
  // sale este porcentaje» y hoy es «Cómo se cobra»: la prueba se había quedado con el rótulo viejo.
  await expect(page.getByText(/cómo se cobra/i)).toBeVisible();
  await sinErrores(page, 'cartera · comisión');
  await page.screenshot({ path: `${EVIDENCIA}/09-comision.png`, fullPage: true });

  // La cartera no revela a quién se le debe.
  await expect(page.getByText(/por qué no ve nombres/i)).toBeVisible();
});

/*
 * El negocio es el que inició sesión.
 *
 * Esta afirmación se recorre pantalla por pantalla porque el fallo se repartía por varias: cuatro
 * de ellas leían `requiresAccountSelection`, que el backend también levanta para el staff interno,
 * así que al comercio le pintaban un desplegable con TODOS los comercios de la plataforma —y en
 * local, donde el bypass de auth convertía en ADMIN a todo el que entraba, salía siempre—.
 */
test('ninguna pestaña del portal pregunta de qué comercio se trata', async ({ page }) => {
  for (const ruta of ['/portal-comercio/gestion-pos', '/portal-comercio/facturacion', '/portal-comercio/expediente?tab=sucursales', '/portal-comercio/expediente?tab=qr', '/portal-comercio/expediente']) {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/seleccione un comercio|elija un comercio/i), `selector de comercio en ${ruta}`).toHaveCount(0);
    await expect(page.getByLabel('Comercio a consultar'), `selector de comercio en ${ruta}`).toHaveCount(0);
    await sinErrores(page, ruta);
  }
});

test('ninguna pantalla del portal pide escribir un UUID', async ({ page }) => {
  for (const ruta of ['/portal-comercio/gestion-pos?tab=solicitudes', '/portal-comercio/gestion-pos?tab=comprobantes', '/portal-comercio/cartera', '/portal-comercio/expediente?tab=sucursales', '/portal-comercio/soporte', '/portal-comercio/facturacion']) {
    await page.goto(ruta);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/\bUUID\b/i), `«UUID» visible en ${ruta}`).toHaveCount(0);
    await sinErrores(page, ruta);
  }
});
