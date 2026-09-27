import type { Page, Route } from '@playwright/test';
import { instalarContabilidad } from './contabilidad-backend';

/**
 * Backend simulado de la facturación electrónica (`/accounting/fiscal/*`), con ESTADO y el mismo
 * contrato que sirve AtlasERPBackend (`src/modules/fiscal/siat/controllers`).
 *
 * Anular cambia de verdad el documento (VOIDED, 905), así que la prueba ve lo que vería el
 * operador; reintentar sólo queda anotado, porque el backend real tampoco cambia el estado: adelanta
 * el próximo intento del procesador. Lo que se afirma es la petición (`llamadas`), no un rótulo.
 *
 * Se instala ENCIMA del doble de contabilidad (sesión, `auth/me` y el comodín): Playwright da
 * prioridad a la última ruta registrada.
 */

export const DOC_VALIDADO = 'f1000000-0000-4000-8000-000000000001';
export const DOC_ERROR = 'f1000000-0000-4000-8000-000000000002';
export const DOC_OBSERVADO = 'f1000000-0000-4000-8000-000000000003';
export const DOC_RECHAZADO = 'f1000000-0000-4000-8000-000000000004';
export const EMISOR = 'e1000000-0000-4000-8000-000000000001';

export interface FiscalDoble {
  llamadas: Array<{ metodo: string; ruta: string; cuerpo: Record<string, unknown> | null }>;
  documentos: Array<Record<string, unknown>>;
}

const ok = (route: Route, data: unknown) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });

function documento(id: string, numero: string, estado: string, codigo: number | null, cliente: string, nit: string, total: string) {
  return {
    id,
    sourceType: 'MERCHANT_INVOICE',
    sourceId: id.replace('f1', 'a1'),
    numeroFactura: numero,
    cuf: `CUF${numero}`,
    siatStatus: estado,
    codigoEstadoSin: codigo,
    codigoEmision: 1,
    fechaEmision: '2026-09-26T14:00:00.000Z',
    montoTotal: total,
    receptorSnapshot: { nombreRazonSocial: cliente, numeroDocumento: nit, complemento: null },
    attemptCount: estado === 'ERROR' ? 3 : 1,
    lastError: estado === 'ERROR' ? 'Impuestos no respondió a tiempo.' : null,
    issuerProfileId: EMISOR,
    mensajes: [],
  };
}

export async function instalarFacturacionElectronica(page: Page, opciones: { activo?: boolean; simulado?: boolean } = {}): Promise<FiscalDoble> {
  const activo = opciones.activo ?? true;
  await instalarContabilidad(page);

  const doble: FiscalDoble = {
    llamadas: [],
    documentos: [
      documento(DOC_VALIDADO, '101', 'ACCEPTED', 908, 'Comercial Andina S.R.L.', '1020304050', '1130.00'),
      documento(DOC_ERROR, '102', 'ERROR', null, 'Distribuidora del Sur Ltda.', '4455667788', '560.50'),
      documento(DOC_OBSERVADO, '103', 'OBSERVED', 904, 'Farmacia Illimani', '9988776655', '87.00'),
      documento(DOC_RECHAZADO, '104', 'REJECTED', 902, 'Ferretería El Alto', '1122334455', '245.00'),
    ],
  };

  const emisores = [
    {
      id: EMISOR,
      legalEntityId: '11111111-1111-4111-8111-111111111111',
      nit: '1020304050',
      razonSocial: 'Atlas Bolivia S.A.',
      municipio: 'La Paz',
      direccion: 'Av. Arce 2631',
      codigoSucursal: 0,
      codigoPuntoVenta: 0,
      actividadEconomica: '620100',
      status: 'ACTIVE',
    },
  ];

  await page.route('**/api/v1/accounting/fiscal/**', (route) => {
    const url = new URL(route.request().url());
    const ruta = url.pathname.replace(/^\/api\/v1\/accounting\/fiscal/, '');
    const metodo = route.request().method();
    const cuerpo = metodo === 'GET' ? null : ((route.request().postDataJSON() ?? {}) as Record<string, unknown>);
    doble.llamadas.push({ metodo, ruta, cuerpo });

    if (ruta === '/status') return ok(route, { mode: activo ? 'mock_server' : 'disabled', activo });
    if (ruta === '/documents' && metodo === 'GET') {
      const estado = url.searchParams.get('status');
      const items = doble.documentos.filter((doc) => !estado || doc.siatStatus === estado);
      return ok(route, { items, total: items.length, page: 1, pageSize: 100 });
    }
    const anular = /^\/documents\/([^/]+)\/annul$/.exec(ruta);
    if (anular && metodo === 'POST') {
      const doc = doble.documentos.find((item) => item.id === anular[1]);
      if (doc) Object.assign(doc, { siatStatus: 'VOIDED', codigoEstadoSin: 905 });
      return ok(route, doc);
    }
    const reintentar = /^\/documents\/([^/]+)\/retry$/.exec(ruta);
    if (reintentar) return ok(route, { id: reintentar[1], reintento: 'PROGRAMADO' });
    if (ruta === '/issuer-profiles') return ok(route, emisores);
    if (ruta === `/issuer-profiles/${EMISOR}/status`) {
      return ok(route, {
        mode: 'mock_server',
        codigoAmbiente: 2,
        comunicacion: 926,
        comunicacionOk: true,
        cuisVigenteHasta: '2027-09-26T00:00:00.000Z',
        cufdVigenteHasta: '2026-09-27T14:00:00.000Z',
        cufdObtenidoEn: '2026-09-26T14:00:00.000Z',
        ultimaSincronizacion: { en: '2026-09-26T13:00:00.000Z', ok: true, catalogos: { ACTIVIDADES: 1, MOTIVO_ANULACION: 2 }, error: null },
        contingenciaAbierta: null,
      });
    }
    if (ruta === '/catalogs/MOTIVO_ANULACION') {
      return ok(route, [
        { id: 'm1', catalogCode: 'MOTIVO_ANULACION', codigo: '1', descripcion: 'FACTURA MAL EMITIDA', extra: {}, simulated: opciones.simulado ?? false, syncedAt: '2026-09-26T13:00:00.000Z' },
        { id: 'm3', catalogCode: 'MOTIVO_ANULACION', codigo: '3', descripcion: 'DATOS DE EMISION INCORRECTOS', extra: {}, simulated: opciones.simulado ?? false, syncedAt: '2026-09-26T13:00:00.000Z' },
      ]);
    }
    if (ruta.startsWith('/catalogs/')) {
      return ok(route, [
        { id: 'c1', catalogCode: 'ACTIVIDADES', codigo: '620100', descripcion: 'ACTIVIDADES DE PROGRAMACION INFORMATICA', extra: {}, simulated: opciones.simulado ?? false, syncedAt: '2026-09-26T13:00:00.000Z' },
      ]);
    }
    if (ruta === '/events') {
      return ok(route, [
        {
          id: 'ev000000-0000-4000-8000-000000000001',
          issuerProfileId: EMISOR,
          codigoEvento: 2,
          descripcion: 'Inaccesibilidad al servicio web de Impuestos',
          inicio: '2026-09-25T10:00:00.000Z',
          fin: '2026-09-25T11:30:00.000Z',
          status: 'DISPATCHED',
          paquetes: [{ id: 'p1', cantidadFacturas: 12, codigoEstado: 908, sentAt: '2026-09-25T11:35:00.000Z', validatedAt: '2026-09-25T11:40:00.000Z' }],
        },
      ]);
    }
    if (metodo === 'POST') return ok(route, { despachado: true });
    return ok(route, []);
  });

  return doble;
}
