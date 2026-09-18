/**
 * «Mi empresa» contra el backend real: la ficha, la red comercial y el QR que se imprime.
 *
 * La prueba que importa aquí no es que el cuadro aparezca —un cuadro gris pasaría igual— sino que
 * lo que hay dentro se LEA y sea el código de la caja. Por eso la captura del QR se guarda aparte:
 * `scripts/verificar-qr.py` la pasa por el lector de códigos del sistema y comprueba que devuelve
 * el serial del terminal. Un QR que se ve bien y no se escanea es exactamente el fallo que esta
 * pantalla no puede permitirse, porque aparece recién en la caja con el cliente delante.
 *
 * Requiere el stack levantado: AtlasERPFrontend en 3010, su backend en 3007 y AtlasBackend en 53005.
 */
import { expect, test } from '@playwright/test';

const EVIDENCIA = 'docs/visual-evidence/portal-comercio';

/* CPA es el comercio con red comercial completa: sucursal, terminal activo y expediente aprobado. */
const COMERCIO = { email: 'cpacentropreparacionacademica@gmail.com', password: '72107014Casa_' };
const SERIAL_ESPERADO = 'CPA-CENTRO-01';

test.describe.configure({ mode: 'serial' });

/*
 * Margen amplio a propósito. Estas pruebas corren contra el stack local COMPLETO —dos backends,
 * Postgres, Redis, MinIO y el servidor de desarrollo de Next— en la misma máquina, y el login hace
 * hash de contraseña, que es CPU pura. Con la máquina cargada el mismo login pasa de 0,2 s a 6 s
 * sin que nada esté roto. Un timeout corto aquí no detecta un fallo: fabrica uno.
 */
test.setTimeout(180_000);

async function sinErrores(page: import('@playwright/test').Page, donde: string) {
  await expect(page.getByText(/error interno|no se pudo|no fue posible/i), `error visible en ${donde}`).toHaveCount(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('tab', { name: /comercio afiliado/i }).click();
  await page.locator('input[name="email"]').fill(COMERCIO.email);
  await page.locator('input[name="password"]').fill(COMERCIO.password);
  await page.getByRole('button', { name: /iniciar sesi/i }).click();
  await page.waitForURL(/\/portal-comercio\//, { timeout: 120_000 });
});

test('Mi empresa reconoce el expediente ya existente y no ofrece abrir otro', async ({ page }) => {
  await page.goto('/portal-comercio/expediente');

  // La ficha del comercio, no el formulario de alta: es la regresión que motivó la pantalla.
  // La cabecera lleva la RAZON SOCIAL: es el nombre con el que Atlas verificó el expediente.
  await expect(page.getByRole('heading', { name: /Centro de Preparacion Academica CPA/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('btn-abrir-expediente')).toHaveCount(0);
  // La pantalla se reorganizó en pestañas: la ficha vive en la suya.
  await page.getByTestId('tab-ficha').click();
  await expect(page.getByTestId('form-ficha-comercial')).toBeVisible();
  await sinErrores(page, 'mi empresa');
  await page.screenshot({ path: `${EVIDENCIA}/mi-empresa-ficha.png`, fullPage: true });
});

test('el rubro es un catálogo y muestra el que el comercio tiene guardado', async ({ page }) => {
  await page.goto('/portal-comercio/expediente');
  await page.getByTestId('tab-ficha').click();
  // `FormField` pasa el testid al propio <select>, no a un contenedor.
  const rubro = page.getByTestId('campo-rubro');
  await expect(rubro).toBeVisible({ timeout: 30_000 });
  // Un select de verdad: si esto fuera un input, `option` no existiría.
  await rubro.click();
  await expect(page.getByRole('option')).not.toHaveCount(0);
  await page.keyboard.press('Escape');
  /*
   * Y el valor SELECCIONADO es el que hay en la base, no «Sin definir». Es la regresión concreta:
   * el rubro estaba guardado como `EDUCATION` y el catálogo decía `EDUCACION`, así que el select
   * caía a vacío y guardar la ficha habría borrado el rubro sin que nadie lo tocara.
   */
  await expect(rubro).toHaveValue('EDUCACION');
});

test('Mi empresa tiene una sola alta de sucursales, en su pestaña', async ({ page }) => {
  await page.goto('/portal-comercio/expediente');
  await expect(page.getByRole('heading', { name: /Centro de Preparacion Academica CPA/i })).toBeVisible({ timeout: 30_000 });

  /*
   * El expediente llegó a tener su propia alta de sucursales, y con ella dos altas para el mismo
   * mostrador: la del ERP —donde se sitúa cada venta— y la del expediente —de donde cuelga el QR—.
   * Desde el 2026-09-18 la pantalla de sucursales vive DENTRO de esta, como pestaña, y sigue
   * siendo la única: lo que no puede volver es el segundo formulario propio del expediente.
   */
  await expect(page.getByTestId('tab-sucursales')).toBeVisible();
  await expect(page.getByTestId('btn-registrar-sucursal')).toHaveCount(0);
  await sinErrores(page, 'mi empresa y su pestaña de sucursales');
});

test('las cuatro pestañas de Mi empresa hablan del mismo expediente', async ({ page }) => {
  /*
   * La razón de juntarlas. Antes cada pantalla resolvía su propio expediente y con criterios
   * distintos —una tomaba el aprobado, otra el primero que llegara—, así que dos vistas contiguas
   * podían estar hablando de comercios distintos sin decirlo en ninguna parte.
   */
  await page.goto('/portal-comercio/expediente');
  for (const pestana of ['tab-estado', 'tab-ficha', 'tab-qr', 'tab-sucursales']) {
    await expect(page.getByTestId(pestana), `falta la pestaña ${pestana}`).toBeVisible({ timeout: 30_000 });
  }
  // Ninguna pestaña vuelve a preguntar de qué comercio se trata: lo resolvió la pantalla, una vez.
  await page.getByTestId('tab-qr').click();
  await expect(page.getByLabel('Expediente al que se sube el QR')).toHaveCount(0);
  await page.getByTestId('tab-sucursales').click();
  await expect(page.getByLabel('Negocio', { exact: true })).toHaveCount(0);
  await sinErrores(page, 'pestañas de mi empresa');
});

test('el QR de cada caja se ve en la tabla de sucursales, sin abrir nada', async ({ page }) => {
  /*
   * Ésta es la corrección del 2026-09-18. El QR vivía detrás de un botón «Cajas y QR» que había
   * que pulsar fila por fila, así que un comercio con varios locales no podía ver de un vistazo
   * cuáles tenían caja —que es lo que decide si sus clientes pueden comprarle en ese mostrador—.
   */
  await page.goto('/portal-comercio/expediente?tab=sucursales');
  await expect(page.getByRole('heading', { name: /sucursales registradas/i })).toBeVisible({ timeout: 30_000 });

  // El negocio es el que inició sesión: aquí no hay ningún desplegable de comercios que elegir.
  await expect(page.getByLabel('Negocio', { exact: true })).toHaveCount(0);
  // Y ya no hay nada que desplegar para llegar al código.
  await expect(page.getByRole('button', { name: /cajas y qr/i })).toHaveCount(0);

  const qr = page.getByTestId('qr-terminal').first();
  await expect(qr).toBeVisible({ timeout: 30_000 });
  // Lo que el componente dice llevar dentro. La comprobación de que se LEE va en la captura.
  await expect(qr).toHaveAttribute('data-qr-value', SERIAL_ESPERADO);
  await expect(page.getByText(SERIAL_ESPERADO).first()).toBeVisible();

  await sinErrores(page, 'qr de sucursal');
  // Captura recortada al QR: es la que se pasa por el lector para probar que escanea.
  await qr.screenshot({ path: `${EVIDENCIA}/qr-sucursal-cpa.png` });
  await page.screenshot({ path: `${EVIDENCIA}/sucursales-qr.png`, fullPage: true });
});

test('el QR de cobro se sube desde su pestaña, con el expediente ya aprobado', async ({ page }) => {
  await page.goto('/portal-comercio/expediente?tab=qr');
  await expect(page.getByRole('heading', { name: /lo que ve su cliente/i })).toBeVisible({ timeout: 30_000 });
  /*
   * Con el expediente APROBADO el botón tiene que estar vivo: el comercio que de verdad cobra era
   * exactamente el que no podía reemplazar su QR, y ése fue el fallo que separó esta pantalla del
   * expediente en su día. Volver a meterla dentro no puede reintroducirlo.
   */
  await expect(page.getByTestId('btn-subir-qr-cobro')).toBeEnabled();
  await expect(page.getByTestId('qr-cobro-bloqueo')).toHaveCount(0);
  await sinErrores(page, 'qr de cobro');
  await page.screenshot({ path: `${EVIDENCIA}/mi-empresa-qr-cobro.png`, fullPage: true });
});
