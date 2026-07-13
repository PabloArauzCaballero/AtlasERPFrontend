export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
  /** Omite el reintento automático de refresh-token en 401 (usado por /auth/login, /auth/refresh, /auth/logout mismos). */
  skipAuthRetry?: boolean;
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

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '');
}

function readConfiguredBaseUrl(): string {
  return process.env.NEXT_PUBLIC_ATLAS_API_BASE_URL ?? defaultApiOrigin;
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

function buildUrl(path: string, query?: ApiRequestOptions['query']): string {
  const url = new URL(`${buildApiBaseUrl()}/${trimSlashes(path)}`);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  });

  return url.toString();
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
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

function extractErrorMessage<T>(response: Response, payload: ApiEnvelope<T> | T | null): string {
  if (isApiEnvelope(payload) && payload.error?.message) return payload.error.message;
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
        const response = await performFetch('auth/refresh', { method: 'POST', skipAuthRetry: true });
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
