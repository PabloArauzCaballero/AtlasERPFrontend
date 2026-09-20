import type { Page, Route } from '@playwright/test';

/**
 * Backend simulado de contabilidad, con el MISMO contrato que sirve AtlasERPBackend.
 *
 * Es un doble con ESTADO, no una colección de respuestas fijas, y esa diferencia es la que hace
 * que la prueba valga: lo que se comprueba es qué manda la pantalla ahora que el backend deduce
 * el período, el libro y las cuentas, y eso sólo se ve mirando el cuerpo de cada POST. Por eso
 * cada alta se guarda aquí y queda disponible en `cuerposEnviados`.
 *
 * Lo que este doble NO prueba es que AtlasERPBackend deduzca bien: eso lo prueban sus propias
 * baterías (`accounting-defaults.service.spec.ts`) contra los modelos reales.
 */

export const EMPRESA = '11111111-1111-4111-8111-111111111111';
export const CLIENTE = '22222222-2222-4222-8222-222222222222';
export const OTRO_CLIENTE = '22222222-2222-4222-8222-999999999999';
export const CUENTA_INGRESO = '33333333-3333-4333-8333-333333333333';
export const FACTURA_ABIERTA = '44444444-4444-4444-8444-444444444444';
export const FACTURA_PAGADA = '44444444-4444-4444-8444-555555555555';
export const FACTURA_DE_OTRO = '44444444-4444-4444-8444-666666666666';

interface Fallo {
  status: number;
  code: string;
  message: string;
}

export interface ContabilidadDoble {
  /** El cuerpo de cada POST, por ruta: es lo que se afirma en las pruebas. */
  cuerposEnviados: Array<{ ruta: string; cuerpo: Record<string, unknown> }>;
  /** Hace que el siguiente POST a esa ruta falle como falla el backend de verdad. */
  fallarCon(ruta: string, fallo: Fallo): void;
}

const ok = (route: Route, data: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

const lista = (route: Route, items: unknown[]) => ok(route, { items, total: items.length });

const FACTURAS = [
  {
    id: FACTURA_ABIERTA,
    invoiceNo: 'FAC-AR-2026-000001',
    legalEntityId: EMPRESA,
    customerBpId: CLIENTE,
    invoiceDate: '2026-09-01',
    dueDate: '2026-09-30',
    netAmount: 1000,
    taxAmount: 130,
    grossAmount: 1130,
    currencyCode: 'BOB',
    status: 'ISSUED',
  },
  {
    id: FACTURA_PAGADA,
    invoiceNo: 'FAC-AR-2026-000002',
    legalEntityId: EMPRESA,
    customerBpId: CLIENTE,
    invoiceDate: '2026-08-01',
    dueDate: '2026-08-30',
    netAmount: 500,
    taxAmount: 0,
    grossAmount: 500,
    currencyCode: 'BOB',
    status: 'PAID',
  },
  {
    id: FACTURA_DE_OTRO,
    invoiceNo: 'FAC-AR-2026-000003',
    legalEntityId: EMPRESA,
    customerBpId: OTRO_CLIENTE,
    invoiceDate: '2026-09-05',
    dueDate: '2026-10-05',
    netAmount: 700,
    taxAmount: 0,
    grossAmount: 700,
    currencyCode: 'BOB',
    status: 'ISSUED',
  },
];

/** Deja el portal con una sesión de personal interno y todo el módulo contable simulado. */
export async function instalarContabilidad(page: Page): Promise<ContabilidadDoble> {
  const doble: ContabilidadDoble = {
    cuerposEnviados: [],
    fallarCon(ruta, fallo) { fallos.set(ruta, fallo); },
  };
  const fallos = new Map<string, Fallo>();

  await page.addInitScript(() => {
    window.localStorage.setItem('atlas_access_token', 'e2e-internal-token');
    window.localStorage.setItem('atlas_session_kind', 'internal');
  });

  await page.route('**/api/v1/auth/me', (route) =>
    ok(route, {
      user: {
        id: '1',
        email: 'contabilidad@atlas.test',
        fullName: 'Contabilidad Atlas',
        roleCode: 'SUPER_ADMIN',
        status: 'ACTIVE',
        permissions: [],
      },
    }),
  );

  /* Todo lo que no esté declarado abajo: vacío y en verde, para que ninguna pantalla reviente. */
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.includes('/auth/me') || url.pathname.includes('/catalog/domains')) return route.fallback();

    const ruta = url.pathname.replace(/^\/api\/v1/, '');
    const metodo = route.request().method();

    if (metodo === 'POST' || metodo === 'PATCH') {
      const cuerpo = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
      doble.cuerposEnviados.push({ ruta, cuerpo });
      const fallo = fallos.get(ruta);
      if (fallo) {
        fallos.delete(ruta);
        return route.fulfill({
          status: fallo.status,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: { code: fallo.code, message: fallo.message } }),
        });
      }
      return ok(route, { id: '99999999-9999-4999-8999-999999999999', ...cuerpo });
    }

    if (ruta.endsWith('/financial-structure/legal-entities')) {
      return ok(route, [{ id: EMPRESA, code: 'ATL', legalName: 'Atlas Bolivia S.A.' }]);
    }
    if (ruta.endsWith('/financial-structure/gl-accounts')) {
      return lista(route, [{ id: CUENTA_INGRESO, accountNo: '4110', name: 'Ingresos por servicios' }]);
    }
    if (ruta.endsWith('/financial-structure/bank-accounts')) {
      return ok(route, [{ id: '55555555-5555-4555-8555-555555555555', accountName: 'BNB Cuenta corriente', currencyCode: 'BOB' }]);
    }
    if (ruta.endsWith('/business-partners')) {
      return lista(route, [
        { id: CLIENTE, partnerNo: 'BP-000001', legalName: 'Comercial Andina S.R.L.' },
        { id: OTRO_CLIENTE, partnerNo: 'BP-000002', legalName: 'Distribuidora del Sur Ltda.' },
      ]);
    }
    if (ruta.endsWith('/accounting/contracts')) {
      return lista(route, [{ id: '66666666-6666-4666-8666-666666666666', contractNo: 'CTA-000001', contractType: 'SERVICE' }]);
    }
    if (ruta.endsWith('/billing/ar-invoices')) return lista(route, FACTURAS);
    if (ruta.endsWith('/accounting/receipts')) return lista(route, []);

    /*
     * Lo que queda: vacío, pero con la FORMA que promete cada contrato.
     *
     * La estructura financiera y los eventos de facturación devuelven un array pelado, no un
     * `{items,total}`: con la forma equivocada el cargador de opciones revienta al mapear y la
     * pantalla saca «No se pudieron cargar las opciones», que se lee como una avería del ERP
     * cuando el roto es el doble.
     */
    if (ruta.includes('/financial-structure/') || ruta.endsWith('/billing/events')) return ok(route, []);
    return lista(route, []);
  });

  return doble;
}
