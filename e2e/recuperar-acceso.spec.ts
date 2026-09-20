/**
 * Recuperar el acceso del comercio, con el backend SIMULADO.
 *
 * Es una pantalla pública: no hace falta sesión ni el stack completo, así que esta batería corre
 * también en el CI. Lo que fija:
 *
 *   - el enlace «¿Olvidaste tu contraseña?» aparece SÓLO en la pestaña del comercio (el personal
 *     interno recupera su acceso por Sistemas y allí no hay a dónde mandarlo),
 *   - se lleva el correo ya escrito, para no teclearlo dos veces,
 *   - el recorrido completo son dos pasos: pedir el código y canjearlo por la contraseña nueva,
 *   - un correo que NO existe avanza igual al paso 2. Es lo importante de todo el archivo: la
 *     pantalla no puede decir «ese correo no está registrado» sin convertirse en un comprobador de
 *     qué correos pertenecen a un comercio afiliado.
 */
import { expect, test, type Page } from '@playwright/test';

const PEDIR = '**/api/v1/auth/merchant/password-reset/request';
const CONFIRMAR = '**/api/v1/auth/merchant/password-reset/confirm';

/**
 * El doble del backend: responde lo mismo exista o no la cuenta, igual que AtlasBackend.
 *
 * El sobre `{ success, error: { message } }` no es adorno: `lib/apiClient.ts` sólo usa el mensaje
 * del servidor cuando el cuerpo trae `success`. Sin él, un 401 se leería como «Su sesión caducó»
 * —el texto por defecto— en una pantalla donde no hay ninguna sesión que caducar.
 */
async function simularBackend(page: Page, confirmacion: { ok: boolean } = { ok: true }) {
  await page.route(PEDIR, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { requested: true } }),
    }),
  );
  await page.route(CONFIRMAR, (route) =>
    confirmacion.ok
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { passwordChanged: true } }),
        })
      : route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { message: 'Código inválido o expirado.' },
          }),
        }),
  );
}

test.describe('Recuperar el acceso del comercio', () => {
  test('el enlace es sólo del comercio y se lleva el correo escrito', async ({ page }) => {
    await page.goto('/login');
    const enlace = page.getByRole('link', { name: '¿Olvidaste tu contraseña?' });

    // Pestaña interna: no existe.
    await expect(enlace).toBeHidden();

    await page.getByRole('tab', { name: 'Comercio afiliado' }).click();
    await page.getByLabel(/Correo del comercio/i).fill('comercio@alfa.test');
    await expect(enlace).toBeVisible();

    await enlace.click();
    await expect(page).toHaveURL(/\/recuperar-acceso\?correo=comercio%40alfa\.test/);
    await expect(page.getByLabel(/Correo del comercio/i)).toHaveValue('comercio@alfa.test');
  });

  test('pedir el código y canjearlo deja la contraseña cambiada', async ({ page }) => {
    await simularBackend(page);
    await page.goto('/recuperar-acceso');

    await page.getByLabel(/Correo del comercio/i).fill('comercio@alfa.test');
    await page.getByRole('button', { name: 'Enviarme el código' }).click();

    await expect(page.getByRole('heading', { name: 'Escribe el código' })).toBeVisible();
    await page.getByLabel(/Código del correo/i).fill('123456');
    await page.getByLabel(/Contraseña nueva/i).fill('ClaveDelComercio1');
    await page.getByRole('button', { name: 'Cambiar mi contraseña' }).click();

    await expect(page.getByRole('heading', { name: 'Ya puedes entrar' })).toBeVisible();
    // Lo que se le promete al comercio al terminar: que las demás sesiones quedaron cerradas.
    await expect(page.getByText(/se cerraron las sesiones/i)).toBeVisible();
  });

  test('un correo desconocido avanza igual: la pantalla no delata qué comercios existen', async ({
    page,
  }) => {
    await simularBackend(page);
    await page.goto('/recuperar-acceso');

    await page.getByLabel(/Correo del comercio/i).fill('no-existe@ninguna-parte.test');
    await page.getByRole('button', { name: 'Enviarme el código' }).click();

    await expect(page.getByRole('heading', { name: 'Escribe el código' })).toBeVisible();
    await expect(page.getByText(/no está registrado|no existe/i)).toHaveCount(0);
  });

  test('un código equivocado se dice en la pantalla y deja reintentar', async ({ page }) => {
    await simularBackend(page, { ok: false });
    await page.goto('/recuperar-acceso?correo=comercio%40alfa.test');

    await page.getByRole('button', { name: 'Enviarme el código' }).click();
    await page.getByLabel(/Código del correo/i).fill('000000');
    await page.getByLabel(/Contraseña nueva/i).fill('ClaveDelComercio1');
    await page.getByRole('button', { name: 'Cambiar mi contraseña' }).click();

    await expect(page.getByText('Código inválido o expirado.')).toBeVisible();
    // Sigue en el paso 2: un código mal escrito no obliga a empezar de cero.
    await expect(page.getByRole('button', { name: 'Cambiar mi contraseña' })).toBeVisible();
  });
});
