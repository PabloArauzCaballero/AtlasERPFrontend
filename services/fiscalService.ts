import { apiFileDownload, apiRequest } from '@/lib/apiClient';
import { requireUuidPathParam } from '@/lib/apiPath';
import { cargarTodo } from '@/lib/cargarTodo';
import { guardarArchivo } from '@/lib/pdf';
import type { Option } from './optionLoaders';
import type { JsonObject, PageQuery, PaginatedResult, ResourceRow } from './types';

/**
 * Facturación electrónica ante Impuestos Nacionales (SIAT), tal como la sirve el ERP en
 * `/accounting/fiscal/*`. Los estados y sus etiquetas NO se copian aquí: vienen de
 * `GET /catalog/domains` (`accounting.siatStatus`, `fiscal.sourceType`, `fiscal.issuerStatus`,
 * `fiscal.eventStatus`).
 */

export interface EstadoFiscal {
  /** `disabled` cuando el entorno no emite ante Impuestos. */
  mode: string;
  activo: boolean;
  /** Desde el 2026-09-29: si alguna factura llega de verdad a Impuestos. Ausente = no se sabe. */
  transporteReal?: boolean | undefined;
  /** Desde el 2026-09-29: qué significa el modo, dicho por el servidor. */
  nota?: string | undefined;
}

export interface EstadoEmisor {
  mode: string;
  codigoAmbiente: number | null;
  comunicacion: number | null;
  comunicacionOk: boolean | null;
  cuisVigenteHasta: string | null;
  cufdVigenteHasta: string | null;
  cufdObtenidoEn: string | null;
  ultimaSincronizacion: { en: string; ok: boolean | null; catalogos: Record<string, number>; error: string | null } | null;
  contingenciaAbierta: { id: string; desde: string; codigoEvento: number } | null;
}

const BASE = '/accounting/fiscal';
const id = (valor: string, campo: string) => requireUuidPathParam(valor, campo);

/** Una sola lectura del modo por sesión de pantalla: no cambia sin redesplegar. */
let estadoEnCurso: Promise<EstadoFiscal> | null = null;

/**
 * La fila del listado, aplanada para la tabla: el cliente y su NIT viven dentro de
 * `receptorSnapshot` (la foto del receptor al emitir, que es lo que vio Impuestos).
 */
function aplanarDocumento(row: ResourceRow): ResourceRow {
  const receptor = (row.receptorSnapshot ?? {}) as Record<string, unknown>;
  const numero = receptor.numeroDocumento ? String(receptor.numeroDocumento) : '';
  const complemento = receptor.complemento ? `-${String(receptor.complemento)}` : '';
  return {
    ...row,
    cliente: receptor.nombreRazonSocial ? String(receptor.nombreRazonSocial) : '',
    nit: numero ? `${numero}${complemento}` : '',
  };
}

export const fiscalService = {
  status(): Promise<EstadoFiscal> {
    estadoEnCurso ??= apiRequest<EstadoFiscal>(`${BASE}/status`).catch((error: unknown) => {
      estadoEnCurso = null;
      throw error;
    });
    return estadoEnCurso;
  },

  // ------------------------------------------------------------------ documentos
  listDocuments(query: PageQuery = {}) {
    return apiRequest<PaginatedResult<ResourceRow>>(`${BASE}/documents`, { query });
  },
  /** Todos los documentos (el listado topa la página), ya aplanados para la tabla. */
  async listAllDocuments(filtros: PageQuery = {}): Promise<ResourceRow[]> {
    /* Sin `limit`: el listado fiscal rechaza cualquier parámetro que no conozca (400). */
    const todo = await cargarTodo(({ limit: _limit, ...pagina }) => fiscalService.listDocuments({ ...filtros, ...pagina }));
    return (todo.items ?? []).map(aplanarDocumento);
  },
  retryDocument(documentId: string) {
    return apiRequest<ResourceRow>(`${BASE}/documents/${id(documentId, 'documento fiscal')}/retry`, { method: 'POST' });
  },
  annulDocument(documentId: string, codigoMotivo: number) {
    return apiRequest<ResourceRow>(`${BASE}/documents/${id(documentId, 'documento fiscal')}/annul`, {
      method: 'POST',
      body: { codigoMotivo },
    });
  },
  /** Guarda el PDF o el XML con el nombre que propone el servidor. */
  async downloadDocument(documentId: string, formato: 'pdf' | 'xml', numero: string) {
    const archivo = await apiFileDownload(
      `${BASE}/documents/${id(documentId, 'documento fiscal')}/${formato}`,
      `factura-${numero || documentId}.${formato}`,
    );
    guardarArchivo(archivo.blob, archivo.fileName);
  },

  // ------------------------------------------------------------------ emisor
  listIssuerProfiles() {
    return apiRequest<ResourceRow[]>(`${BASE}/issuer-profiles`);
  },
  createIssuerProfile(body: JsonObject) {
    return apiRequest<ResourceRow>(`${BASE}/issuer-profiles`, { method: 'POST', body });
  },
  updateIssuerProfile(profileId: string, body: JsonObject) {
    return apiRequest<ResourceRow>(`${BASE}/issuer-profiles/${id(profileId, 'emisor')}`, { method: 'PATCH', body });
  },
  issuerStatus(profileId: string) {
    return apiRequest<EstadoEmisor>(`${BASE}/issuer-profiles/${id(profileId, 'emisor')}/status`);
  },
  requestCuis(profileId: string) {
    return apiRequest<ResourceRow>(`${BASE}/issuer-profiles/${id(profileId, 'emisor')}/cuis`, { method: 'POST' });
  },
  requestCufd(profileId: string) {
    return apiRequest<ResourceRow>(`${BASE}/issuer-profiles/${id(profileId, 'emisor')}/cufd`, { method: 'POST' });
  },
  syncCatalogs(profileId: string, catalogo?: string) {
    return apiRequest<ResourceRow>(`${BASE}/issuer-profiles/${id(profileId, 'emisor')}/catalogs/sync`, {
      method: 'POST',
      body: catalogo ? { catalogo } : {},
    });
  },

  // ------------------------------------------------------------------ catálogos y contingencias
  listCatalog(code: string) {
    return apiRequest<ResourceRow[]>(`${BASE}/catalogs/${encodeURIComponent(code)}`);
  },
  listEvents() {
    return apiRequest<ResourceRow[]>(`${BASE}/events`);
  },
  dispatchEvents() {
    return apiRequest<ResourceRow>(`${BASE}/events/dispatch`, { method: 'POST' });
  },
};

/** Los emisores como opciones de un select («Razón social · NIT»). */
export async function loadIssuerProfiles(): Promise<Option[]> {
  const perfiles = await fiscalService.listIssuerProfiles();
  return (perfiles ?? []).map((perfil) => ({
    value: String(perfil.id ?? ''),
    label: `${String(perfil.razonSocial ?? '')} · NIT ${String(perfil.nit ?? '')}`,
    description: `Sucursal ${String(perfil.codigoSucursal ?? 0)}, punto de venta ${String(perfil.codigoPuntoVenta ?? 0)}.`,
  }));
}

/** Los motivos de anulación, tal como los publica Impuestos en su catálogo. */
export async function loadMotivosAnulacion(): Promise<Option[]> {
  const filas = await fiscalService.listCatalog('MOTIVO_ANULACION');
  return (filas ?? []).map((fila) => ({ value: String(fila.codigo ?? ''), label: String(fila.descripcion ?? fila.codigo ?? '') }));
}
