import { expect, test, type Locator, type Page } from '@playwright/test';
import { stubCatalogDomains } from './support/catalog-domains';
import {
  CLIENTE,
  CONTRATO,
  EMPRESA,
  FACTURA_ABIERTA,
  PERIODO_ABIERTO,
  PERIODO_CERRADO,
  instalarContabilidad,
  type ContabilidadDoble,
} from './support/contabilidad-backend';

/**
 * Contabilidad después del recorte del 2026-09-19, con el backend SIMULADO.
 *
 * Tres casos por pantalla —el válido, el del borde y el que falla—, que es lo que pidió Pablo:
 * «asegúrate de que todo funcione realmente». Lo que se afirma aquí no lo ve un type-check:
 *
 *  - que el alta ya NO mande el período, el libro ni las cuentas que el backend deduce (se mira el
 *    CUERPO del POST, no la pantalla);
 *  - que el cuadre del recibo sea de verdad y no un rótulo fijo («Pendiente de cuadre» salía
 *    siempre, con el recibo cuadrado o vacío, y el botón dejaba enviar igual);
 *  - que un rechazo del backend se lea en la pantalla en vez de cerrarse en silencio;
 *  - y que la cabecera tenga UN botón de ayuda, no tres.
 */

let doble: ContabilidadDoble;

test.beforeEach(async ({ page }) => {
  doble = await instalarContabilidad(page);
  /* Playwright da prioridad a la ÚLTIMA ruta registrada: los dominios van DESPUÉS del comodín. */
  await stubCatalogDomains(page);
});

/** El cuerpo del último POST a esa ruta. */
function ultimoEnvio(ruta: string): Record<string, unknown> {
  const envios = doble.cuerposEnviados.filter((envio) => envio.ruta === ruta);
  expect(envios.length, `no se envió ningún POST a ${ruta}`).toBeGreaterThan(0);
  return envios[envios.length - 1]!.cuerpo;
}

/**
 * Elige el valor de un `OptionSelect` por su etiqueta visible.
 *
 * La etiqueta NO se compara exacta a propósito: el nombre accesible de un campo obligatorio lleva
 * el asterisco pegado («Empresa que factura*»), así que `exact` no encontraría ninguno.
 */
async function elegir(page: Page, ambito: Page | Locator, etiqueta: string, opcion: RegExp) {
  await ambito.getByLabel(etiqueta).click();
  await page.getByRole('option', { name: opcion }).click();
}

// ---------------------------------------------------------------- la cabecera

test('la cabecera tiene un solo botón de ayuda: ni «Recorrido» ni una ⓘ suelta', async ({ page }) => {
  await page.goto('/operaciones/contabilidad/documentos');
  const cabecera = page.locator('[data-tutorial-id="workspace-header"]');
  await expect(cabecera).toBeVisible({ timeout: 30_000 });

  await expect(cabecera.getByTestId('screen-guide-button')).toBeVisible();
  await expect(cabecera.getByRole('button', { name: /recorrido/i })).toHaveCount(0);
  /* La ⓘ de la barra duplicaba «¿Qué es esto?»: era el mismo texto detrás de otro botón. */
  await expect(cabecera.getByTestId('crud-explicacion')).toHaveCount(0);

  /* Y lo ocasional cabe en un solo control, con su nombre escrito. */
  await cabecera.getByTestId('crud-mas').click();
  const cajon = page.getByRole('dialog');
  await expect(cajon.getByTestId('crud-pdf')).toBeVisible();
  await expect(cajon.getByTestId('crud-csv')).toBeVisible();
  await expect(cajon.getByTestId('crud-actualizar')).toBeVisible();
});

test('el aviso de la pantalla se lee dentro de «¿Qué es esto?», no en un botón aparte', async ({ page }) => {
  await page.goto('/operaciones/contabilidad/documentos');
  await page.getByTestId('screen-guide-button').click();
  const panel = page.getByRole('dialog');
  await expect(panel.getByTestId('guide-note')).toContainText(/sin lápiz ni papelera/i);
});

// ------------------------------------------------------- facturas por cobrar

test('caso válido: emitir una factura ya no pide período, libro ni cuentas del cliente', async ({ page }) => {
  await page.goto('/operaciones/contabilidad/factura-ar');
  await page.getByTestId('crud-crear').click();
  const alta = page.getByRole('dialog');
  await expect(alta).toBeVisible();

  /* Los cinco identificadores que se dejaron de pedir no están en el formulario. */
  for (const desaparecido of ['Cuenta por cobrar (AR)', 'Cuenta de impuesto', 'Código tributario', 'Período contable', 'Ledger']) {
    await expect(alta.getByLabel(desaparecido), `«${desaparecido}» debería haber desaparecido`).toHaveCount(0);
  }

  await elegir(page, alta, 'Empresa que factura', /Atlas Bolivia/);
  await elegir(page, alta, 'Cliente', /Comercial Andina/);
  await alta.getByLabel('Fecha factura').fill('2026-09-19');
  await alta.getByLabel('Fecha vencimiento').fill('2026-10-19');
  await alta.getByLabel('Descripción').fill('Servicio de cobranza septiembre');
  await alta.getByLabel('Importe neto').fill('1000');
  await alta.getByLabel('Impuesto').fill('130');
  await elegir(page, alta, 'Cuenta de ingreso', /4110/);
  await alta.getByRole('button', { name: 'Emitir factura' }).click();

  await expect(alta).toBeHidden();
  const cuerpo = ultimoEnvio('/accounting/billing/ar-invoices');
  expect(cuerpo.legalEntityId).toBe(EMPRESA);
  expect(cuerpo.customerBpId).toBe(CLIENTE);
  expect(cuerpo.netAmount).toBe(1000);
  expect(cuerpo.taxAmount).toBe(130);
  expect(cuerpo.description).toBe('Servicio de cobranza septiembre');
  for (const deducido of ['arAccountId', 'accountingPeriodId', 'ledgerId', 'taxCodeId', 'taxLiabilityAccountId']) {
    expect(cuerpo, `${deducido} lo deduce el backend: la pantalla no debe mandarlo`).not.toHaveProperty(deducido);
  }
});

test('caso límite: sin impuesto no viaja ninguna cuenta fiscal (el backend rechaza informarla)', async ({ page }) => {
  await page.goto('/operaciones/contabilidad/factura-ar');
  await page.getByTestId('crud-crear').click();
  const alta = page.getByRole('dialog');
  await elegir(page, alta, 'Empresa que factura', /Atlas Bolivia/);
  await elegir(page, alta, 'Cliente', /Comercial Andina/);
  await alta.getByLabel('Fecha factura').fill('2026-09-19');
  await alta.getByLabel('Fecha vencimiento').fill('2026-09-19');
  await alta.getByLabel('Descripción').fill('Factura exenta');
  await alta.getByLabel('Importe neto').fill('0.01');
  await elegir(page, alta, 'Cuenta de ingreso', /4110/);
  await alta.getByRole('button', { name: 'Emitir factura' }).click();

  await expect(alta).toBeHidden();
  const cuerpo = ultimoEnvio('/accounting/billing/ar-invoices');
  expect(cuerpo.netAmount).toBe(0.01);
  expect(cuerpo.taxAmount).toBe(0);
  expect(cuerpo).not.toHaveProperty('taxLiabilityAccountId');
  expect(cuerpo).not.toHaveProperty('taxCodeId');
});

test('caso error: si el período está cerrado, el motivo se lee en el formulario y no se cierra', async ({ page }) => {
  doble.fallarCon('/accounting/billing/ar-invoices', {
    status: 400,
    code: 'ACCOUNTING_PERIOD_NOT_RESOLVED',
    message: 'El período contable del 2026-09-19 está cerrado. Cámbiale la fecha al documento o reábrelo desde Cierre de períodos.',
  });

  await page.goto('/operaciones/contabilidad/factura-ar');
  await page.getByTestId('crud-crear').click();
  const alta = page.getByRole('dialog');
  await elegir(page, alta, 'Empresa que factura', /Atlas Bolivia/);
  await elegir(page, alta, 'Cliente', /Comercial Andina/);
  await alta.getByLabel('Fecha factura').fill('2026-09-19');
  await alta.getByLabel('Fecha vencimiento').fill('2026-10-19');
  await alta.getByLabel('Descripción').fill('Servicio de cobranza septiembre');
  await alta.getByLabel('Importe neto').fill('1000');
  await elegir(page, alta, 'Cuenta de ingreso', /4110/);
  await alta.getByRole('button', { name: 'Emitir factura' }).click();

  await expect(alta).toBeVisible();
  await expect(alta).toContainText(/período contable del 2026-09-19 está cerrado/i);
});

// ------------------------------------------------------------------ recibos

test('caso válido: el recibo se aplica a la factura del pagador y no pide cuentas ni libro', async ({ page }) => {
  await page.goto('/operaciones/contabilidad/recibos/crear');
  await expect(page.getByRole('heading', { name: 'Registrar recibo' })).toBeVisible({ timeout: 30_000 });

  /* Los cuatro identificadores que se dejaron de pedir no están. */
  for (const desaparecido of ['Cuenta GL banco', 'Cuenta GL control AR', 'Período contable', 'Ledger']) {
    await expect(page.getByLabel(desaparecido), `«${desaparecido}» debería haber desaparecido`).toHaveCount(0);
  }

  await elegir(page, page, 'Empresa que cobra', /Atlas Bolivia/);
  await elegir(page, page, 'Pagador', /Comercial Andina/);
  await page.getByLabel('Fecha del cobro').fill('2026-09-19');
  await page.getByLabel('Monto recibido').fill('1130');

  /* Sólo salen las facturas ABIERTAS del pagador: la pagada y la de otro cliente no. */
  await page.getByLabel('Factura a la que se aplica').click();
  const opciones = page.getByRole('listbox').getByRole('option');
  await expect(opciones).toHaveCount(1);
  await expect(opciones.first()).toContainText('FAC-AR-2026-000001');
  await opciones.first().click();

  /* Al elegirla se propone su saldo, así que el recibo queda cuadrado sin teclear nada más. */
  await expect(page.getByTestId('recibo-estado-cuadre')).toContainText(/cuadrado/i);
  const contabilizar = page.getByTestId('recibo-contabilizar');
  await expect(contabilizar).toBeEnabled();
  await contabilizar.click();

  const cuerpo = ultimoEnvio('/accounting/receipts');
  /* Los selects controlados viajan por su input oculto: si eso se rompe, el recibo va sin dueño. */
  expect(cuerpo.legalEntityId).toBe(EMPRESA);
  expect(cuerpo.payerBpId).toBe(CLIENTE);
  expect(cuerpo.receiptDate).toBe('2026-09-19');
  expect(cuerpo.amount).toBe(1130);
  expect(cuerpo.allocations).toEqual([{ arInvoiceId: FACTURA_ABIERTA, allocatedAmount: 1130 }]);
  for (const deducido of ['bankGlAccountId', 'arControlGlAccountId', 'accountingPeriodId', 'ledgerId']) {
    expect(cuerpo, `${deducido} lo deduce el backend: la pantalla no debe mandarlo`).not.toHaveProperty(deducido);
  }
});

test('caso límite: mientras lo repartido no sume el monto, el botón no deja enviar', async ({ page }) => {
  await page.goto('/operaciones/contabilidad/recibos/crear');
  await expect(page.getByRole('heading', { name: 'Registrar recibo' })).toBeVisible({ timeout: 30_000 });
  await elegir(page, page, 'Empresa que cobra', /Atlas Bolivia/);
  await elegir(page, page, 'Pagador', /Comercial Andina/);
  await page.getByLabel('Fecha del cobro').fill('2026-09-19');
  await page.getByLabel('Monto recibido').fill('1130');

  await page.getByLabel('Factura a la que se aplica').click();
  await page.getByRole('option', { name: /FAC-AR-2026-000001/ }).click();

  /* Un céntimo de menos: el backend lo rechazaría con un 400, así que la pantalla no deja llegar. */
  const importe = page.getByLabel('Importe que se aplica a esta factura');
  await importe.fill('1129.99');
  await expect(page.getByTestId('recibo-estado-cuadre')).toContainText(/faltan por repartir/i);
  await expect(page.getByTestId('recibo-contabilizar')).toBeDisabled();

  /* Y un céntimo de más tampoco. */
  await importe.fill('1130.01');
  await expect(page.getByTestId('recibo-estado-cuadre')).toContainText(/sobran/i);
  await expect(page.getByTestId('recibo-contabilizar')).toBeDisabled();

  /* Exacto: se activa. */
  await importe.fill('1130');
  await expect(page.getByTestId('recibo-estado-cuadre')).toContainText(/cuadrado/i);
  await expect(page.getByTestId('recibo-contabilizar')).toBeEnabled();
});

test('caso error: un rechazo del backend se lee en la pantalla del recibo', async ({ page }) => {
  doble.fallarCon('/accounting/receipts', {
    status: 409,
    code: 'AR_INVOICE_ALLOCATION_EXCEEDS_OPEN_BALANCE',
    message: 'La asignación del cobro excede el saldo abierto de la factura.',
  });

  await page.goto('/operaciones/contabilidad/recibos/crear');
  await expect(page.getByRole('heading', { name: 'Registrar recibo' })).toBeVisible({ timeout: 30_000 });
  await elegir(page, page, 'Empresa que cobra', /Atlas Bolivia/);
  await elegir(page, page, 'Pagador', /Comercial Andina/);
  await page.getByLabel('Fecha del cobro').fill('2026-09-19');
  await page.getByLabel('Monto recibido').fill('1130');
  await page.getByLabel('Factura a la que se aplica').click();
  await page.getByRole('option', { name: /FAC-AR-2026-000001/ }).click();
  await page.getByTestId('recibo-contabilizar').click();

  await expect(page.getByText(/excede el saldo abierto de la factura/i)).toBeVisible();
});

// ------------------------------------------------------ cierre de períodos

test('caso válido: cerrar un período se hace desde su fila y la empresa la pone el sistema', async ({ page }) => {
  await page.goto('/operaciones/contabilidad/cierres');
  const abierto = page.getByTestId(`fila-${PERIODO_ABIERTO}`);
  await expect(abierto).toBeVisible({ timeout: 30_000 });

  /*
   * La entidad legal NO se pregunta: sale del ejercicio fiscal del período. Se pedía en un
   * desplegable, y elegir la que no era devolvía un 409 sin explicar por qué.
   */
  await abierto.getByTestId(`accion-cerrar-${PERIODO_ABIERTO}`).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toContainText('Cerrar el período');
  await expect(dialogo.getByLabel('Entidad legal')).toHaveCount(0);
  /* El select trae su valor del catálogo y llega después del primer pintado: sin esperarlo, el
     `required` del navegador bloquea el envío y no sale ninguna petición. */
  await expect(dialogo.getByLabel('Qué se cierra')).toContainText(/mensual/i);
  await dialogo.getByRole('button', { name: 'Cerrar período' }).click();
  await expect(dialogo).toBeHidden();

  const cuerpo = ultimoEnvio('/accounting/closings/periods/close');
  expect(cuerpo).toEqual({ legalEntityId: EMPRESA, periodId: PERIODO_ABIERTO, closeType: 'MONTHLY' });
});

test('caso límite: cada fila ofrece SÓLO la operación que su estado admite', async ({ page }) => {
  await page.goto('/operaciones/contabilidad/cierres');
  const abierto = page.getByTestId(`fila-${PERIODO_ABIERTO}`);
  await expect(abierto).toBeVisible({ timeout: 30_000 });
  const cerrado = page.getByTestId(`fila-${PERIODO_CERRADO}`);

  await expect(abierto.getByTestId(`accion-cerrar-${PERIODO_ABIERTO}`)).toBeVisible();
  await expect(abierto.getByTestId(`accion-reabrir-${PERIODO_ABIERTO}`)).toHaveCount(0);
  await expect(cerrado.getByTestId(`accion-reabrir-${PERIODO_CERRADO}`)).toBeVisible();
  await expect(cerrado.getByTestId(`accion-cerrar-${PERIODO_CERRADO}`)).toHaveCount(0);
  /* Y no hay papelera: cerrar no es borrar. */
  await expect(cerrado.getByTestId(`eliminar-${PERIODO_CERRADO}`)).toHaveCount(0);
});

test('caso error: si el backend rechaza la reapertura, el motivo se lee en el formulario', async ({ page }) => {
  doble.fallarCon('/accounting/closings/periods/reopen', {
    status: 409,
    code: 'PERIOD_REOPEN_NOT_ALLOWED',
    message: 'El período tuvo un cierre duro: sólo se reabre con autorización del área contable.',
  });

  await page.goto('/operaciones/contabilidad/cierres');
  const cerrado = page.getByTestId(`fila-${PERIODO_CERRADO}`);
  await expect(cerrado).toBeVisible({ timeout: 30_000 });
  await cerrado.getByTestId(`accion-reabrir-${PERIODO_CERRADO}`).click();

  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Motivo documentado').fill('Hay que corregir el asiento DOC-2026-000123.');
  await dialogo.getByRole('button', { name: 'Reabrir período' }).click();

  await expect(dialogo).toBeVisible();
  await expect(dialogo).toContainText(/cierre duro/i);
});

// ----------------------------------------------------------------- contratos

test('caso válido: la condición se pacta desde la fila del contrato, que ya no se vuelve a elegir', async ({ page }) => {
  await page.goto('/operaciones/contabilidad/contratos');
  const fila = page.getByTestId(`fila-${CONTRATO}`);
  await expect(fila).toBeVisible({ timeout: 30_000 });
  /* La contraparte se cruza con el maestro: una columna de 36 caracteres no dice de quién es. */
  await expect(fila).toContainText('Comercial Andina');

  await fila.getByTestId(`accion-termino-${CONTRATO}`).click();
  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toContainText('CTA-000001');
  await expect(dialogo.getByLabel('Contrato')).toHaveCount(0);

  await dialogo.getByLabel('Qué se pactó').fill('PLAZO_PAGO');
  await dialogo.getByLabel('Valor pactado').fill('30 días');
  await dialogo.getByLabel('Rige desde').fill('2026-10-01');
  await dialogo.getByRole('button', { name: 'Agregar condición' }).click();
  await expect(dialogo).toBeHidden();

  const cuerpo = ultimoEnvio('/accounting/contracts/terms');
  expect(cuerpo.contractId).toBe(CONTRATO);
  expect(cuerpo.termCode).toBe('PLAZO_PAGO');
  expect(cuerpo.termValueJson).toEqual({ value: '30 días' });
});

test('caso límite: sin fecha de fin, la condición viaja SIN fecha de fin (no con una vacía)', async ({ page }) => {
  await page.goto('/operaciones/contabilidad/contratos');
  const fila = page.getByTestId(`fila-${CONTRATO}`);
  await expect(fila).toBeVisible({ timeout: 30_000 });
  await fila.getByTestId(`accion-termino-${CONTRATO}`).click();

  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Qué se pactó').fill('COMISION');
  await dialogo.getByLabel('Valor pactado').fill('2,5 %');
  await dialogo.getByLabel('Rige desde').fill('2026-10-01');
  /* «Rige hasta» se deja vacío: significa «sigue vigente», no «vence hoy». */
  await dialogo.getByRole('button', { name: 'Agregar condición' }).click();
  await expect(dialogo).toBeHidden();

  const cuerpo = ultimoEnvio('/accounting/contracts/terms');
  expect(cuerpo.effectiveTo ?? null).toBeNull();
});

test('caso error: un rechazo al pactar la condición se lee en el formulario', async ({ page }) => {
  doble.fallarCon('/accounting/contracts/terms', {
    status: 409,
    code: 'CONTRACT_TERM_OVERLAP',
    message: 'Ya hay una condición PLAZO_PAGO vigente en esas fechas para este contrato.',
  });

  await page.goto('/operaciones/contabilidad/contratos');
  const fila = page.getByTestId(`fila-${CONTRATO}`);
  await expect(fila).toBeVisible({ timeout: 30_000 });
  await fila.getByTestId(`accion-termino-${CONTRATO}`).click();

  const dialogo = page.getByRole('dialog');
  await dialogo.getByLabel('Qué se pactó').fill('PLAZO_PAGO');
  await dialogo.getByLabel('Valor pactado').fill('45 días');
  await dialogo.getByLabel('Rige desde').fill('2026-10-01');
  await dialogo.getByRole('button', { name: 'Agregar condición' }).click();

  await expect(dialogo).toBeVisible();
  await expect(dialogo).toContainText(/ya hay una condición plazo_pago vigente/i);
});
