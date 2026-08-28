import { defineConfig, devices } from '@playwright/test';

/**
 * Batería de extremo a extremo del portal del comercio.
 *
 * Corre contra el servidor de desarrollo con el backend SIMULADO por defecto (`e2e/support`): lo
 * que se comprueba aquí es que la pantalla sabe pintar la forma que el contrato promete y que el
 * flujo completo —abrir expediente, sucursal, QR, terminal, envío— se puede recorrer sin salirse
 * de la pantalla. Contra el backend real hace falta sesión de comercio y almacenamiento de
 * objetos; ese camino se documenta en `e2e/README.md` y no se finge aquí.
 *
 * `PW_BASE_URL` apunta a otro origen cuando ya hay un servidor levantado, que es lo normal en esta
 * máquina: arrancar otro con el mismo `.next` deja al que corría con módulos que ya no existen.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  /*
   * Los 5 s por defecto de `expect` están pensados para una pantalla que ya tiene sus datos. Las
   * baterías `*-real` esperan a DOS backends en la misma máquina que corre el servidor de
   * desarrollo, y con la máquina cargada una lectura que normalmente tarda 300 ms tarda varios
   * segundos. Con el default, el aserto se evalúa mientras el panel todavía dice «Procesando» y
   * falla por llegar pronto, no por estar mal: exactamente la clase de rojo que enseña a
   * desconfiar de la batería.
   */
  expect: { timeout: 20_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: process.env.PW_BASE_URL ?? 'http://localhost:3010',
    ...devices['Desktop Chrome'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  /*
   * Los proyectos existen por el ancho, no por el navegador.
   *
   * Antes no había `projects` y todo corría en un único Desktop Chrome: de los nueve anchos que
   * hay que validar se probaban cero, con un portal del comercio que se usa desde el teléfono.
   *
   * Las baterías `*-real` NO se duplican por ancho a propósito: son lentas, necesitan dos backends
   * y lo que comprueban (que el dato llegue) no cambia con el ancho. Sólo `layout-responsive` se
   * repite en 320, 768 y 1440, que es donde el ancho SÍ es la variable bajo prueba. Y WebKit corre
   * únicamente esa misma batería: es el motor que más difiere en maquetación, y es ahí donde su
   * señal es útil sin multiplicar por dos toda la suite.
   */
  projects: [
    {
      name: 'chromium',
      testIgnore: /layout-responsive\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'layout-320',
      testMatch: /layout-responsive\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 320, height: 720 } },
    },
    {
      name: 'layout-768',
      testMatch: /layout-responsive\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'layout-1440',
      testMatch: /layout-responsive\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'layout-webkit-390',
      testMatch: /layout-responsive\.spec\.ts$/,
      use: { ...devices['Desktop Safari'], viewport: { width: 390, height: 844 } },
    },
  ],
});
