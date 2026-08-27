export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
  /** Omite el reintento automático de refresh-token en 401 (usado por /auth/login, /auth/refresh, /auth/logout mismos). */
  skipAuthRetry?: boolean;
  /**
   * Cabeceras extra. Existe para `Accept`: hay rutas que devuelven el archivo o su ficha JSON
   * según lo que se pida, y sin poder decirlo se recibe la ficha y se guarda como si fuera el
   * archivo. No sirve para sobrescribir `Authorization`, que lo pone siempre la sesión.
   */
  headers?: Record<string, string>;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: { message?: string; code?: string; details?: unknown };
}

const defaultApiOrigin = 'http://localhost:3000';
const defaultApiPrefix = 'api/v1';
const defaultTimeoutMs = 20_000;
const ACCESS_TOKEN_KEY = 'atlas_access_token';
const SESSION_KIND_KEY = 'atlas_session_kind';

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function readConfiguredBaseUrl(): string {
  // `??` no basta: la variable puede venir DECLARADA Y VACÍA, que es como se configura el front
  // para hablar con su propio proxy (`next.config.ts` reescribe `/api/v1/*` hacia el backend, y es
  // lo que permite exponerlo por un túnel sin exponer el backend). Con `??`, la cadena vacía
  // atravesaba y producía una base relativa que `new URL` rechaza.
  const configured = process.env.NEXT_PUBLIC_ATLAS_API_BASE_URL;
  if (configured === undefined) return defaultApiOrigin;
  return configured.trim();
}

function readConfiguredPrefix(): string {
  return trimSlashes(process.env.NEXT_PUBLIC_ATLAS_API_PREFIX ?? defaultApiPrefix);
}

function buildApiBaseUrl(): string {
  const configuredBaseUrl = readConfiguredBaseUrl().replace(/\/+$/g, '');
  const configuredPrefix = readConfiguredPrefix();

  if (trimSlashes(configuredBaseUrl).endsWith(configuredPrefix)) {
    return configuredBaseUrl;
  }

  return `${configuredBaseUrl}/${configuredPrefix}`;
}

/**
 * El origen contra el que se resuelve una base RELATIVA.
 *
 * Una base vacía significa «el mismo origen que sirve esta página», que es exactamente lo que el
 * proxy de Next necesita. `new URL()` exige una URL absoluta, así que hay que darle ese origen
 * explícitamente. En el servidor no existe `location`, y entonces una base relativa no se puede
 * resolver: se falla diciendo QUÉ variable configurar, en vez de dejar escapar un
 * `Failed to construct 'URL': Invalid URL` que no significa nada para quien lo lee.
 */
function resolveOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  throw new Error(
    'La API del ERP no está configurada para llamadas desde el servidor: define NEXT_PUBLIC_ATLAS_API_BASE_URL con una URL absoluta.',
  );
}

function buildUrl(path: string, query?: ApiRequestOptions['query']): string {
  const base = buildApiBaseUrl();
  const absolute = /^https?:\/\//i.test(base);
  const url = absolute
    ? new URL(`${base}/${trimSlashes(path)}`)
    : new URL(`/${trimSlashes(base)}/${trimSlashes(path)}`, resolveOrigin());

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  });

  return url.toString();
}

/**
 * Población de la sesión guardada. Hace falta porque el refresh de cada canal es un endpoint
 * distinto: renovar una sesión de comercio contra `/auth/refresh` (el del panel interno) devuelve
 * 401 y expulsa al comercio sin motivo.
 */
export type SessionKind = 'internal' | 'merchant';

export function getSessionKind(): SessionKind {
  if (typeof window === 'undefined') return 'internal';
  return window.localStorage.getItem(SESSION_KIND_KEY) === 'merchant' ? 'merchant' : 'internal';
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string, kind: SessionKind = getSessionKind()): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
  window.localStorage.setItem(SESSION_KIND_KEY, kind);
}

export function clearAccessToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(SESSION_KIND_KEY);
}

/** Notifica a `AuthProvider` que la sesión ya no es válida (el refresh contra /auth/refresh falló). */
function broadcastForcedLogout(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('atlas:auth:logout'));
}

function isApiEnvelope<T>(payload: ApiEnvelope<T> | T | null): payload is ApiEnvelope<T> {
  return Boolean(payload && typeof payload === 'object' && 'success' in payload);
}

async function readPayload<T>(response: Response): Promise<ApiEnvelope<T> | T | null> {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) return null;
  return (await response.json().catch(() => null)) as ApiEnvelope<T> | T | null;
}

/**
 * Los detalles campo a campo que acompañan a un rechazo de validación.
 *
 * El backend responde `{ code: 'VALIDATION_ERROR', message: 'Los datos enviados no son válidos.',
 * details: [{ path, message }] }`: el mensaje es genérico A PROPÓSITO —vale para cualquier
 * endpoint— y lo que dice QUÉ está mal viaja en `details`. Mostrando sólo el mensaje, la pantalla
 * pedía corregir un formulario de doce campos sin decir cuál, que es como convertir una validación
 * precisa en un juego de adivinanzas.
 */
function describeValidationDetails(details: unknown): string | null {
  if (!Array.isArray(details) || details.length === 0) return null;
  const lines = details
    .map((detail) => {
      if (!detail || typeof detail !== 'object') return null;
      const { path, message } = detail as { path?: unknown; message?: unknown };
      if (typeof message !== 'string' || message.length === 0) return null;
      // La ruta se antepone sólo cuando existe: en un error de nivel raíz añadiría un guion suelto.
      return typeof path === 'string' && path.length > 0 ? `${path}: ${message}` : message;
    })
    .filter((line): line is string => line !== null);
  // Se acotan a cuatro: un cuerpo mal formado puede producir docenas de incidencias y una pared de
  // texto se lee igual de mal que un mensaje genérico.
  const shown = lines.slice(0, 4).join(' · ');
  const rest = lines.length - 4;
  return rest > 0 ? `${shown} (y ${rest} más)` : shown;
}

function extractErrorMessage<T>(response: Response, payload: ApiEnvelope<T> | T | null): string {
  if (isApiEnvelope(payload) && payload.error?.message) {
    const details = describeValidationDetails(payload.error.details);
    return details ? `${payload.error.message} ${details}` : payload.error.message;
  }
  if (response.status === 404) return 'Endpoint no encontrado. Revise prefijo /api/v1, módulo e identificadores requeridos.';
  if (response.status === 401) return 'Sesión no autorizada. Inicie sesión o configure un token Bearer válido.';
  if (response.status === 403) return 'No tiene permisos para ejecutar esta acción.';
  return `Error HTTP ${response.status}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await readPayload<T>(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(response, payload));
  }

  if (isApiEnvelope<T>(payload) && payload.success === true) return payload.data as T;
  return payload as T;
}

function buildHeaders(options: ApiRequestOptions): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  for (const [nombre, valor] of Object.entries(options.headers ?? {})) {
    if (nombre.toLowerCase() === 'authorization') continue;
    headers[nombre] = valor;
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  return headers;
}

async function performFetch(path: string, options: ApiRequestOptions): Promise<Response> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), options.timeoutMs ?? defaultTimeoutMs);

  const requestInit: RequestInit = {
    method: options.method ?? 'GET',
    headers: buildHeaders(options),
    credentials: 'include',
    signal: abortController.signal,
  };

  if (options.body !== undefined) requestInit.body = JSON.stringify(options.body);

  try {
    return await fetch(buildUrl(path, options.query), requestInit);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al contactar el backend.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

let refreshPromise: Promise<boolean> | null = null;

/**
 * Renueva el access token (15 min) contra `/auth/refresh`: ese endpoint lee el refresh token
 * upstream de AtlasBackend desde una cookie httpOnly (nunca visible para este cliente) y emite
 * un nuevo JWT propio. Comparte la promesa entre 401 concurrentes para no disparar N refrescos.
 */
async function tryRefreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshPath = getSessionKind() === 'merchant' ? 'auth/merchant/refresh' : 'auth/refresh';
        const response = await performFetch(refreshPath, { method: 'POST', skipAuthRetry: true });
        const payload = await parseResponse<{ accessToken: string }>(response);
        setAccessToken(payload.accessToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

/**
 * Cliente para `atlas-integrated-backend` (puerto 3000 por defecto): Contabilidad, CRM B2B, Ads,
 * Auditoría, y — desde el gateway de auth — también login/usuarios/roles/permisos, que
 * este backend reenvía internamente hacia AtlasBackend. Envelope `{success, data}` /
 * `{success: false, error}`. Es el único backend al que el frontend habla directamente.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const response = await performFetch(path, options);

  if (response.status === 401 && !options.skipAuthRetry) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      const retryResponse = await performFetch(path, options);
      return parseResponse<T>(retryResponse);
    }
    clearAccessToken();
    broadcastForcedLogout();
  }

  return parseResponse<T>(response);
}

/**
 * Descarga un medio AUTENTICADO y lo deja como URL de blob, lista para un `<img src>`.
 *
 * Hace falta porque una etiqueta `<img>` **no puede mandar la cabecera `Authorization`**: sólo
 * tiene una URL. Apuntarla directo a una ruta del backend da 401 y una imagen vacía, que en
 * pantalla se lee como «la imagen no existe» cuando lo que pasa es que nadie la pidió con sesión.
 * El token de este portal vive en `localStorage`, no en una cookie, así que la navegación del
 * navegador no lo lleva sola.
 *
 * Lo que devuelve hay que revocarlo (`URL.revokeObjectURL`) al desmontar: un blob no revocado se
 * queda en memoria del navegador hasta que se recarga la página.
 *
 * Reintenta una vez tras renovar la sesión, igual que `apiRequest`: sin eso, la primera imagen que
 * se pide con el token caducado falla mientras el resto de la pantalla se recupera sola.
 */
export interface ArchivoDescargado {
  blob: Blob;
  fileName: string;
}

/**
 * Descarga un ARCHIVO autenticado, con el nombre que propone el servidor.
 *
 * No vale `<a href="/api/v1/…" download>`: seguir un enlace es una navegación del navegador y ahí
 * no viaja el `Authorization` —el token de este portal vive en `localStorage`, no en una cookie—,
 * así que lo que se guardaría en disco sería el 401 en JSON con extensión de PDF.
 *
 * Se distingue de `apiBlobUrl` en que conserva el nombre: una imagen para un `<img>` no necesita
 * nombre, un documento que el usuario guarda sí.
 */
export async function apiFileDownload(
  path: string,
  fallbackFileName: string,
  options: ApiRequestOptions = {},
): Promise<ArchivoDescargado> {
  let response = await performFetch(path, options);

  if (response.status === 401 && !options.skipAuthRetry) {
    const refreshed = await tryRefreshSession();
    if (refreshed) response = await performFetch(path, options);
  }

  if (!response.ok) {
    const payload = await readPayload<unknown>(response);
    throw new Error(extractErrorMessage(response, payload));
  }

  return {
    blob: await response.blob(),
    fileName: fileNameFromDisposition(response) ?? fallbackFileName,
  };
}

/** Nombre propuesto por el servidor, saneado a algo que sólo puede ser un nombre de archivo. */
function fileNameFromDisposition(response: Response): string | null {
  const raw = response.headers.get('content-disposition');
  if (!raw) return null;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(raw);
  if (!match?.[1]) return null;

  let candidato: string;
  try {
    candidato = decodeURIComponent(match[1]);
  } catch {
    candidato = match[1];
  }
  const seguro = [...candidato]
    .filter((char) => (char.codePointAt(0) ?? 0) > 0x1f && (char.codePointAt(0) ?? 0) !== 0x7f)
    .filter((char) => char !== '/' && char !== '\\')
    .join('')
    .replaceAll('..', '')
    .trim();
  return seguro ? seguro.slice(0, 255) : null;
}

export async function apiBlobUrl(path: string, options: ApiRequestOptions = {}): Promise<string> {
  let response = await performFetch(path, options);

  if (response.status === 401 && !options.skipAuthRetry) {
    const refreshed = await tryRefreshSession();
    if (refreshed) response = await performFetch(path, options);
  }

  if (!response.ok) {
    // El cuerpo del error SÍ es JSON aunque lo pedido sean bytes: se lee para conservar el motivo.
    const payload = await readPayload<unknown>(response);
    throw new Error(extractErrorMessage(response, payload));
  }

  return URL.createObjectURL(await response.blob());
}
