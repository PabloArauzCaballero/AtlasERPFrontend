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
        /*
         * `permissions` NO es opcional: `hasPermission` hace `user.permissions.includes(...)` y sin
         * el array la consola entera revienta con «client-side exception». Un doble que devuelve
         * menos de lo que el contrato promete no prueba la pantalla, la rompe.
         */
        user: {
          id: '1',
          email: 'operaciones@atlas.test',
          fullName: 'Operaciones Atlas',
          roleCode: 'SUPER_ADMIN',
          status: 'ACTIVE',
          permissions: ['merchant.users.request', 'partner.kyb.request'],
        },
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

test('la fila no amontona iconos: tres acciones y el resto con su nombre', async ({ page }) => {
  /*
   * Onboarding declara DOCE acciones de fila y en un caso abierto se activan siete a la vez. Se
   * pintaban como siete cuadraditos sin una palabra en el carril derecho, y distinguir «activar el
   * comercio» de «pedir la verificación al Motor» exigía apuntar a cada uno y leer su globo.
   */
  await page.route('**/api/v1/b2b/onboarding/cases**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'f5a362cd-bd0f-4496-b47b-665509907ac2',
            accountId: 'c7adc617-416c-4076-ad95-dd04e58d446c',
            tradeName: 'Comercio de prueba',
            /* Un caso ABIERTO y ya aprobado por el Motor: el estado con más acciones a la vez. */
            status: 'IN_PROGRESS',
            pendingItems: 2,
            decisionOutcome: 'APROBADO',
            credentials: { concedidas: 1, pendientes: 0 },
            checklistItems: [],
            startedAt: '2026-09-16T18:19:01.000Z',
          },
        ],
        total: 1,
      }),
    }),
  );
  await page.goto('/operaciones/crm/onboarding');
  const fila = page.locator('[data-tutorial-id="crud-tabla"] tbody tr').first();
  await expect(fila).toBeVisible({ timeout: 30_000 });

  // En el carril, las TRES marcadas y el cajón: cuatro botones, no siete.
  const caso = 'f5a362cd-bd0f-4496-b47b-665509907ac2';
  for (const clave of ['requisito', 'credenciales', 'activar']) {
    await expect(fila.getByTestId(`accion-${clave}-${caso}`), `falta ${clave} en el carril`).toBeVisible();
  }
  await expect(fila.getByTestId(`accion-contrato-${caso}`), 'contrato debería estar en el cajón').toHaveCount(0);
  expect(await fila.locator('td:last-child button, td:last-child a').count(), 'demasiados botones en el carril').toBeLessThanOrEqual(4);

  /*
   * Y el cajón las enseña CON SU NOMBRE. «Pactar contrato» y «Pedir verificación al Motor» se hacen
   * UNA vez por caso: no merecen sitio en el carril, pero tienen que encontrarse sin adivinar iconos.
   */
  await fila.getByTestId(`mas-acciones-${caso}`).click();
  const cajon = page.getByRole('dialog');
  await expect(cajon.getByText(/pactar contrato/i)).toBeVisible();
  await expect(cajon.getByText(/pedir verificación al motor/i)).toBeVisible();
  await page.screenshot({ path: `${EVIDENCIA}/fila-mas-acciones.png`, fullPage: true });
});

test('ningún botón promete algo que no hace', async ({ page }) => {
  /*
   * Había controles con aspecto de botón y sin nada detrás: «Exportar» en el resumen ejecutivo,
   * «Ayuda» en el pie del menú (que ni abría la ayuda ni llevaba al Centro de Tutoriales, que está
   * arriba), y en las tablas un «Más acciones» que se pintaba en toda fila sin acciones. Pulsar y
   * que no pase nada enseña a desconfiar de la pantalla entera, no sólo de ese botón.
   */
  await page.goto('/operaciones');
  await expect(page.getByRole('heading', { name: /resumen ejecutivo/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: /^exportar$/i })).toHaveCount(0);

  const lateral = page.getByRole('navigation').first();
  await expect(lateral.getByRole('button', { name: /^ayuda$/i })).toHaveCount(0);
  // Salir sí está, y con su nombre: un icono solitario en una esquina se pulsa sin querer.
  await expect(page.getByRole('button', { name: /cerrar sesión/i })).toBeVisible();
});

test('la consola no se sale de la pantalla de un teléfono', async ({ page }) => {
  /*
   * La rejilla de tarjetas se sustituyó por una tira (`Resumen`), que es `flex-wrap` en vez de
   * `grid` con puntos de corte. Conviene comprobarlo donde antes había cuatro tarjetas: a 320 px
   * la tira tiene que doblar, no empujar la página.
   */
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/operaciones');
  await expect(page.getByRole('heading', { name: /resumen ejecutivo/i })).toBeVisible({ timeout: 30_000 });
  // La tipografía ANTES de medir: hasta que carga, cada icono se pinta como su palabra entera.
  await page.evaluate(() => document.fonts.ready.then(() => true));
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(desborde, 'la consola se desplaza en horizontal a 320 px').toBeLessThanOrEqual(1);
  await page.screenshot({ path: `${EVIDENCIA}/consola-320.png`, fullPage: true });
});

test('firmar y tarifar un contrato se hace desde su fila, sin volver a elegirlo', async ({ page }) => {
  /*
   * Las dos operaciones del contrato vivían en formularios BAJO la tabla, y el primer campo de
   * ambas era un desplegable que pedía otra vez el contrato: se elegía la fila con los ojos y luego
   * había que volver a elegirla con el ratón, con el riesgo de firmar el contrato equivocado. Sin
   * contratos todavía sólo sabían decir «— No hay datos registrados —» y pedían lo demás para nada.
   */
  await page.route('**/api/v1/b2b/contracts**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'c1000000-0000-4000-8000-000000000001',
          contractNumber: 'CTR-0001',
          startDate: '2026-09-01',
          billingCycle: 'MONTHLY',
          settlementPolicy: 'PER_CONTRACT',
          signedAt: null,
          status: 'DRAFT',
        },
        {
          id: 'c1000000-0000-4000-8000-000000000002',
          contractNumber: 'CTR-0002',
          startDate: '2026-08-01',
          billingCycle: 'MONTHLY',
          settlementPolicy: 'PER_CONTRACT',
          signedAt: '2026-08-15T10:00:00.000Z',
          status: 'ACTIVE',
        },
      ]),
    }),
  );
  await page.goto('/operaciones/crm/contratos');
  const fila = page.locator('[data-tutorial-id="crud-tabla"] tbody tr').first();
  await expect(fila).toBeVisible({ timeout: 30_000 });

  // Ya no hay formularios sueltos bajo la tabla pidiendo el contrato.
  await expect(page.getByLabel(/^contrato$/i)).toHaveCount(0);
  await expect(page.getByText(/versión contractual/i)).toHaveCount(0);

  // Firmar abre el diálogo del contrato de ESA fila, y sólo pide lo que falta.
  await fila.getByTestId('accion-firmar-c1000000-0000-4000-8000-000000000001').click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo.getByText(/CTR-0001/)).toBeVisible();
  await expect(dialogo.getByLabel(/aprobador/i)).toBeVisible();
  await expect(dialogo.getByLabel(/^contrato$/i), 'vuelve a pedir el contrato').toHaveCount(0);
  await page.screenshot({ path: `${EVIDENCIA}/contrato-firmar-en-la-fila.png`, fullPage: true });
  await dialogo.getByRole('button', { name: /cancelar/i }).click();

  /*
   * Y un contrato YA FIRMADO no vuelve a ofrecer la firma: sería una acción muerta —el backend la
   * rechaza— sobre la fila que precisamente ya está en vigor. La comisión sí se sigue pudiendo
   * tocar, porque una tarifa se ajusta con el contrato vivo.
   */
  const firmada = page.locator('[data-tutorial-id="crud-tabla"] tbody tr').nth(1);
  await expect(firmada.getByTestId('accion-firmar-c1000000-0000-4000-8000-000000000002')).toHaveCount(0);
  await expect(firmada.getByTestId('accion-comision-c1000000-0000-4000-8000-000000000002')).toBeVisible();
});

test('el término contractual cuelga de su contrato, no de un desplegable', async ({ page }) => {
  /* Mismo patrón en Contabilidad: «Agregar término contractual» pedía el contrato otra vez. */
  await page.route('**/api/v1/accounting/contracts**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: 'a1000000-0000-4000-8000-000000000001',
            contractNo: 'CTA-0001',
            contractType: 'SERVICE',
            startDate: '2026-09-01',
            status: 'ACTIVE',
            counterpartyBpId: 'b1000000-0000-4000-8000-000000000001',
          },
        ],
        total: 1,
      }),
    }),
  );
  await page.goto('/operaciones/contabilidad/contratos');
  const fila = page.locator('[data-tutorial-id="crud-tabla"] tbody tr').first();
  await expect(fila).toBeVisible({ timeout: 30_000 });

  await fila.getByTestId('accion-termino-a1000000-0000-4000-8000-000000000001').click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo.getByText(/CTA-0001/)).toBeVisible();
  await expect(dialogo.getByLabel(/código del término/i)).toBeVisible();
  await expect(dialogo.getByLabel(/^contrato$/i), 'vuelve a pedir el contrato').toHaveCount(0);
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
