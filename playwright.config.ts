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
/**
 * Las que NECESITAN el stack completo (dos backends, Postgres, Redis, MinIO y una sesión real).
 *
 * Es una lista de EXCLUSIÓN a propósito, no una de inclusión: con una lista de inclusión, la
 * prueba que alguien escriba mañana se quedaría fuera del CI sin que nadie lo note —que es
 * exactamente el fallo que este cambio viene a cerrar—. Así, lo nuevo entra solo, y lo que
 * dependa del stack hay que declararlo aquí y justificarlo.
 */
const NECESITAN_STACK = [
  /mi-empresa-real\.spec\.ts$/,
  /operaciones-real\.spec\.ts$/,
  /portal-comercio-real\.spec\.ts$/,
  /portal-comercio-soporte\.spec\.ts$/,
  /onboarding-cola\.evidencia\.spec\.ts$/,
  /layout-responsive\.spec\.ts$/,
];

/*
 * `PW_SOLO_SIMULADO=1` deja SOLO lo que corre con el backend simulado: es el modo del CI.
 *
 * No se resuelve con `test.skip`, aunque varias de esas baterías ya lo hagan por su cuenta: una
 * corrida en la que la mitad sale «saltada» es un informe amarillo permanente, y un informe que
 * siempre está amarillo enseña a no mirarlo. Aquí no se ejecutan y el verde significa algo.
 */
const SOLO_SIMULADO = process.env.PW_SOLO_SIMULADO === '1';

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
      testIgnore: SOLO_SIMULADO ? NECESITAN_STACK : /layout-responsive\.spec\.ts$/,
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
