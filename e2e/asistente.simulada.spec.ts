/**
 * El asistente aparece en el ERP del personal y en el portal del comercio, y contesta.
 *
 * Backend simulado. Lo que se comprueba es la queja de origen —«el minibot no aparece en ningún
 * portal»—: el botón está en la pantalla con sesión, abre el panel, y la respuesta se pinta; en el
 * portal del comercio, con el acceso a «Hablar con soporte» cuando el asistente lo sugiere.
 */
import { expect, test, type Page, type Route } from '@playwright/test';

function responder(route: Route, status: number, data: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(status < 400 ? { success: true, data } : { success: false, error: data }),
  });
}

async function instalar(page: Page, kind: 'internal' | 'merchant', opciones: { apagado?: boolean; hilo?: boolean } = {}) {
  const preguntas: Array<Record<string, unknown>> = [];
  await page.addInitScript((sessionKind) => {
    window.localStorage.setItem('atlas_session_kind', sessionKind);
  }, kind);
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/refresh') || path.endsWith('/auth/merchant/refresh')) {
      return responder(route, 200, { accessToken: `e2e-${kind}-token` });
    }
    if (path.endsWith('/auth/me')) {
      return responder(route, 200, { user: { id: '1', email: 'qa@atlas.test', fullName: 'QA', status: 'ACTIVE', roles: ['ADMIN'], permissions: [] } });
    }
    if (path.endsWith('/auth/merchant/me')) {
      return responder(route, 200, { user: { id: 'm1', email: 'caja@comercio.test', fullName: 'Comercio QA', role: 'merchant', status: 'active', mustChangePassword: false } });
    }
    if (path.endsWith('/internal/assist/conversations')) {
      return responder(route, 200, {
        conversations: [
          { conversationId: 'c1', title: '¿Dónde cierro el mes?', updatedAt: new Date(Date.now() - 300_000).toISOString(), turnCount: 1 },
          { conversationId: 'c2', title: 'Cómo emito una factura', updatedAt: new Date(Date.now() - 93_600_000).toISOString(), turnCount: 3 },
        ],
      });
    }
    if (/\/internal\/assist\/conversations\/c2$/.test(path)) {
      return route.request().method() === 'DELETE'
        ? responder(route, 200, { deleted: 1 })
        : responder(route, 200, {
            conversationId: 'c2',
            title: 'Cómo emito una factura',
            turns: [{ turnId: 'o1', prompt: '¿Cómo emito una factura?', reply: 'Abre «Facturación».', suggestHandoff: false, createdAt: new Date().toISOString() }],
          });
    }
    if (path.endsWith('/internal/assist/conversation')) {
      if (opciones.hilo) {
        return responder(route, 200, {
          conversationId: 'c1',
          turns: [{ turnId: 't0', prompt: '¿Dónde cierro el mes?', reply: 'En «Contabilidad» › «Cierres».', suggestHandoff: false, createdAt: new Date().toISOString() }],
        });
      }
      return opciones.apagado
        ? responder(route, 404, { code: 'ASSIST_DISABLED', message: 'Apagado' })
        : responder(route, 200, { conversationId: null, turns: [] });
    }
    if (path.endsWith('/internal/assist/chat')) {
      preguntas.push(route.request().postDataJSON() as Record<string, unknown>);
      return responder(route, 200, {
        reply: kind === 'merchant' ? 'Eso lo resuelve soporte.' : 'Los cierres están en «Contabilidad» › «Cierres».',
        suggestHandoff: kind === 'merchant',
        conversationId: 'c1',
        turnId: 't1',
      });
    }
    return responder(route, 200, { items: [], total: 0 });
  });
  return preguntas;
}

test('personal de Atlas: el botón está en la consola y el asistente contesta', async ({ page }) => {
  const preguntas = await instalar(page, 'internal');
  await page.goto('/operaciones/contabilidad/cierres');

  await page.getByRole('button', { name: 'Asistente de Atlas' }).click();
  const panel = page.getByRole('dialog', { name: 'Asistente de Atlas' });
  await expect(panel.getByText('No escribas contraseñas, códigos ni datos personales.')).toBeVisible();
  await panel.getByLabel('Tu pregunta').fill('¿Dónde cierro el mes?');
  await panel.getByLabel('Tu pregunta').press('Enter');

  await expect(panel.getByText('Los cierres están en «Contabilidad» › «Cierres».')).toBeVisible();
  expect(preguntas[0]).toMatchObject({ prompt: '¿Dónde cierro el mes?', screen: 'Contabilidad › Cierres' });
  await expect(panel.getByRole('link', { name: /hablar con soporte/i })).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
});

test('comercio: el botón está en el portal y la respuesta ofrece «Hablar con soporte»', async ({ page }) => {
  const preguntas = await instalar(page, 'merchant');
  await page.goto('/portal-comercio/gestion-pos');

  await page.getByRole('button', { name: 'Asistente de Atlas' }).click();
  const panel = page.getByRole('dialog', { name: 'Asistente de Atlas' });
  await panel.getByLabel('Tu pregunta').fill('No me llega un pago');
  await panel.getByLabel('Tu pregunta').press('Enter');

  await expect(panel.getByText('Eso lo resuelve soporte.')).toBeVisible();
  expect(preguntas[0]).toMatchObject({ screen: 'Gestión POS' });
  await panel.getByRole('link', { name: /hablar con soporte/i }).click();
  await expect(page).toHaveURL(/\/portal-comercio\/soporte/);
  await expect(page.getByRole('button', { name: 'Asistente de Atlas' })).toBeVisible();
});

test('apagado en el ambiente: el botón sigue y el panel lo explica', async ({ page }) => {
  await instalar(page, 'internal', { apagado: true });
  await page.goto('/operaciones');

  await page.getByRole('button', { name: 'Asistente de Atlas' }).click();
  const panel = page.getByRole('dialog', { name: 'Asistente de Atlas' });
  await expect(panel.getByText('El asistente todavía no está encendido en este ambiente.')).toBeVisible();
  await expect(panel.getByLabel('Tu pregunta')).toBeDisabled();
});

test('el inicio de sesión no tiene asistente', async ({ page }) => {
  await page.route('**/api/v1/**', (route) => responder(route, 401, { message: 'Sin sesión' }));
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Asistente de Atlas' })).toHaveCount(0);
});

test('nueva conversación e historial: abrir, continuar y borrar con confirmación en la fila', async ({ page }) => {
  const preguntas = await instalar(page, 'internal', { hilo: true });
  page.on('dialog', () => {
    throw new Error('el asistente no debe usar cuadros del navegador');
  });
  await page.goto('/operaciones/contabilidad/cierres');
  await page.getByRole('button', { name: 'Asistente de Atlas' }).click();
  const panel = page.getByRole('dialog', { name: 'Asistente de Atlas' });
  await expect(panel.getByText('En «Contabilidad» › «Cierres».')).toBeVisible();

  await panel.getByRole('button', { name: 'Historial' }).click();
  await expect(panel.getByText('hace 5 min · 2 mensajes')).toBeVisible();
  await panel.getByRole('button', { name: /^Cómo emito una factura/ }).click();
  await expect(panel.getByText('Abre «Facturación».')).toBeVisible();

  await panel.getByLabel('Tu pregunta').fill('¿Y la nota de crédito?');
  await panel.getByLabel('Tu pregunta').press('Enter');
  await expect(panel.getByText('Los cierres están en «Contabilidad» › «Cierres».')).toBeVisible();
  expect(preguntas[0]).toMatchObject({ conversationId: 'c2' });

  await panel.getByRole('button', { name: 'Nueva conversación' }).click();
  await expect(panel.getByText('Abre «Facturación».')).toHaveCount(0);
  await panel.getByRole('button', { name: 'Historial' }).click();
  await panel.getByRole('button', { name: 'Borrar la conversación «Cómo emito una factura»' }).click();
  await panel.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(panel.getByRole('listitem')).toHaveCount(1);
});
