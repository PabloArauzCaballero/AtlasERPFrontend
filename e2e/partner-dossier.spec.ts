import { expect, test } from '@playwright/test';
import { installPartnerDossierBackend, seedMerchantSession } from './support/partner-dossier-backend';
import { pngConQr } from './support/qr-png';

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

/*
 * Un PNG con un QR DE VERDAD dentro.
 *
 * Antes esto era un PNG blanco de 1x1 y bastaba, porque la pantalla subía cualquier imagen. Ya no:
 * comprueba en el navegador que la imagen lleve un código antes de gastar la subida
 * (`lib/qrImagen.ts`), así que un cuadrado blanco es exactamente lo que rechaza — y el recorrido se
 * caía ahí, sin llegar a nada de lo que venía después. Se genera con el mismo codificador que dibuja
 * los QR de cada caja, así que la prueba sube lo que un comercio subiría.
 */
const PNG = pngConQr('https://atlas.test/qr/prueba');

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
    // El expediente se reorganizó en pestañas, así que cada paso empieza abriendo la suya.
    /*
     * La sucursal ya no se escribe aquí: se ELIGE una de las que el comercio tiene dadas de alta en
     * «Sucursales». El expediente dejó de ser un segundo sitio donde inventar locales.
     */
    await page.getByTestId('tab-sucursales').click();
    await page.getByTestId('campo-sucursal-erp').selectOption('erp-branch-1');
    await page.getByTestId('campo-branchCode').fill('SC-01');
    await page.getByTestId('btn-registrar-sucursal').click();
    await expect(page.getByTestId('lista-sucursales')).toContainText('SC-01');
    await expect(pendientes.locator('[data-requirement="branch"]')).toHaveCount(0);

    /*
     * El puente viajó. Es LA afirmación de este paso: sin `erpBranchId` vuelven a existir dos listas
     * de sucursales que nadie puede cruzar, y el QR de un mostrador podría acabar enseñándose en
     * otro. Se comprueba sobre lo que el backend recibió, no sobre lo que la lista pinta.
     */
    expect(backend.branches[0]?.erpBranchId).toBe('erp-branch-1');

    // Y la que ya se declaró deja de ofrecerse: dos declaraciones del mismo local serían dos QR.
    await expect(page.getByTestId('campo-sucursal-erp').locator('option[value="erp-branch-1"]')).toHaveCount(0);
    await expect(page.getByTestId('campo-sucursal-erp').locator('option[value="erp-branch-2"]')).toHaveCount(1);

    // --- Terminal POS, dentro de su sucursal -------------------------------------------------
    /*
     * El terminal ya no se da de alta en una pestaña propia con un desplegable de sucursales: se
     * abre la sucursal y se registra ahí. Por eso la prueba entra por la sucursal — si algún día
     * volviera a existir un alta suelta, este recorrido dejaría de pasar, que es lo que se quiere.
     */
    await page.getByTestId('tab-sucursales').click();
    await page.getByTestId('sucursal-SC-01').click();
    await page.getByTestId('campo-pos-serial-SC-01').fill('SN-00042');
    await page.getByTestId('btn-registrar-pos-SC-01').click();
    await expect(page.getByTestId('qr-sucursal-SC-01')).toContainText('SN-00042');

    // El terminal cuelga de la sucursal desde la que se dio de alta: sin esto, un cobro no se
    // puede situar en un local.
    expect(backend.posTerminals[0]?.branchId).toBe(backend.branches[0]?.branchId);
    await page.screenshot({ path: `${EVIDENCIA}/04-pos.png`, fullPage: true });

    // --- Los dos QR, que ya NO viven en el expediente -----------------------------------------
    /*
     * Se sale de esta pantalla a propósito. Los dos códigos se subían aquí dentro, y ahí el
     * expediente aprobado cerraba la edición: el comercio que ya cobraba era el único que no podía
     * reemplazar su propio QR. Ahora los dos se suben en «Mi QR de cobro», que es un dato vivo del
     * negocio y no un trámite de alta.
     *
     * La prueba los sube DESDE ALLÍ y vuelve al expediente a comprobar que el embudo encogió: es la
     * forma de afirmar que las dos pantallas hablan del mismo expediente y no de dos cosas
     * parecidas.
     */
    await page.goto('/portal-comercio/qr-cobro');

    await page.getByTestId('input-qr-negocio').setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: PNG });
    await page.getByTestId('btn-subir-qr-negocio').click();
    await expect(page.getByTestId('qr-negocio-vigente')).toBeVisible();

    await page.getByTestId('campo-entidad').fill('BNB');
    await page.getByTestId('campo-cuenta').fill('****7890');
    await page.getByTestId('input-qr-cobro').setInputFiles({ name: 'qr-bank.png', mimeType: 'image/png', buffer: PNG });
    await page.getByTestId('btn-subir-qr-cobro').click();

    /*
     * La sigla ASFI llegó al backend. Se comprueba sobre lo que el backend RECIBIÓ y no sobre lo
     * que la pantalla pinta: es lo que permite cruzar el QR con el padrón del regulador, y si se
     * perdiera por el camino la pantalla seguiría viéndose igual.
     */
    await expect
      .poll(() => backend.qrCodes.find((qr) => qr.qrKind === 'bank')?.bankInstitutionCode)
      .toBe('BNB');
    await page.screenshot({ path: `${EVIDENCIA}/03-qr.png`, fullPage: true });

    // --- Envío ------------------------------------------------------------------------------
    // Los dos QR dejaron de faltar, y se comprueba en el embudo del expediente: es lo que prueba
    // que subirlos en otra pantalla cuenta para el mismo trámite.
    await page.goto('/portal-comercio/expediente');
    await expect(pendientes.locator('[data-requirement="business_qr"]')).toHaveCount(0);
    await expect(pendientes.locator('[data-requirement="bank_qr"]')).toHaveCount(0);

    // Queda un requisito que esta pantalla todavía no cubre —el representante legal—, así que el
    // envío sigue apagado. Se afirma en vez de disimularlo: la pantalla está diciendo la verdad.
    await page.getByTestId('tab-estado').click();
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

    await page.getByTestId('tab-sucursales').click();
    await page.getByTestId('campo-sucursal-erp').selectOption('erp-branch-1');
    await page.getByTestId('campo-branchCode').fill('SC-01');
    await page.getByTestId('btn-registrar-sucursal').click();
    await expect(page.getByTestId('lista-sucursales')).toContainText('SC-01');

    await page.getByTestId('tab-sucursales').click();
    await page.getByTestId('sucursal-SC-01').click();
    await page.getByTestId('campo-pos-serial-SC-01').fill('SN-DUP');
    await page.getByTestId('btn-registrar-pos-SC-01').click();
    await expect(page.getByTestId('qr-sucursal-SC-01')).toContainText('SN-DUP');

    await page.getByTestId('campo-pos-serial-SC-01').fill('SN-DUP');
    await page.getByTestId('btn-registrar-pos-SC-01').click();

    /*
     * El mensaje del backend llega ENTERO hasta la pantalla, con la sucursal donde ya está ese
     * serial. Es el dato que convierte el rechazo en algo accionable, y el que se perdería si la
     * pasarela reescribiera el error con un texto propio.
     */
    await expect(page.getByTestId('expediente-feedback')).toContainText('POS_SERIAL_ALREADY_REGISTERED');
    await page.screenshot({ path: `${EVIDENCIA}/06-serial-repetido.png`, fullPage: true });
  });
});
