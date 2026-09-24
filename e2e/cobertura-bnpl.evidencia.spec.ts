import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import ts from 'typescript';

/**
 * Cobertura BNPL con doble control (P-04/P-05, 2026-09-24), contra un backend SIMULADO.
 *
 * El contrato cambió: registrar el pago al comercio ya no es mandar una fecha. Lo que se afirma
 * aquí es lo que VIAJA —referencia, importe exacto como cadena, moneda, comercio, fecha y el id del
 * comprobante recién subido— y que cada rechazo nuevo del sistema se lea en lenguaje de usuario.
 * Que el backend se comporte así lo prueban sus propias baterías de integración; esto prueba que la
 * pantalla habla ese contrato.
 */
const EVIDENCIA = 'docs/visual-evidence/operaciones';

const CUENTA_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const COBERTURA_ID = '7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const CUOTA_ID = '5d6e7f80-9a1b-4c2d-8e3f-4a5b6c7d8e9f';
const RECUPERACION_ID = '9f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a';
const ARCHIVO_ID = '2b3c4d5e-6f70-4a81-9b2c-3d4e5f607182';

const COBERTURA = {
  id: COBERTURA_ID,
  accountId: CUENTA_ID,
  installmentId: CUOTA_ID,
  amount: '300.00',
  status: 'SCHEDULED',
  reason: 'CUSTOMER_INSTALLMENT_DEFAULT_COVERAGE',
  scheduledPaymentDate: '2026-09-20',
  paidAt: null,
  currency: 'BOB',
  settlementStatus: null,
  settlementRegisteredByMe: false,
};

/* Coberturas con un pago ya registrado: por otra persona y por quien mira (lo dice el sistema). */
const COBERTURA_DE_OTRO_ID = '8b2c3d4e-5f60-4b7c-9d8e-0f1a2b3c4d5e';
const COBERTURA_MIA_ID = '6c3d4e5f-6071-4c8d-8e9f-1a2b3c4d5e6f';
const COBERTURA_DE_OTRO = {
  ...COBERTURA,
  id: COBERTURA_DE_OTRO_ID,
  settlementStatus: 'PENDING_APPROVAL',
  settlementReference: 'TRF-1001',
  settlementRegisteredByUserId: '99999999-9999-4999-8999-999999999999',
  settlementRegisteredByMe: false,
};
const COBERTURA_MIA = {
  ...COBERTURA,
  id: COBERTURA_MIA_ID,
  settlementStatus: 'PENDING_APPROVAL',
  settlementReference: 'TRF-1002',
  settlementRegisteredByUserId: '1',
  settlementRegisteredByMe: true,
};

const REVISION_ID = '3e4f5a6b-7c8d-4e9f-8a0b-1c2d3e4f5a6b';
const REVISION_PROPIA_ID = '4f5a6b7c-8d9e-4f0a-9b1c-2d3e4f5a6b7c';
const REVISION_CONTRATO_ID = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d';
const AVISO_ID = '0a1b2c3d-4e5f-4061-8728-394a5b6c7d8e';
const REVISIONES = [
  {
    id: REVISION_ID,
    installmentId: CUOTA_ID,
    reason: 'PAYMENT_NOTICE_UNRESOLVED',
    status: 'OPEN',
    details: {},
    openedAt: '2026-09-21T10:00:00.000Z',
    openedByMe: false,
    installment: { id: CUOTA_ID, installmentNumber: 2, dueDate: '2026-09-15', amount: '300.00', status: 'OVERDUE' },
    pendingNotices: [{ id: AVISO_ID, amount: '300.00', paidAt: '2026-09-14T15:00:00.000Z', status: 'REPORTED', evidenceRef: null }],
    allowedActions: ['CONFIRM_NOTICE', 'REJECT_NOTICE'],
  },
  {
    id: REVISION_PROPIA_ID,
    installmentId: CUOTA_ID,
    reason: 'COVERAGE_WITH_PENDING_NOTICE',
    status: 'OPEN',
    details: {},
    openedAt: '2026-09-22T10:00:00.000Z',
    openedByMe: true,
    installment: { id: CUOTA_ID, installmentNumber: 2, dueDate: '2026-09-15', amount: '300.00', status: 'OVERDUE' },
    pendingNotices: [{ id: AVISO_ID, amount: '300.00', paidAt: '2026-09-14T15:00:00.000Z', status: 'REPORTED', evidenceRef: null }],
    allowedActions: [],
  },
  {
    id: REVISION_CONTRATO_ID,
    installmentId: CUOTA_ID,
    reason: 'CONTRACT_NOT_ACTIVE',
    status: 'OPEN',
    details: {},
    openedAt: '2026-09-23T10:00:00.000Z',
    openedByMe: false,
    installment: { id: CUOTA_ID, installmentNumber: 2, dueDate: '2026-09-15', amount: '300.00', status: 'OVERDUE' },
    pendingNotices: [],
    allowedActions: ['DISMISS'],
  },
];

const COBRO_ID = '1b2c3d4e-5f60-4172-8394-a5b6c7d8e9f0';
const MOVIMIENTOS = [
  { id: COBRO_ID, recoveryId: RECUPERACION_ID, movementType: 'PAYMENT', paymentReference: 'REC-100', amount: '100.10', currency: 'BOB', reversesMovementId: null, receivedAt: '2026-09-22T12:00:00.000Z', reason: null },
];

interface Espia {
  liquidaciones: Record<string, unknown>[];
  aprobaciones: number;
  cobros: Record<string, unknown>[];
  archivosRegistrados: Record<string, unknown>[];
  subidas: number;
  resoluciones: Array<{ id: string; cuerpo: Record<string, unknown> }>;
  reversos: Array<{ id: string; cuerpo: Record<string, unknown> }>;
}

interface Respuestas {
  aprobar?: { status: number; body: unknown };
  cobro?: { status: number; body: unknown };
  cubrir?: { status: number; body: unknown };
  resolver?: { status: number; body: unknown };
  coberturas?: Record<string, unknown>[];
}

async function montar(page: Page, respuestas: Respuestas = {}): Promise<Espia> {
  const espia: Espia = { liquidaciones: [], aprobaciones: 0, cobros: [], archivosRegistrados: [], subidas: 0, resoluciones: [], reversos: [] };

  await page.route('http://almacen.test/**', (route) => {
    espia.subidas += 1;
    return route.fulfill({ status: 200, body: '' });
  });

  await page.route('**/api/v1/**', async (route) => {
    const peticion = route.request();
    const url = new URL(peticion.url());
    const ruta = url.pathname;
    const metodo = peticion.method();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (ruta.endsWith('/auth/me')) {
      return json({
        user: { id: '1', email: 'finanzas@atlas.test', fullName: 'Finanzas Atlas', roleCode: 'SUPER_ADMIN', status: 'ACTIVE', permissions: [] },
      });
    }
    if (ruta.endsWith('/b2b/coverage/payables') && metodo === 'GET') return json(respuestas.coberturas ?? [COBERTURA]);
    if (ruta.endsWith('/b2b/coverage/payables') && metodo === 'POST') {
      const r = respuestas.cubrir ?? { status: 201, body: { outcome: 'SCHEDULED', ...COBERTURA } };
      return json(r.body, r.status);
    }
    if (ruta.endsWith('/b2b/coverage/installments')) {
      return json([{ id: CUOTA_ID, installmentNumber: 2, dueDate: '2026-10-30', amount: '300.00', status: 'SCHEDULED', purchaseId: 'c0ffee00-0000-4000-8000-000000000001' }]);
    }
    if (ruta.endsWith('/b2b/coverage/recoveries')) {
      return json([{ id: RECUPERACION_ID, consumerId: 'x', amountCoveredByAtlas: '300.00', amountRecovered: '100.10', currency: 'BOB', recoveryStatus: 'PARTIALLY_RECOVERED', daysPastDue: 12 }]);
    }
    if (ruta.endsWith(`/recoveries/${RECUPERACION_ID}/movements`)) return json(MOVIMIENTOS);
    const reverso = /\/recoveries\/[^/]+\/movements\/([^/]+)\/reverse$/.exec(ruta);
    if (reverso) {
      espia.reversos.push({ id: reverso[1]!, cuerpo: peticion.postDataJSON() as Record<string, unknown> });
      return json({ id: RECUPERACION_ID, amountRecovered: '0.00', replayed: false }, 201);
    }
    if (ruta.endsWith('/b2b/coverage/review-queue')) return json(REVISIONES);
    const resolucion = /\/review-queue\/([^/]+)\/resolve$/.exec(ruta);
    if (resolucion) {
      espia.resoluciones.push({ id: resolucion[1]!, cuerpo: peticion.postDataJSON() as Record<string, unknown> });
      const r = respuestas.resolver ?? { status: 200, body: { outcome: 'NOTICE_CONFIRMED', pendingNoticesLeft: 0 } };
      return json(r.body, r.status);
    }
    if (ruta.endsWith(`/payables/${COBERTURA_ID}/paid`)) {
      const cuerpo = peticion.postDataJSON() as Record<string, unknown>;
      espia.liquidaciones.push(cuerpo);
      return json({ outcome: 'PENDING_APPROVAL', replayed: false, payable: COBERTURA, settlement: { ...cuerpo, status: 'PENDING_APPROVAL', registeredByUserId: '1' }, recovery: null }, 202);
    }
    if (ruta.endsWith(`/payables/${COBERTURA_ID}/settlement/approve`)) {
      espia.aprobaciones += 1;
      const r = respuestas.aprobar ?? { status: 200, body: { outcome: 'CONFIRMED', replayed: false } };
      return json(r.body, r.status);
    }
    if (ruta.endsWith(`/recoveries/${RECUPERACION_ID}/apply-payment`)) {
      espia.cobros.push(peticion.postDataJSON() as Record<string, unknown>);
      const r = respuestas.cobro ?? { status: 200, body: { id: RECUPERACION_ID, replayed: false } };
      return json(r.body, r.status);
    }
    if (ruta.endsWith('/b2b/accounts')) {
      return json({ items: [{ id: CUENTA_ID, tradeName: 'Roho Home Center' }], total: 1 });
    }
    if (ruta.endsWith('/files/upload-signature')) {
      return json({ storageKey: 'b2b/comprobante.pdf', uploadUrl: 'http://almacen.test/subida', method: 'PUT', requiredHeaders: {}, expiresAt: '2099-01-01T00:00:00Z' });
    }
    if (ruta.endsWith('/files') && metodo === 'POST') {
      espia.archivosRegistrados.push(peticion.postDataJSON() as Record<string, unknown>);
      return json({ id: ARCHIVO_ID, fileName: 'comprobante.pdf', status: 'ACTIVE' }, 201);
    }
    if (ruta.endsWith('/files')) return json([]);
    if (ruta.endsWith('/catalog/domains')) return json({ domains: [] });
    return json([]);
  });

  await page.addInitScript(() => {
    window.localStorage.setItem('atlas_access_token', 'e2e-internal-token');
    window.localStorage.setItem('atlas_session_kind', 'internal');
  });
  return espia;
}

/* ------------------------------------------------------------------------------------------ */
/* La traducción, aislada: se transpila el módulo y se ejecuta en Node, sin página.            */
/* ------------------------------------------------------------------------------------------ */

type ModuloCobertura = {
  mensajeDeCobertura: (error: unknown, contexto?: 'liquidacion' | 'revision') => string | null;
  estadoDeLiquidacion: (fila: Record<string, unknown>, registradaAqui?: boolean) => { texto: string; pendiente: boolean; registradaPorMi: boolean; hay: boolean };
  importeLegible: (valor: unknown, moneda?: unknown) => string;
  importeExacto: (valor: unknown) => string | null;
  problemaDeLiquidacion: (datos: Record<string, unknown>, ahora?: Date) => string | null;
  motivoDeRevision: (codigo: unknown) => string;
};

function cargarModulo(): ModuloCobertura {
  const fuente = readFileSync(join(__dirname, '..', 'lib', 'coberturaBnpl.ts'), 'utf8');
  const js = ts.transpileModule(fuente, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const modulo = { exports: {} as Record<string, unknown> };
  new Function('module', 'exports', js)(modulo, modulo.exports);
  return modulo.exports as unknown as ModuloCobertura;
}

test.describe('lib/coberturaBnpl', () => {
  const m = cargarModulo();

  test('cada código nuevo se dice sin jerga', () => {
    for (const code of ['FOUR_EYES_REQUIRED', 'DUPLICATE_REFERENCE', 'NOT_DUE', 'ALREADY_PAID', 'CANCELLED', 'ALREADY_COVERED', 'RECOVERY_OVERPAYMENT', 'SETTLEMENT_ALREADY_REGISTERED', 'SETTLEMENT_IN_PROGRESS', 'NO_PENDING_SETTLEMENT']) {
      const texto = m.mensajeDeCobertura({ code, message: 'La CxP ATLAS→comercio ...' });
      expect(texto, code).toBeTruthy();
      expect(texto!, code).not.toMatch(/CxP|CxC|ATLAS→|backend|endpoint|UUID/i);
    }
    expect(m.mensajeDeCobertura({ code: 'FOUR_EYES_REQUIRED' })).toMatch(/otra persona/);
    for (const code of ['REVIEW_ITEM_ALREADY_RESOLVED', 'REVIEW_ACTION_NOT_ALLOWED', 'NO_PENDING_NOTICE', 'NOTICE_NOT_PENDING', 'NOTICE_ID_REQUIRED', 'COVERAGE_IN_PLACE']) {
      const texto = m.mensajeDeCobertura({ code, message: 'jerga' }, 'revision');
      expect(texto, code).toBeTruthy();
      expect(texto!, code).not.toMatch(/CxP|CxC|ATLAS→|backend|endpoint|UUID|aviso REPORTED/i);
    }
    // En la cola, el doble control habla de la cobertura que esa persona pidió, no de una liquidación.
    expect(m.mensajeDeCobertura({ code: 'FOUR_EYES_REQUIRED' }, 'revision')).toMatch(/pidió la cobertura/);
    expect(m.mensajeDeCobertura({ code: 'CODIGO_DESCONOCIDO', message: 'x' })).toBeNull();
    expect(m.mensajeDeCobertura(new Error('sin código'))).toBeNull();
  });

  test('el descuadre de la liquidación dice qué campo corregir', () => {
    const texto = m.mensajeDeCobertura({
      code: 'SETTLEMENT_MISMATCH',
      message: 'La liquidación no corresponde a la CxP: importe 10.00 ≠ CxP 300.00; el beneficiario no es el comercio de la CxP; la fecha de pago está en el futuro.',
    });
    expect(texto).toContain('el importe (10.00) no es el de la cobertura (300.00)');
    expect(texto).toContain('el comercio elegido no es el de la cobertura');
    expect(texto).toContain('la fecha del pago no puede ser posterior a hoy');
    expect(texto).not.toMatch(/CxP/);
  });

  test('importe exacto con dos decimales, como cadena', () => {
    expect(m.importeExacto('300')).toBe('300.00');
    expect(m.importeExacto('300.5')).toBe('300.50');
    expect(m.importeExacto('0,01')).toBe('0.01');
    expect(m.importeExacto('300.001')).toBeNull();
    expect(m.importeExacto('0')).toBeNull();
    expect(m.importeExacto('-5')).toBeNull();
    expect(m.importeExacto('1e3')).toBeNull();
  });

  test('antes de enviar: referencia, importe, fecha no futura y comprobante', () => {
    const ahora = new Date('2026-09-24T12:00:00Z');
    const bueno = { settlementReference: 'TRF-88213', amount: '300', paidAt: '2026-09-23T10:00:00Z', tieneComprobante: true };
    expect(m.problemaDeLiquidacion(bueno, ahora)).toBeNull();
    expect(m.problemaDeLiquidacion({ ...bueno, settlementReference: 'a b' }, ahora)).toMatch(/referencia/i);
    expect(m.problemaDeLiquidacion({ ...bueno, amount: '0' }, ahora)).toMatch(/importe/i);
    expect(m.problemaDeLiquidacion({ ...bueno, paidAt: '2026-09-25T10:00:00Z' }, ahora)).toMatch(/posterior a hoy/);
    expect(m.problemaDeLiquidacion({ ...bueno, tieneComprobante: false }, ahora)).toMatch(/comprobante/);
  });

  test('la liquidación se lee desde el listado del sistema', () => {
    expect(m.estadoDeLiquidacion({ settlementStatus: null })).toMatchObject({ texto: 'Sin registrar', hay: false, pendiente: false });
    expect(m.estadoDeLiquidacion({ settlementStatus: 'PENDING_APPROVAL', settlementRegisteredByMe: true })).toMatchObject({ pendiente: true, registradaPorMi: true });
    expect(m.estadoDeLiquidacion({ settlementStatus: 'PENDING_APPROVAL', settlementRegisteredByMe: false })).toMatchObject({ pendiente: true, registradaPorMi: false });
    // Lo recién registrado aquí cuenta como propio aunque la tabla aún no haya recargado.
    expect(m.estadoDeLiquidacion({ settlementStatus: null }, true)).toMatchObject({ pendiente: true, registradaPorMi: true });
    expect(m.estadoDeLiquidacion({ settlementStatus: 'CONFIRMED' })).toMatchObject({ texto: 'Pago aprobado', pendiente: false });
    expect(m.importeLegible('1234.5')).toBe('Bs 1.234,50');
    expect(m.importeLegible('0.00')).toBe('Bs 0,00');
    expect(m.importeLegible('10', 'USD')).toBe('USD 10,00');
  });

  test('los motivos de revisión se leen como frase', () => {
    expect(m.motivoDeRevision('PAYMENT_NOTICE_UNRESOLVED')).toMatch(/avisó un pago/);
    expect(m.motivoDeRevision('CONTRACT_NOT_ACTIVE')).toMatch(/contrato/);
  });
});

/* ------------------------------------------------------------------------------------------ */
/* La pantalla                                                                                 */
/* ------------------------------------------------------------------------------------------ */

test('registrar el pago al comercio sube el comprobante y manda el contrato nuevo completo', async ({ page }) => {
  const espia = await montar(page);
  await page.goto('/operaciones/crm/conciliacion-cobertura');
  await expect(page.getByTestId(`fila-${COBERTURA_ID}`)).toBeVisible();

  await page.getByTestId(`accion-liquidar-${COBERTURA_ID}`).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo.getByText(/registrar el pago de la cobertura/i)).toBeVisible();

  await dialogo.getByLabel('Referencia del pago*', { exact: true }).fill('TRF-88213');
  await expect(dialogo.getByLabel('Importe pagado*', { exact: true })).toHaveValue('300.00');
  await expect(dialogo.getByTestId('select-beneficiaryAccountId')).toContainText('Roho Home Center');
  await dialogo.getByLabel('Fecha y hora del pago*', { exact: true }).fill('2026-09-20T10:30');
  await dialogo.getByLabel('Comprobante', { exact: true }).setInputFiles({
    name: 'comprobante.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%prueba\n'),
  });
  await page.screenshot({ path: `${EVIDENCIA}/cobertura-registrar-pago.png`, fullPage: true });
  await dialogo.getByRole('button', { name: 'Registrar pago' }).click();

  await expect.poll(() => espia.liquidaciones.length).toBe(1);
  expect(espia.subidas).toBe(1);
  expect(espia.archivosRegistrados[0]).toMatchObject({ ownerType: 'B2B_ACCOUNT', ownerId: CUENTA_ID, contentType: 'application/pdf' });
  expect(espia.liquidaciones[0]).toMatchObject({
    settlementReference: 'TRF-88213',
    amount: '300.00',
    currency: 'BOB',
    beneficiaryAccountId: CUENTA_ID,
    evidenceFileId: ARCHIVO_ID,
  });
  expect(new Date(String(espia.liquidaciones[0]!.paidAt)).toISOString()).toBe(String(espia.liquidaciones[0]!.paidAt));

  // Quien registró no aprueba: la fila lo dice y deja de ofrecerle aprobar.
  await expect(page.getByText('falta la aprobación de otra persona')).toBeVisible();
  await expect(page.getByTestId(`accion-aprobar-${COBERTURA_ID}`)).toHaveCount(0);
  await expect(page.getByText('Falta la segunda firma')).toBeVisible();
});

test('sin comprobante no se envía nada y se dice qué falta', async ({ page }) => {
  const espia = await montar(page);
  await page.goto('/operaciones/crm/conciliacion-cobertura');
  await page.getByTestId(`accion-liquidar-${COBERTURA_ID}`).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Referencia del pago*', { exact: true }).fill('TRF-88213');
  await dialogo.getByLabel('Fecha y hora del pago*', { exact: true }).fill('2026-09-20T10:30');
  await dialogo.getByRole('button', { name: 'Registrar pago' }).click();
  await expect(dialogo.getByText(/adjunte el comprobante/i)).toBeVisible();
  expect(espia.liquidaciones).toHaveLength(0);
});

test('aprobar el propio pago: el rechazo de doble control se explica en palabras claras', async ({ page }) => {
  // El listado no la marca como propia (p. ej. se registró desde otra sesión con el mismo usuario):
  // la acción se ofrece, y si el sistema la rechaza por doble control se explica.
  const espia = await montar(page, {
    coberturas: [{ ...COBERTURA_DE_OTRO, id: COBERTURA_ID }],
    aprobar: { status: 403, body: { success: false, error: { code: 'FOUR_EYES_REQUIRED', message: 'Quien registró la liquidación no puede confirmarla: debe hacerlo otra persona.' } } },
  });
  await page.goto('/operaciones/crm/conciliacion-cobertura');
  await page.getByTestId(`accion-aprobar-${COBERTURA_ID}`).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByRole('button', { name: 'Aprobar pago' }).click();
  await expect(dialogo.getByText(/Usted registró esta liquidación/)).toBeVisible();
  expect(espia.aprobaciones).toBe(1);
  await page.screenshot({ path: `${EVIDENCIA}/cobertura-doble-control.png`, fullPage: true });
});

test('programar una cuota futura: el 409 dice que aún no venció', async ({ page }) => {
  await montar(page, {
    cubrir: { status: 409, body: { success: false, error: { code: 'NOT_DUE', message: 'La cuota vence el 2026-10-30.' } } },
  });
  await page.goto('/operaciones/crm/conciliacion-cobertura');
  await page.getByRole('tab', { name: /cuotas/i }).click();
  await page.getByTestId(`accion-cubrir-${CUOTA_ID}`).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Fecha programada*', { exact: true }).fill('2026-10-31');
  await dialogo.getByRole('button', { name: 'Programar cobertura' }).click();
  await expect(dialogo.getByText(/todavía no venció/)).toBeVisible();
});

test('aprobar y rechazar sólo se ofrecen con un pago pendiente, y nunca a quien lo registró', async ({ page }) => {
  await montar(page, { coberturas: [COBERTURA, COBERTURA_DE_OTRO, COBERTURA_MIA] });
  await page.goto('/operaciones/crm/conciliacion-cobertura');
  await expect(page.getByTestId(`fila-${COBERTURA_MIA_ID}`)).toBeVisible();

  // Sin pago registrado: se registra; no hay nada que aprobar.
  await expect(page.getByTestId(`accion-liquidar-${COBERTURA_ID}`)).toBeVisible();
  await expect(page.getByTestId(`accion-aprobar-${COBERTURA_ID}`)).toHaveCount(0);
  await expect(page.getByTestId(`fila-${COBERTURA_ID}`)).toContainText('Sin registrar');

  // Pendiente y registrado por otra persona: se aprueba o rechaza; no se registra otro.
  await expect(page.getByTestId(`accion-aprobar-${COBERTURA_DE_OTRO_ID}`)).toBeVisible();
  await expect(page.getByTestId(`accion-liquidar-${COBERTURA_DE_OTRO_ID}`)).toHaveCount(0);
  await expect(page.getByTestId(`fila-${COBERTURA_DE_OTRO_ID}`)).toContainText('espera la aprobación de otra persona');
  await page.getByTestId(`mas-acciones-${COBERTURA_DE_OTRO_ID}`).click();
  await expect(page.getByTestId(`accion-rechazar-${COBERTURA_DE_OTRO_ID}`)).toBeVisible();
  await page.keyboard.press('Escape');

  // Pendiente y registrado por quien mira: ninguna decisión, y la fila lo dice.
  const mia = page.getByTestId(`fila-${COBERTURA_MIA_ID}`);
  await expect(mia).toContainText('Registrado por usted');
  await expect(page.getByTestId(`accion-aprobar-${COBERTURA_MIA_ID}`)).toHaveCount(0);
  await expect(page.getByTestId(`accion-rechazar-${COBERTURA_MIA_ID}`)).toHaveCount(0);
  await expect(page.getByTestId(`mas-acciones-${COBERTURA_MIA_ID}`)).toHaveCount(0);
  await page.screenshot({ path: `${EVIDENCIA}/cobertura-pago-pendiente-por-persona.png`, fullPage: true });
});

test('la cola de revisión lista los avisos con su motivo en palabras', async ({ page }) => {
  await montar(page);
  await page.goto('/operaciones/crm/conciliacion-cobertura');
  await page.getByRole('tab', { name: /en revisión/i }).click();
  const fila = page.getByTestId(`fila-${REVISION_ID}`);
  await expect(fila).toContainText('El cliente avisó un pago que nadie verificó a tiempo');
  await expect(fila).toContainText('Cuota 2 · vence el 15/09/2026');
  await expect(fila).toContainText('Bs 300,00 pagados el 14/09/2026');
  await page.screenshot({ path: `${EVIDENCIA}/cobertura-en-revision.png`, fullPage: true });
});

test('confirmar el pago del cliente desde la fila manda la acción y lo verificado', async ({ page }) => {
  const espia = await montar(page);
  await page.goto('/operaciones/crm/conciliacion-cobertura');
  await page.getByRole('tab', { name: /en revisión/i }).click();
  await page.getByTestId(`accion-confirmar-aviso-${REVISION_ID}`).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo.getByText(/comprobó con el comercio que recibió el dinero/)).toBeVisible();
  await dialogo.getByLabel('Qué se verificó*', { exact: true }).fill('Extracto del comercio del 14/09');
  await page.screenshot({ path: `${EVIDENCIA}/cobertura-revision-confirmar.png`, fullPage: true });
  await dialogo.getByRole('button', { name: 'Confirmar pago' }).click();
  await expect.poll(() => espia.resoluciones.length).toBe(1);
  // Con un solo aviso pendiente no se pregunta cuál: no viaja `noticeId`.
  expect(espia.resoluciones[0]).toEqual({ id: REVISION_ID, cuerpo: { action: 'CONFIRM_NOTICE', note: 'Extracto del comercio del 14/09' } });
});

test('rechazar el aviso con motivo; si otra persona ya lo resolvió se explica', async ({ page }) => {
  const espia = await montar(page, {
    resolver: { status: 409, body: { success: false, error: { code: 'REVIEW_ITEM_ALREADY_RESOLVED', message: 'El elemento ya se resolvió (NOTICE_CONFIRMED).' } } },
  });
  await page.goto('/operaciones/crm/conciliacion-cobertura');
  await page.getByRole('tab', { name: /en revisión/i }).click();
  await page.getByTestId(`mas-acciones-${REVISION_ID}`).click();
  await page.getByTestId(`accion-rechazar-aviso-${REVISION_ID}`).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Motivo del rechazo*', { exact: true }).fill('El comercio no recibió el dinero');
  await dialogo.getByRole('button', { name: 'Rechazar aviso' }).click();
  await expect(dialogo.getByText(/Otra persona ya resolvió esta revisión/)).toBeVisible();
  expect(espia.resoluciones[0]).toEqual({ id: REVISION_ID, cuerpo: { action: 'REJECT_NOTICE', note: 'El comercio no recibió el dinero' } });
});

test('quien pidió la cobertura no ve cómo resolverla; un contrato no activo sólo se descarta', async ({ page }) => {
  const espia = await montar(page);
  await page.goto('/operaciones/crm/conciliacion-cobertura');
  await page.getByRole('tab', { name: /en revisión/i }).click();

  const propia = page.getByTestId(`fila-${REVISION_PROPIA_ID}`);
  await expect(propia).toContainText('Usted la pidió: la resuelve otra persona');
  await expect(page.getByTestId(`accion-confirmar-aviso-${REVISION_PROPIA_ID}`)).toHaveCount(0);
  await expect(page.getByTestId(`mas-acciones-${REVISION_PROPIA_ID}`)).toHaveCount(0);

  await expect(page.getByTestId(`accion-confirmar-aviso-${REVISION_CONTRATO_ID}`)).toHaveCount(0);
  await page.getByTestId(`accion-descartar-${REVISION_CONTRATO_ID}`).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Motivo*', { exact: true }).fill('Contrato suspendido');
  await dialogo.getByRole('button', { name: 'Descartar' }).click();
  await expect.poll(() => espia.resoluciones.length).toBe(1);
  expect(espia.resoluciones[0]).toEqual({ id: REVISION_CONTRATO_ID, cuerpo: { action: 'DISMISS', note: 'Contrato suspendido' } });
});

test('el cobro de recuperación manda su referencia e importe exacto; repetirlo se avisa', async ({ page }) => {
  const espia = await montar(page, { cobro: { status: 200, body: { id: RECUPERACION_ID, replayed: true } } });
  await page.goto('/operaciones/crm/conciliacion-cobertura');
  await page.getByRole('tab', { name: /recuperaciones/i }).click();
  await page.getByTestId(`accion-recuperar-${RECUPERACION_ID}`).click();
  const dialogo = page.getByRole('dialog');
  // Lo que falta, en céntimos exactos: 300.00 − 100.10.
  await expect(dialogo.getByLabel('Monto (BOB)*', { exact: true })).toHaveValue('199.90');
  await dialogo.getByLabel('Referencia del cobro*', { exact: true }).fill('REC-55102');
  await dialogo.getByRole('button', { name: 'Aplicar pago' }).click();
  await expect.poll(() => espia.cobros.length).toBe(1);
  expect(espia.cobros[0]).toEqual({ amount: '199.90', paymentReference: 'REC-55102', currency: 'BOB' });
  await expect(page.getByText('Ese cobro ya estaba registrado')).toBeVisible();
});

test('la moneda del cobro es la de la recuperación, no una supuesta', async ({ page }) => {
  const espia = await montar(page);
  await page.route('**/api/v1/b2b/coverage/recoveries', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: RECUPERACION_ID, consumerId: 'x', amountCoveredByAtlas: '300.00', amountRecovered: '0.00', currency: 'USD', recoveryStatus: 'OPEN', daysPastDue: 3 }]),
    }),
  );
  await page.goto('/operaciones/crm/conciliacion-cobertura');
  await page.getByRole('tab', { name: /recuperaciones/i }).click();
  await page.getByTestId(`accion-recuperar-${RECUPERACION_ID}`).click();
  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Referencia del cobro*', { exact: true }).fill('REC-77');
  await dialogo.getByRole('button', { name: 'Aplicar pago' }).click();
  await expect.poll(() => espia.cobros.length).toBe(1);
  expect(espia.cobros[0]).toMatchObject({ currency: 'USD', amount: '300.00' });
});

test('los cobros de una recuperación se ven y uno se revierte con referencia y motivo', async ({ page }) => {
  const espia = await montar(page);
  await page.goto('/operaciones/crm/conciliacion-cobertura');
  await page.getByRole('tab', { name: /recuperaciones/i }).click();
  await page.getByTestId(`accion-cobros-${RECUPERACION_ID}`).click();
  const detalle = page.getByRole('dialog');
  await expect(detalle.getByText('Cobros de la recuperación')).toBeVisible();
  const cobro = page.getByTestId(`fila-${COBRO_ID}`);
  await expect(cobro).toContainText('REC-100');
  await expect(cobro).toContainText('Vigente');
  await page.screenshot({ path: `${EVIDENCIA}/recuperacion-cobros.png`, fullPage: true });

  await page.getByTestId(`accion-revertir-${COBRO_ID}`).click();
  const formulario = page.getByRole('dialog').filter({ hasText: 'Revertir el cobro REC-100' });
  await expect(formulario.getByLabel('Referencia del reverso*', { exact: true })).toHaveValue('REV-REC-100');
  await formulario.getByLabel('Motivo*', { exact: true }).fill('El banco devolvió la transferencia');
  await formulario.getByRole('button', { name: 'Revertir cobro' }).click();
  await expect.poll(() => espia.reversos.length).toBe(1);
  expect(espia.reversos[0]).toEqual({ id: COBRO_ID, cuerpo: { reversalReference: 'REV-REC-100', reason: 'El banco devolvió la transferencia' } });
});
