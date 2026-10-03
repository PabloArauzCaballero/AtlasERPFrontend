import { expect, test, type Page, type Route } from '@playwright/test';

const CASO_ID = '11111111-1111-4111-8111-111111111111';
const COMERCIO = 'Comercio de prueba';

function responder(route: Route, status: number, data: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(status < 400 ? { success: true, data } : { success: false, error: data }),
  });
}

async function instalarOnboarding(page: Page, rechazarActivacion: boolean) {
  let activado = false;
  let intentos = 0;
  let lecturasCola = 0;

  await page.addInitScript(() => {
    window.localStorage.setItem('atlas_session_kind', 'internal');
  });

  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith('/auth/refresh')) return responder(route, 200, { accessToken: 'e2e-internal-token' });
    if (path.endsWith('/auth/me')) {
      return responder(route, 200, {
        user: {
          id: '1', email: 'admin@atlas.test', fullName: 'Admin de pruebas', status: 'ACTIVE',
          roles: ['ADMIN'], permissions: ['partner.kyb.request', 'merchant.users.request'],
        },
      });
    }

    if (path.endsWith(`/b2b/onboarding/cases/${CASO_ID}/activate`)) {
      intentos += 1;
      if (rechazarActivacion) {
        return responder(route, 409, { code: 'ONBOARDING_CONFLICT', message: 'El caso ya cambió de estado.' });
      }
      activado = true;
      return responder(route, 200, { id: CASO_ID, status: 'COMPLETED' });
    }

    if (path.endsWith('/b2b/onboarding/cases/summary')) {
      return responder(route, 200, {
        abiertos: activado ? 0 : 1, activados: activado ? 1 : 0,
        esperandoMotor: 0, revisionManual: 0, esperandoCredenciales: 0,
        listosParaActivar: activado ? 0 : 1,
      });
    }

    if (path.endsWith('/b2b/onboarding/cases')) {
      lecturasCola += 1;
      const scope = url.searchParams.get('scope');
      const visible = scope === 'historial' ? activado : !activado;
      const items = visible ? [{
        id: CASO_ID, tradeName: COMERCIO, status: activado ? 'COMPLETED' : 'OPEN',
        decisionOutcome: 'APROBADO', pendingItems: 0, contractVersionId: 'contrato-vigente',
        checklistItems: [{ id: 'requisito-legal', status: 'COMPLETED' }],
      }] : [];
      return responder(route, 200, { items, total: items.length });
    }

    if (path.endsWith('/b2b/onboarding/legal-contract-template')) {
      return responder(route, 200, { template: { id: 'contrato-vigente' } });
    }

    return responder(route, 200, { items: [], total: 0 });
  });

  return { get intentos() { return intentos; }, get lecturasCola() { return lecturasCola; } };
}

test('un 409 conserva el caso, la confirmación y la cola', async ({ page }) => {
  const api = await instalarOnboarding(page, true);
  await page.goto('/operaciones/crm/onboarding');

  const fila = page.locator('[data-tutorial-id="crud-tabla"] tbody tr', { hasText: COMERCIO });
  await expect(fila).toBeVisible();
  await fila.getByTitle('Activar comercio').click();
  const confirmacion = page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: 'Activar el comercio' }),
  });
  await expect(confirmacion).toBeVisible();
  const lecturasAntesDelRechazo = api.lecturasCola;

  await confirmacion.getByRole('button', { name: 'Activar', exact: true }).click();
  // El motivo del 409 se queda DENTRO de la confirmación (también sale en el aviso general).
  await expect(confirmacion.getByText('El caso ya cambió de estado.')).toBeVisible();
  await expect(confirmacion).toBeVisible();
  await expect(fila).toBeVisible();
  expect(api.lecturasCola).toBe(lecturasAntesDelRechazo);
  expect(api.intentos).toBe(1);
});

test('una activación confirmada actualiza la cola y el historial', async ({ page }) => {
  const api = await instalarOnboarding(page, false);
  await page.goto('/operaciones/crm/onboarding');

  const fila = page.locator('[data-tutorial-id="crud-tabla"] tbody tr', { hasText: COMERCIO });
  await expect(fila).toBeVisible();
  await fila.getByTitle('Activar comercio').click();
  const confirmacion = page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: 'Activar el comercio' }),
  });
  const lecturasAntesDeActivar = api.lecturasCola;

  await confirmacion.getByRole('button', { name: 'Activar', exact: true }).click();
  await expect(confirmacion).toHaveCount(0);
  await expect(fila).toHaveCount(0);
  expect(api.intentos).toBe(1);
  expect(api.lecturasCola).toBeGreaterThan(lecturasAntesDeActivar);

  await page.getByTestId('onboarding-scope-historial').click();
  await expect(fila).toBeVisible();
  await expect(fila.getByText('COMPLETED')).toBeVisible();
});
