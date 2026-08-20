import { expect, test } from '@playwright/test';
import { installPartnerDossierBackend, seedMerchantSession } from './support/partner-dossier-backend';

/**
 * El expediente del negocio, de punta a punta y desde la pantalla del comercio.
 *
 * Recorre el flujo completo —abrir, sucursal, los dos QR, terminal, envío— y deja **evidencia en
 * capturas** de cada estado en `docs/visual-evidence/expediente/`.
 *
 * Lo que se afirma aquí es que la pantalla sabe recorrer el contrato y pintar cada estado; que
 * AtlasBackend se comporte así lo prueba `yarn smoke:partner-onboarding` contra servidor y base
 * reales. Son las dos mitades y ninguna sustituye a la otra: un simulado prueba que la vista sabe
 * pintar la forma que este repositorio CREE que el backend sirve.
 */

const EVIDENCIA = 'docs/visual-evidence/expediente';

/** Un PNG mínimo real: el flujo sube un archivo de verdad, no un `Buffer` cualquiera. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test.describe('expediente del negocio', () => {
  test('recorre el trámite completo y el embudo encoge en cada paso', async ({ page }) => {
    const backend = await installPartnerDossierBackend(page);
    await seedMerchantSession(page);

    await page.goto('/portal-comercio/expediente');
    await expect(page.getByTestId('btn-abrir-expediente')).toBeVisible();
    await page.screenshot({ path: `${EVIDENCIA}/01-abrir.png`, fullPage: true });

    // --- Abrir el expediente ---------------------------------------------------------------
    await page.getByTestId('campo-legalName').fill('Comercial Andina S.R.L.');
    await page.getByTestId('campo-taxId').fill('1023456789');
    await page.getByTestId('campo-contactEmail').fill('contacto@andina.test');
    await page.getByTestId('btn-abrir-expediente').click();

    /*
     * Recién abierto, la pantalla dice TODO lo que falta. Es la afirmación central: descubrir los
     * requisitos de uno en uno, a base de envíos rechazados, es lo que convierte un trámite en una
     * pelea.
     */
    const pendientes = page.getByTestId('expediente-pendientes');
    await expect(pendientes).toBeVisible();
    await expect(pendientes.locator('[data-requirement="branch"]')).toBeVisible();
    await expect(pendientes.locator('[data-requirement="business_qr"]')).toBeVisible();
    await expect(pendientes.locator('[data-requirement="bank_qr"]')).toBeVisible();
    await page.screenshot({ path: `${EVIDENCIA}/02-pendientes.png`, fullPage: true });

    // Con requisitos pendientes, enviar está apagado: la pantalla no ofrece lo que va a fallar.
    await expect(page.getByTestId('btn-enviar-revision')).toBeDisabled();

    // --- Sucursal --------------------------------------------------------------------------
    await page.getByTestId('campo-branchCode').fill('SC-01');
    await page.getByTestId('campo-branchName').fill('Sucursal Centro');
    await page.getByTestId('btn-registrar-sucursal').click();
    await expect(page.getByTestId('lista-sucursales')).toContainText('SC-01');
    await expect(pendientes.locator('[data-requirement="branch"]')).toHaveCount(0);

    // --- Los dos QR ------------------------------------------------------------------------
    await page.getByTestId('input-qr-negocio').setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: PNG });
    await page.getByTestId('btn-subir-qr-negocio').click();
    await expect(page.getByTestId('tabla-qr').locator('[data-qr-kind="business"]')).toBeVisible();

    await page.locator('#bankInstitutionCode').fill('BNB');
    await page.locator('#accountNumberMasked').fill('****7890');
    await page.getByTestId('input-qr-bancario').setInputFiles({ name: 'qr-bank.png', mimeType: 'image/png', buffer: PNG });
    await page.getByTestId('btn-subir-qr-bancario').click();
    await expect(page.getByTestId('tabla-qr').locator('[data-qr-kind="bank"]')).toBeVisible();

    /*
     * La sigla ASFI llegó al backend. Se comprueba sobre lo que el backend RECIBIÓ y no sobre lo
     * que la tabla pinta: es lo que permite cruzar el QR con el padrón del regulador, y si se
     * perdiera por el camino la pantalla seguiría viéndose igual.
     */
    expect(backend.qrCodes.find((qr) => qr.qrKind === 'bank')?.bankInstitutionCode).toBe('BNB');
    await page.screenshot({ path: `${EVIDENCIA}/03-qr.png`, fullPage: true });

    // --- Terminal POS ----------------------------------------------------------------------
    await page.getByTestId('campo-pos-serial').fill('SN-00042');
    await page.getByTestId('btn-registrar-pos').click();
    await expect(page.getByTestId('tabla-pos')).toContainText('SN-00042');

    // El terminal cuelga de la sucursal elegida: sin esto, un cobro no se puede situar en un local.
    expect(backend.posTerminals[0]?.branchId).toBe(backend.branches[0]?.branchId);
    await page.screenshot({ path: `${EVIDENCIA}/04-pos.png`, fullPage: true });

    // --- Envío ------------------------------------------------------------------------------
    // Queda un requisito que esta pantalla todavía no cubre —el representante legal—, así que el
    // envío sigue apagado. Se afirma en vez de disimularlo: la pantalla está diciendo la verdad.
    await expect(pendientes.locator('[data-requirement="legal_representative"]')).toBeVisible();
    await expect(page.getByTestId('btn-enviar-revision')).toBeDisabled();
    await page.screenshot({ path: `${EVIDENCIA}/05-estado-final.png`, fullPage: true });
  });

  test('el serial repetido se rechaza y la pantalla lo explica', async ({ page }) => {
    await installPartnerDossierBackend(page);
    await seedMerchantSession(page);
    await page.goto('/portal-comercio/expediente');

    await page.getByTestId('campo-legalName').fill('Comercial Andina S.R.L.');
    await page.getByTestId('campo-taxId').fill('1023456789');
    await page.getByTestId('campo-contactEmail').fill('contacto@andina.test');
    await page.getByTestId('btn-abrir-expediente').click();

    await page.getByTestId('campo-branchCode').fill('SC-01');
    await page.getByTestId('campo-branchName').fill('Sucursal Centro');
    await page.getByTestId('btn-registrar-sucursal').click();
    await expect(page.getByTestId('lista-sucursales')).toContainText('SC-01');

    await page.getByTestId('campo-pos-serial').fill('SN-DUP');
    await page.getByTestId('btn-registrar-pos').click();
    await expect(page.getByTestId('tabla-pos')).toContainText('SN-DUP');

    await page.getByTestId('campo-pos-serial').fill('SN-DUP');
    await page.getByTestId('btn-registrar-pos').click();

    /*
     * El mensaje del backend llega ENTERO hasta la pantalla, con la sucursal donde ya está ese
     * serial. Es el dato que convierte el rechazo en algo accionable, y el que se perdería si la
     * pasarela reescribiera el error con un texto propio.
     */
    await expect(page.getByTestId('expediente-feedback')).toContainText('POS_SERIAL_ALREADY_REGISTERED');
    await page.screenshot({ path: `${EVIDENCIA}/06-serial-repetido.png`, fullPage: true });
  });
});
