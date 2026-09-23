import { expect, test, type Page } from '@playwright/test';
import { seedRefreshSession } from './support/auth-session';

/**
 * La comisión por venta (MDR) de un contrato, desde su fila.
 *
 * Esto cubre una avería que estuvo viva desde que existe la pantalla y que ningún gate veía. La
 * regla de comisión cuelga de la VERSIÓN contractual (`mdr_rules.contract_version_id`), y la
 * pantalla entregaba el id del CONTRATO, que es lo que devuelve `GET /b2b/contracts`. Con el uuid
 * equivocado el backend respondía `[]` al listar —la pantalla anunciaba «Sin reglas» sin sospechar
 * nada— y 404 al crear. Nunca se pudo pactar una comisión desde el ERP.
 *
 * Por eso lo que se afirma aquí no es que la pantalla «se vea»: es QUÉ UUID VIAJA en cada llamada.
 * Un type-check no lo ve, porque los dos son `string`.
 *
 * De paso se prueba la dimensión que faltaba: el backend acepta `branchId` desde el principio y el
 * texto de ayuda la anuncia («primero las que distinguen sucursal»), pero el formulario no tenía
 * campo de sucursal y la tabla no tenía columna. Las reglas salían ordenadas por un criterio que
 * nadie podía usar.
 */
const EVIDENCIA = 'docs/visual-evidence/operaciones';

/* uuid de verdad: varias capas del ERP rechazan un id que no lo sea, y un doble debe parecerse. */
const CONTRATO_ID = '8f1d2a44-5c60-4f0e-9a21-6b7c3d4e5f60';
const VERSION_ID = 'b3e9c701-2a45-4d8f-8c13-9e0a1b2c3d4e';
const CUENTA_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const SUCURSAL_MATRIZ = '2d3e4f5a-6b7c-4d8e-9f0a-1b2c3d4e5f60';
const SUCURSAL_NORTE = '3e4f5a6b-7c8d-4e9f-a0b1-2c3d4e5f6071';

const CONTRATO = {
  id: CONTRATO_ID,
  contractNumber: 'CTR-2026-0001',
  accountId: CUENTA_ID,
  tradeName: 'Roho Home Center',
  status: 'ACTIVE',
  startDate: '2026-01-01',
  endDate: null,
  billingCycle: 'MONTHLY',
  settlementPolicy: 'PER_CONTRACT',
  signedAt: '2026-01-02T10:00:00.000Z',
  currentVersionId: VERSION_ID,
  currentVersionNumber: 2,
};

const SUCURSALES = [
  { id: SUCURSAL_MATRIZ, name: 'Casa matriz', city: 'Santa Cruz' },
  { id: SUCURSAL_NORTE, name: 'Sucursal Norte', city: 'La Paz' },
];

/** Lo que el navegador pidió de verdad: es la prueba, no un detalle de la simulación. */
interface Espia {
  listados: string[];
  creadas: Record<string, unknown>[];
}

async function montar(page: Page): Promise<Espia> {
  const espia: Espia = { listados: [], creadas: [] };

  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: '1',
          email: 'operaciones@atlas.test',
          fullName: 'Operaciones Atlas',
          roleCode: 'SUPER_ADMIN',
          status: 'ACTIVE',
          permissions: [],
        },
      }),
    }),
  );

  await page.route('**/api/v1/**', async (route) => {
    const peticion = route.request();
    const url = new URL(peticion.url());
    const ruta = url.pathname;
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (ruta.includes('/auth/me') || ruta.includes('/auth/refresh')) return route.fallback();

    if (ruta.endsWith('/b2b/contracts/mdr-rules')) {
      if (peticion.method() === 'POST') {
        espia.creadas.push(peticion.postDataJSON() as Record<string, unknown>);
        return json({ id: 'regla-1', ratePercent: 3.5, isActive: true }, 201);
      }
      espia.listados.push(url.searchParams.get('contractVersionId') ?? '(sin parámetro)');
      return json([]);
    }

    if (ruta.endsWith('/b2b/contracts')) return json([CONTRATO]);

    if (ruta.endsWith('/b2b/onboarding/branches')) {
      // Que la consulta venga acotada a ESTA cuenta también es parte de lo que se afirma.
      expect(url.searchParams.get('accountId')).toBe(CUENTA_ID);
      return json(SUCURSALES);
    }

    if (ruta.endsWith('/catalog/domains')) {
      return json({
        domains: [
          {
            name: 'crm.merchantCategory',
            description: 'Rubro',
            values: [{ value: 'SALUD', label: 'Salud y farmacia', help: 'Clínicas y farmacias.' }],
          },
          {
            name: 'crm.riskTier',
            description: 'Banda de riesgo',
            values: [{ value: 'HIGH', label: 'Alto', help: 'Exige garantías.' }],
          },
        ],
      });
    }

    return json([]);
  });

  await seedRefreshSession(page, 'internal');

  return espia;
}

test('la comisión se abre desde la fila y viaja el uuid de la VERSIÓN, no el del contrato', async ({ page }) => {
  const espia = await montar(page);

  await page.goto('/operaciones/crm/contratos');
  await expect(page.getByRole('heading', { name: /contratos comerciales/i })).toBeVisible();
  await expect(page.getByText('CTR-2026-0001')).toBeVisible();

  /*
   * La columna «Liquidación» existía en la tabla y el listado nunca devolvía el campo: salía vacía
   * en todas las filas. Se afirma con el valor, no con la cabecera.
   */
  await expect(page.getByText('PER_CONTRACT')).toBeVisible();

  await page.getByTestId(`accion-comision-${CONTRATO_ID}`).click();

  const dialogo = page.getByRole('dialog');
  await expect(dialogo.getByText(/CTR-2026-0001/)).toBeVisible();

  // LA afirmación: el listado se pidió con la versión, y en ningún momento con el contrato.
  await expect.poll(() => espia.listados).toContain(VERSION_ID);
  expect(espia.listados).not.toContain(CONTRATO_ID);

  await page.screenshot({ path: `${EVIDENCIA}/contrato-comision-mdr.png`, fullPage: true });
});

test('el formulario ofrece la sucursal —la dimensión que más pesa— y la manda al crear', async ({ page }) => {
  const espia = await montar(page);

  await page.goto('/operaciones/crm/contratos');
  await page.getByTestId(`accion-comision-${CONTRATO_ID}`).click();

  const dialogo = page.getByRole('dialog');

  /*
   * `exact` porque el diálogo tiene además «Comisión mínima (Bs)» y «Comisión máxima (Bs)»:
   * `getByLabel` casa por subcadena y sin esto elige el primero que encuentre. Y el asterisco va
   * dentro del nombre accesible —un campo obligatorio se rotula «Comisión (%)*»—, así que con
   * `exact` hay que escribirlo: sin él, `getByLabel` no encuentra nada.
   */
  await dialogo.getByLabel('Comisión (%)*', { exact: true }).fill('3.5');
  await dialogo.getByLabel('Comisión mínima (Bs)', { exact: true }).fill('0.60');

  /*
   * `OptionSelect` no es un `<select>` nativo —cada opción lleva su descripción—, así que
   * `selectOption` no sirve: se abre el combobox y se elige la opción por su `data-testid`.
   */
  await dialogo.getByTestId('select-branchId').click();
  await page.getByTestId(`select-branchId-option-${SUCURSAL_NORTE}`).click();
  await expect(dialogo.getByTestId('select-branchId')).toContainText('Sucursal Norte');

  await dialogo.getByRole('button', { name: /agregar regla/i }).click();

  await expect.poll(() => espia.creadas.length).toBe(1);
  expect(espia.creadas[0]).toMatchObject({
    contractVersionId: VERSION_ID,
    ratePercent: 3.5,
    branchId: SUCURSAL_NORTE,
    minFeeAmount: 0.6,
  });
});
