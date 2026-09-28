/**
 * «Actividad y tareas» de la ficha de una cuenta B2B: tabla paginada con buscador y filtros, alta
 * en un modal y el estado —pendiente, hecha, cancelada— cambiado desde la fila.
 *
 * Backend simulado, pero con la forma del contrato real: `GET /b2b/activities` pagina y filtra en
 * el servidor (`page`, `limit`, `search`, `status`, `activityType`) y devuelve `{ items, total }`;
 * el estado se cambia con `PATCH /b2b/activities/:id` `{ status }`. Lo que se comprueba es que la
 * pantalla PIDE eso —no que filtre en el navegador— y que pinta lo que vuelve.
 */
import { expect, test, type Page, type Route } from '@playwright/test';
import { stubCatalogDomains } from './support/catalog-domains';

const CUENTA = '11111111-1111-4111-8111-111111111111';
const EJECUTIVA = '22222222-2222-4222-8222-222222222222';
const EVIDENCIA = process.env.PW_EVIDENCIA_DIR ?? 'test-results';

interface Actividad {
  id: string;
  accountId: string;
  ownerUserId: string;
  ownerName: string;
  activityType: string;
  subject: string;
  description: string | null;
  dueAt: string | null;
  completedAt: string | null;
  status: 'PENDING' | 'DONE' | 'CANCELLED';
  createdAt: string;
}

function responder(route: Route, status: number, data: unknown) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(status < 400 ? { success: true, data } : { success: false, error: data }),
  });
}

function sembrar(): Actividad[] {
  const base = { accountId: CUENTA, ownerUserId: EJECUTIVA, ownerName: 'Rocío Vargas', completedAt: null };
  const tipos = ['CALL', 'MEETING', 'NOTE', 'EMAIL', 'WHATSAPP', 'VISIT'];
  const filas: Actividad[] = [
    { ...base, id: 'a0000000-0000-4000-8000-000000000001', activityType: 'TASK', subject: 'Enviar propuesta de tarifa', description: 'Con la comisión del 2,5 % que pidió el gerente.', dueAt: '2026-10-02T19:00:00.000Z', status: 'PENDING', createdAt: '2026-09-27T14:00:00.000Z' },
    { ...base, id: 'a0000000-0000-4000-8000-000000000002', activityType: 'MEETING', subject: 'Reunión con gerencia', description: 'Presentar el plan de cuotas.', dueAt: '2026-10-05T15:00:00.000Z', status: 'PENDING', createdAt: '2026-09-26T14:00:00.000Z' },
    { ...base, id: 'a0000000-0000-4000-8000-000000000003', activityType: 'CALL', subject: 'Llamada de seguimiento', description: 'Confirmó interés; pide la propuesta por escrito.', dueAt: null, status: 'DONE', completedAt: '2026-09-25T14:00:00.000Z', createdAt: '2026-09-25T14:00:00.000Z' },
    { ...base, id: 'a0000000-0000-4000-8000-000000000004', activityType: 'VISIT', subject: 'Visita al local', description: null, dueAt: '2026-09-20T15:00:00.000Z', status: 'CANCELLED', createdAt: '2026-09-18T14:00:00.000Z' },
  ];
  for (let i = 5; i <= 30; i += 1) {
    filas.push({
      ...base,
      id: `a0000000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`,
      activityType: tipos[i % tipos.length]!,
      subject: `Gestión comercial ${i}`,
      description: 'Registro anterior.',
      dueAt: null,
      status: 'DONE',
      completedAt: '2026-09-01T14:00:00.000Z',
      createdAt: `2026-09-${String(Math.max(1, 17 - (i % 17))).padStart(2, '0')}T14:00:00.000Z`,
    });
  }
  return filas;
}

async function instalar(page: Page) {
  const actividades = sembrar();
  const consultas: URLSearchParams[] = [];
  const cambios: Array<{ id: string; body: unknown }> = [];
  const altas: unknown[] = [];

  await page.addInitScript(() => window.localStorage.setItem('atlas_session_kind', 'internal'));
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path.endsWith('/auth/refresh')) return responder(route, 200, { accessToken: 'e2e-internal-token' });
    if (path.endsWith('/auth/me')) {
      return responder(route, 200, { user: { id: '1', email: 'admin@atlas.test', fullName: 'Admin', status: 'ACTIVE', roles: ['ADMIN'], permissions: [] } });
    }
    if (path.endsWith(`/b2b/accounts/${CUENTA}`)) {
      return responder(route, 200, {
        id: CUENTA, tradeName: 'Farmacia San Roque', legalName: 'Farmacia San Roque SRL', taxId: '1023456019', lifecycleStatus: 'CUSTOMER',
        contacts: [{ id: 'c-1', fullName: 'Marco Rojas', email: 'marco@sanroque.bo', isPrimary: true }],
      });
    }
    if (path.endsWith('/b2b/internal-users')) {
      return responder(route, 200, [{ id: EJECUTIVA, fullName: 'Rocío Vargas', roleCode: 'COMMERCIAL_EXECUTIVE' }]);
    }
    if (path.endsWith('/b2b/activities') && request.method() === 'GET') {
      consultas.push(url.searchParams);
      const q = url.searchParams;
      const buscar = (q.get('search') ?? '').toLowerCase();
      const filtradas = actividades
        .filter((a) => a.accountId === q.get('accountId'))
        .filter((a) => !q.get('status') || a.status === q.get('status'))
        .filter((a) => !q.get('activityType') || a.activityType === q.get('activityType'))
        .filter((a) => !buscar || `${a.subject} ${a.description ?? ''} ${a.ownerName}`.toLowerCase().includes(buscar))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const pagina = Number(q.get('page') ?? 1);
      const limite = Number(q.get('limit') ?? 25);
      return responder(route, 200, {
        items: filtradas.slice((pagina - 1) * limite, pagina * limite),
        page: pagina, limit: limite, total: filtradas.length, totalPages: Math.ceil(filtradas.length / limite),
      });
    }
    if (path.endsWith('/b2b/activities') && request.method() === 'POST') {
      const body = request.postDataJSON() as Record<string, string>;
      altas.push(body);
      const nueva: Actividad = {
        id: 'a0000000-0000-4000-8000-000000000099', accountId: body.accountId!, ownerUserId: body.ownerUserId!, ownerName: 'Rocío Vargas',
        activityType: body.activityType!, subject: body.subject!, description: body.description ?? null, dueAt: body.dueAt ?? null,
        status: body.activityType === 'TASK' || body.dueAt ? 'PENDING' : 'DONE', completedAt: null, createdAt: '2026-09-28T20:00:00.000Z',
      };
      actividades.unshift(nueva);
      return responder(route, 201, nueva);
    }
    const porId = /\/b2b\/activities\/([^/]+)$/.exec(path);
    if (porId && request.method() === 'PATCH') {
      const body = request.postDataJSON() as { status?: Actividad['status'] };
      cambios.push({ id: porId[1]!, body });
      const fila = actividades.find((a) => a.id === porId[1]);
      if (fila && body.status) fila.status = body.status;
      return responder(route, 200, fila);
    }
    return responder(route, 200, { items: [], total: 0 });
  });
  await stubCatalogDomains(page);
  return { consultas, cambios, altas };
}

test('la actividad de la cuenta es una tabla paginada con buscador, filtros, alta en modal y estado por fila', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const backend = await instalar(page);

  await page.goto(`/operaciones/crm/cuentas/detalle?id=${CUENTA}`);
  const seccion = page.getByTestId('actividades-cuenta');
  await expect(seccion.getByRole('heading', { name: 'Actividad y tareas' })).toBeVisible({ timeout: 120_000 });
  await expect(seccion.getByRole('cell', { name: 'Enviar propuesta de tarifa' })).toBeVisible();

  // Paginado en el servidor: 25 de 30, y la página 2 se pide al servidor.
  await expect(seccion.getByText(/25 visibles · 30 registros/)).toBeVisible();
  expect(backend.consultas.at(-1)?.get('limit')).toBe('25');
  expect(backend.consultas.at(-1)?.get('accountId')).toBe(CUENTA);

  // Las palabras del negocio, no los códigos.
  const filaTarea = seccion.getByRole('row', { name: /Enviar propuesta de tarifa/ });
  await expect(filaTarea.getByText('Pendiente', { exact: true })).toBeVisible();
  await expect(filaTarea.getByText('Tarea', { exact: true })).toBeVisible();
  await expect(seccion.getByRole('row', { name: /Visita al local/ }).getByText('Cancelada', { exact: true })).toBeVisible();
  await expect(seccion.getByText('PENDING', { exact: true })).toHaveCount(0);
  await seccion.screenshot({ path: `${EVIDENCIA}/actividades-tabla.png` });

  // Filtro por estado: lo pide al servidor.
  await seccion.getByTestId('select-filtro-status').click();
  await page.getByTestId('select-filtro-status-option-PENDING').click();
  await expect(seccion.getByText(/2 visibles · 2 registros/)).toBeVisible();
  expect(backend.consultas.at(-1)?.get('status')).toBe('PENDING');
  await seccion.screenshot({ path: `${EVIDENCIA}/actividades-filtro-pendientes.png` });

  // Buscador: también en el servidor.
  await seccion.getByPlaceholder(/buscar por asunto/i).fill('gerencia');
  await expect(seccion.getByText(/1 visibles · 1 registros/)).toBeVisible();
  expect(backend.consultas.at(-1)?.get('search')).toBe('gerencia');
  await seccion.getByPlaceholder(/buscar por asunto/i).fill('');
  await seccion.getByTestId('select-filtro-status').click();
  await page.getByTestId('select-filtro-status-option-').click();
  await expect(seccion.getByText(/25 visibles · 30 registros/)).toBeVisible();

  // Marcar como hecha desde la fila.
  await filaTarea.getByRole('button', { name: 'Hecha' }).click();
  await expect.poll(() => backend.cambios.length).toBe(1);
  expect(backend.cambios[0]).toEqual({ id: 'a0000000-0000-4000-8000-000000000001', body: { status: 'DONE' } });
  await expect(filaTarea.getByText('Hecha', { exact: true })).toBeVisible();

  // Cancelar pide confirmación.
  const filaReunion = seccion.getByRole('row', { name: /Reunión con gerencia/ });
  await filaReunion.getByRole('button', { name: 'Cancelar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar actividad' }).click();
  await expect.poll(() => backend.cambios.at(-1)?.body).toEqual({ status: 'CANCELLED' });
  await expect(filaReunion.getByText('Cancelada', { exact: true })).toBeVisible();

  // Y volver a pendiente.
  await filaReunion.getByRole('button', { name: 'Pendiente' }).click();
  await expect.poll(() => backend.cambios.at(-1)?.body).toEqual({ status: 'PENDING' });

  // Alta en un modal, no un formulario abierto encima de la tabla.
  await expect(seccion.getByRole('textbox', { name: /asunto/i })).toHaveCount(0);
  await seccion.getByTestId('directorio-crear').click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('heading', { name: 'Añadir actividad' })).toBeVisible();
  await modal.getByTestId('select-activityType').click();
  await page.getByTestId('select-activityType-option-TASK').click();
  await modal.getByTestId('select-ownerUserId').click();
  await page.getByTestId(`select-ownerUserId-option-${EJECUTIVA}`).click();
  await modal.getByRole('textbox', { name: /asunto/i }).fill('Llamar para cerrar la propuesta');
  await modal.getByRole('textbox', { name: /detalle/i }).fill('Preguntar por la firma del contrato.');
  await page.screenshot({ path: `${EVIDENCIA}/actividades-modal-alta.png` });
  await modal.getByRole('button', { name: 'Añadir actividad' }).click();

  await expect.poll(() => backend.altas.length).toBe(1);
  expect(backend.altas[0]).toEqual({
    accountId: CUENTA, ownerUserId: EJECUTIVA, activityType: 'TASK',
    subject: 'Llamar para cerrar la propuesta', description: 'Preguntar por la firma del contrato.',
  });
  const nueva = seccion.getByRole('row', { name: /Llamar para cerrar la propuesta/ });
  await expect(nueva.getByText('Pendiente', { exact: true })).toBeVisible();
  await page.screenshot({ path: `${EVIDENCIA}/actividades-ficha-completa.png`, fullPage: true });
});
