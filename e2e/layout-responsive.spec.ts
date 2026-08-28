/**
 * Batería de LAYOUT: que ninguna pantalla se rompa al estrecharla.
 *
 * Hasta ahora las tres configuraciones de Playwright del monorepo declaraban únicamente
 * `devices['Desktop Chrome']`: de los nueve anchos que hay que validar (320…1920) se probaban cero,
 * y eso con un portal del comercio que se usa desde el móvil. Esta batería no vuelve a comprobar
 * lo que ya comprueban las `*-real`; comprueba UNA cosa que ninguna mira, en varios anchos:
 *
 *   - que la página no produzca scroll horizontal (el síntoma que se ve como «se sale de la pantalla»),
 *   - que el encabezado siga presente (no se ha colapsado a nada),
 *   - que el menú principal siga siendo alcanzable (no ha quedado detrás de un botón invisible).
 *
 * El ancho lo fija el PROYECTO de Playwright, no la prueba: así el mismo fichero corre en 320, 768
 * y 1440 sin duplicar código y el informe dice en qué ancho falló.
 *
 *   npx playwright test --project=layout-320
 *   npx playwright test --project=layout-768 --project=layout-1440
 *
 * Necesita sesión interna, igual que las demás: sin credenciales se salta en vez de fingir.
 */
import { expect, test, type Page } from '@playwright/test';

const INTERNO = {
  email: process.env.PW_INTERNAL_EMAIL ?? '',
  password: process.env.PW_INTERNAL_PASSWORD ?? '',
};

/*
 * Las pantallas más densas de cada familia, que son donde el desbordamiento aparece primero: una
 * rejilla ancha, un formulario largo, un tablero de métricas y el portal del comercio (el único que
 * se usa de verdad desde un teléfono). No es la lista de las 70: es la lista de las que rompen.
 */
const PANTALLAS = [
  { ruta: '/operaciones', nombre: 'centro de operaciones' },
  { ruta: '/operaciones/crm/cuentas', nombre: 'directorio de cuentas B2B' },
  { ruta: '/operaciones/contabilidad/documentos', nombre: 'documentos contables' },
  { ruta: '/operaciones/contabilidad/cuentas-gl', nombre: 'plan de cuentas' },
  { ruta: '/operaciones/ads/campanas', nombre: 'campañas' },
  { ruta: '/portal-comercio/cartera', nombre: 'cartera del comercio' },
];

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test.beforeEach(async ({ page }) => {
  test.skip(!INTERNO.email || !INTERNO.password, 'Sin PW_INTERNAL_EMAIL/PW_INTERNAL_PASSWORD.');
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(INTERNO.email);
  await page.locator('input[name="password"]').fill(INTERNO.password);
  await page.getByRole('button', { name: /iniciar sesi/i }).click();
  const entro = await page.waitForURL(/\/operaciones/, { timeout: 120_000 }).then(() => true).catch(() => false);
  test.skip(!entro, 'El login interno exige segundo factor en este entorno.');
});

/**
 * El desbordamiento horizontal, medido donde se ve.
 *
 * Se mide sobre `documentElement` y no sobre el elemento más ancho de la página a propósito: una
 * tabla ancha DENTRO de un contenedor con `overflow-x: auto` es correcta —se desplaza sola— y
 * marcarla sería un falso positivo que enseñaría a ignorar esta batería. Lo que nunca es correcto
 * es que se desplace el documento entero.
 *
 * El margen de 1 px absorbe el redondeo a subpíxel de los anchos con zoom del navegador, que puede
 * dar 320.4 contra 320 sin que nada esté desbordado.
 */
async function desbordamientoHorizontal(page: Page): Promise<number> {
  return page.evaluate(() => {
    const raiz = document.documentElement;
    return raiz.scrollWidth - raiz.clientWidth;
  });
}

for (const pantalla of PANTALLAS) {
  test(`${pantalla.nombre}: no se sale de la pantalla`, async ({ page }, testInfo) => {
    const ancho = testInfo.project.use.viewport?.width ?? 0;

    await page.goto(pantalla.ruta);
    // Se espera al encabezado y no a `networkidle`: estas pantallas recargan solas al cambiar de
    // filtro, así que `networkidle` puede no llegar nunca y el fallo sería del método, no del layout.
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 120_000 });

    const desbordamiento = await desbordamientoHorizontal(page);
    expect(
      desbordamiento,
      `«${pantalla.nombre}» desborda ${desbordamiento}px a lo ancho en ${ancho}px. ` +
        'Suele ser una tabla o una rejilla sin contenedor con overflow-x: auto.',
    ).toBeLessThanOrEqual(1);
  });
}

test('el menú principal sigue siendo alcanzable al estrechar', async ({ page }, testInfo) => {
  const ancho = testInfo.project.use.viewport?.width ?? 0;
  await page.goto('/operaciones');
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 120_000 });

  /*
   * «Alcanzable» significa una de dos cosas, y las dos son válidas: o la navegación se ve, o hay un
   * control que la abre. Lo que NO vale —y es el fallo que esto busca— es que en un ancho estrecho
   * no exista ninguna de las dos y el usuario se quede sin forma de salir de la pantalla.
   */
  const navegacionVisible = await page.locator('nav a').first().isVisible().catch(() => false);
  const abridor = page.getByRole('button', { name: /men|navegaci|abrir/i }).first();
  const hayAbridor = await abridor.isVisible().catch(() => false);

  expect(
    navegacionVisible || hayAbridor,
    `A ${ancho}px no hay ni navegación visible ni un control que la abra: la pantalla no tiene salida.`,
  ).toBe(true);
});
