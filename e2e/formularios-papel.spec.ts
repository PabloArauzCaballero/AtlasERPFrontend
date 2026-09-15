/**
 * Formularios en papel: el cuaderno, el botón y el modo transcripción, con el backend SIMULADO.
 *
 * Lo que se comprueba aquí es la mitad que vive en el navegador: que el cuaderno lista los
 * formularios, que «Imprimir» pide al ERP la plantilla `blank-form` con un payload que tiene
 * código, versión y secciones, y que con el modo transcripción activo cada petición lleva la serie
 * del papel en las cabeceras. El PDF real lo imprime el worker; eso se mide aparte.
 */
import { expect, test, type Page } from '@playwright/test';

const ADMIN = {
  id: '1', tenantId: '1', email: 'admin@atlas.test', fullName: 'Admin de pruebas', name: 'Admin de pruebas',
  userCode: null, status: 'ACTIVE', department: null, jobTitle: null, mustChangePassword: false, mfaEnabled: false,
  roles: ['ADMIN'], legacyRoles: ['ADMIN'], permissions: [],
};

interface Capturada { templateId?: string; payload?: { formCode?: string; formVersion?: string; sections?: unknown[] }; headers: Record<string, string> }

async function sesionFingida(page: Page, capturadas: Capturada[]) {
  await page.addInitScript(() => {
    window.localStorage.setItem('atlas_access_token', 'e2e-internal-token');
    window.localStorage.setItem('atlas_session_kind', 'internal');
  });
  await page.route('**/api/v1/**', (route) => {
    const url = route.request().url();
    if (url.includes('/auth/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { user: ADMIN } }) });
    if (url.includes('/documents/generate')) {
      const cuerpo = route.request().postDataJSON() as Capturada;
      capturadas.push({ ...cuerpo, headers: route.request().headers() });
      return route.fulfill({ status: 200, contentType: 'application/pdf', headers: { 'content-disposition': 'attachment; filename="prueba.pdf"' }, body: Buffer.from('%PDF-1.7 prueba') });
    }
    // Catálogos y listados: vacíos pero con la forma que las pantallas esperan.
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], total: 0 } }) });
  });
}

test.describe('cuaderno de formularios en papel (operaciones)', () => {
  test('lista los formularios y «Imprimir» pide la plantilla blank-form con código y versión', async ({ page }) => {
    const capturadas: Capturada[] = [];
    await sesionFingida(page, capturadas);
    await page.goto('/operaciones/admin/formularios-papel');
    await expect(page.getByRole('heading', { name: /formularios en papel/i })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('papel-entrada-ERP-CONTABILIDAD-DOCUMENTO-CREAR')).toBeVisible();

    const descarga = page.waitForEvent('download');
    await page.getByTestId('papel-imprimir-ERP-CONTABILIDAD-DOCUMENTO-CREAR').click();
    await descarga;

    expect(capturadas).toHaveLength(1);
    const [peticion] = capturadas;
    expect(peticion.templateId).toBe('blank-form');
    expect(peticion.payload?.formCode).toBe('ERP-CONTABILIDAD-DOCUMENTO-CREAR');
    expect(peticion.payload?.formVersion).toMatch(/^[0-9a-f]{8}$/);
    expect((peticion.payload?.sections ?? []).length).toBeGreaterThanOrEqual(2);
    // Sin modo transcripción, ninguna cabecera de papel.
    expect(peticion.headers['x-atlas-entry-channel']).toBeUndefined();
    await page.screenshot({ path: 'docs/visual-evidence/operaciones/formularios-papel-cuaderno.png', fullPage: true });
  });

  test('el modo transcripción exige una serie válida y la manda en cada petición mientras está activo', async ({ page }) => {
    const capturadas: Capturada[] = [];
    await sesionFingida(page, capturadas);
    await page.goto('/operaciones/admin/formularios-papel');
    await expect(page.getByTestId('transcripcion-form')).toBeVisible({ timeout: 60_000 });

    // Serie inválida: no se activa y se explica.
    await page.getByLabel(/número de serie/i).fill('4F3A');
    await page.getByTestId('transcripcion-activar').click();
    await expect(page.getByTestId('transcripcion-error')).toBeVisible();
    await expect(page.getByTestId('transcripcion-chapa')).toHaveCount(0);

    // Serie válida escrita «a mano»: se normaliza.
    await page.getByLabel(/número de serie/i).fill(' doc-4f3a9c2e7b10 ');
    await page.getByLabel(/código del formulario/i).fill('ERP-CONTABILIDAD-DOCUMENTO-CREAR@a91f3c2e');
    await page.getByTestId('transcripcion-activar').click();
    await expect(page.getByTestId('transcripcion-activa')).toContainText('DOC-4F3A9C2E7B10');
    await expect(page.getByTestId('transcripcion-chapa')).toContainText('DOC-4F3A9C2E7B10');

    const descarga = page.waitForEvent('download');
    await page.getByTestId('papel-imprimir-ERP-CONTABILIDAD-RECIBO-REGISTRAR').click();
    await descarga;
    const [peticion] = capturadas;
    expect(peticion.headers['x-atlas-entry-channel']).toBe('PAPER');
    expect(peticion.headers['x-atlas-paper-serial']).toBe('DOC-4F3A9C2E7B10');
    expect(peticion.headers['x-atlas-paper-form']).toBe('ERP-CONTABILIDAD-DOCUMENTO-CREAR@a91f3c2e');
    await page.screenshot({ path: 'docs/visual-evidence/operaciones/formularios-papel-transcripcion.png', fullPage: true });

    // El modo sobrevive a la navegación dentro de la pestaña y se apaga desde la chapa.
    await page.goto('/operaciones/contabilidad/documentos/crear');
    await expect(page.getByTestId('transcripcion-chapa')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId('papel-documento-contable')).toBeVisible();
    await page.getByTestId('transcripcion-chapa').click();
    await expect(page.getByTestId('transcripcion-chapa')).toHaveCount(0);
  });
});

test.describe('cuaderno del portal del comercio', () => {
  test('lista los formularios del comercio y el expediente se imprime con sus secciones', async ({ page }) => {
    const capturadas: Capturada[] = [];
    await page.addInitScript(() => {
      window.localStorage.setItem('atlas_access_token', 'e2e-merchant-token');
      window.localStorage.setItem('atlas_session_kind', 'merchant');
    });
    const COMERCIO = { ...ADMIN, roles: ['MERCHANT_ADMIN'], legacyRoles: ['MERCHANT_ADMIN'], email: 'comercio@atlas.test' };
    await page.route('**/api/v1/**', (route) => {
      const url = route.request().url();
      if (url.includes('/auth/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { user: COMERCIO } }) });
      if (url.includes('/documents/generate')) {
        capturadas.push({ ...(route.request().postDataJSON() as Capturada), headers: route.request().headers() });
        return route.fulfill({ status: 200, contentType: 'application/pdf', body: Buffer.from('%PDF-1.7 prueba') });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { items: [], total: 0 } }) });
    });
    await page.goto('/portal-comercio/formularios');
    await expect(page.getByRole('heading', { name: /formularios en papel/i })).toBeVisible({ timeout: 60_000 });
    const descarga = page.waitForEvent('download');
    await page.getByTestId('papel-imprimir-PORTAL-EXPEDIENTE-ABRIR').click();
    await descarga;
    expect(capturadas[0]?.templateId).toBe('blank-form');
    expect(capturadas[0]?.payload?.formCode).toBe('PORTAL-EXPEDIENTE-ABRIR');
    // Datos, representante y documentos adjuntos: tres secciones.
    expect((capturadas[0]?.payload?.sections ?? []).length).toBe(3);
    await page.screenshot({ path: 'docs/visual-evidence/portal-comercio/formularios-papel-cuaderno.png', fullPage: true });
  });
});
