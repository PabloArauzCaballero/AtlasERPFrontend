import { expect, test, type Page } from '@playwright/test';

/**
 * El menú de la consola interna después de la simplificación del 2026-09-18.
 *
 * Pablo pidió lo mismo que en el portal del comercio —agrupar lo que se usa junto, quitar lo que no
 * vale la pena— y además ocultar Publicidad entera «de momento». Lo que se afirma aquí no lo ve un
 * type-check: que el módulo oculto no deje rastro en ninguna de las dos superficies que pintan el
 * menú, y que la portada no siga enseñando sus números.
 *
 * Va contra el backend SIMULADO: lo que se prueba es la navegación, no los datos.
 */
const EVIDENCIA = 'docs/visual-evidence/operaciones';

/** Sesión de personal interno: el perfil lo sirve el doble, no hay login de verdad. */
async function sesionInterna(page: Page) {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: '1', email: 'operaciones@atlas.test', fullName: 'Operaciones Atlas', roleCode: 'ADMIN', status: 'ACTIVE' },
      }),
    }),
  );
  /* Todo lo demás del tablero: vacío y en verde. Aquí sólo se mira el menú. */
  await page.route('**/api/v1/**', (route) => {
    if (route.request().url().includes('/auth/me')) return route.fallback();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0 }) });
  });
  await page.addInitScript(() => {
    window.localStorage.setItem('atlas_access_token', 'e2e-internal-token');
    window.localStorage.setItem('atlas_session_kind', 'internal');
  });
}

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
  await sesionInterna(page);
});

test('Publicidad no aparece por ninguna parte de la consola', async ({ page }) => {
  await page.goto('/operaciones');
  const lateral = page.getByRole('navigation').first();
  await expect(lateral).toBeVisible({ timeout: 30_000 });

  /*
   * Por ausencia de sus DIEZ entradas, no sólo del rótulo del grupo: un módulo medio oculto —sin
   * cabecera pero con «Moderación» suelta en otro sitio— es peor que uno visible.
   */
  for (const fuera of [/^publicidad$/i, /anunciantes/i, /moderación/i, /delivery y fraude/i, /inventario y políticas/i, /segmentos de audiencia/i, /correo de campaña/i]) {
    await expect(lateral.getByText(fuera), `sigue en el menú: ${String(fuera)}`).toHaveCount(0);
  }
  // Y la portada tampoco: ni su tarjeta, ni sus métricas, ni su panel de excepciones.
  await expect(page.getByText(/operación publicitaria/i)).toHaveCount(0);
  await expect(page.getByText(/revenue ads/i)).toHaveCount(0);
  await expect(page.getByText(/control snapshot/i)).toHaveCount(0);
  await page.screenshot({ path: `${EVIDENCIA}/consola-sin-publicidad.png`, fullPage: true });
});

test('el menú se agrupa: lo diario arriba, lo que se configura una vez en su cajón', async ({ page }) => {
  await page.goto('/operaciones');
  const lateral = page.getByRole('navigation').first();
  await expect(lateral).toBeVisible({ timeout: 30_000 });

  // Los tres grupos que quedan.
  for (const grupo of [/^CRM$/, /^Contabilidad$/, /^Control$/]) {
    await expect(lateral.getByText(grupo)).toBeVisible();
  }

  // Lo que se hace con un comercio delante, a la vista.
  for (const diario of [/cuentas b2b/i, /onboarding/i, /propuestas/i, /aprobaciones/i]) {
    await expect(lateral.getByText(diario).first()).toBeVisible();
  }

  // Lo que se configura una vez baja a un cajón dentro de su grupo.
  await expect(lateral.getByText(/configuración comercial/i)).toBeVisible();

  /*
   * Y los grupos también se pliegan: en la portada se abre CRM —el trabajo diario— y los otros dos
   * son una línea. Antes se pintaban los tres enteros, treinta y seis enlaces seguidos, con
   * Contabilidad y Control fuera de la pantalla hasta que uno descubría que la barra se desplaza.
   */
  await expect(lateral.getByText(/business partners/i)).toHaveCount(0);
  await lateral.getByRole('button', { name: /contabilidad/i }).click();
  await expect(lateral.getByText(/business partners/i)).toBeVisible();
  await expect(lateral.getByText(/configuración maestra/i)).toBeVisible();

  /*
   * «Centro de comando» se fue del todo: `lib/viewRegistry.ts` lo declara `brecha-backend` —el
   * sistema aún no tiene la búsqueda federada que lo alimenta—, y una puerta a un cuarto vacío no
   * es una opción del menú.
   */
  await expect(lateral.getByText(/centro de comando/i)).toHaveCount(0);
  await page.screenshot({ path: `${EVIDENCIA}/consola-menu-agrupado.png`, fullPage: true });
});
