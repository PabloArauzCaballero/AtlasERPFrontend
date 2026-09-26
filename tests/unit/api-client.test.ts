import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

async function client(fetchImpl: typeof fetch) {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn(fetchImpl));
  return import('@/lib/apiClient');
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(URL, 'createObjectURL');
});

describe('apiRequest', () => {
  it('desenvuelve el envelope 200 y conserva URL, query y credenciales', async () => {
    const fetchImpl = vi.fn(async () => json({ success: true, data: { total: 2 } }));
    const api = await client(fetchImpl);
    expect(await api.apiRequest('items', { query: { page: 2, active: false, empty: undefined } })).toEqual({ total: 2 });
    const [url, options] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^http:\/\/localhost:3010\/api\/v1\/items/);
    expect(url).toContain('/api/v1/items?page=2&active=false');
    expect(url).not.toContain('empty=');
    expect(options.credentials).toBe('include');
  });

  it('acepta un payload JSON directo sin envelope', async () => {
    const api = await client(async () => json({ items: ['uno'] }));
    expect(await api.apiRequest('items')).toEqual({ items: ['uno'] });
  });

  it.each([400, 403, 404, 500])('conserva status y mensaje del backend en HTTP %i', async (status) => {
    const api = await client(async () => json({ success: false, error: { message: 'Rechazado' } }, status));
    await expect(api.apiRequest('items', { skipAuthRetry: true })).rejects.toMatchObject({
      name: 'ApiError', status, message: 'Rechazado',
    });
  });

  it('distingue timeout de pérdida de red sin repetir un POST', async () => {
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Abort', 'AbortError')))),
    );
    const api = await client(fetchImpl as typeof fetch);
    await expect(api.apiRequest('items', { method: 'POST', timeoutMs: 5 })).rejects.toMatchObject({
      status: 0, timedOut: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('normaliza un fallo de red y no repite un POST', async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const api = await client(fetchImpl);
    await expect(api.apiRequest('items', { method: 'POST' })).rejects.toMatchObject({ status: 0, timedOut: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('renueva el bearer una vez tras 401 y reintenta la petición', async () => {
    const calls: string[] = [];
    const api = await client(async (input, init) => {
      const path = new URL(String(input)).pathname;
      calls.push(path);
      if (path.endsWith('/auth/refresh')) return json({ success: true, data: { accessToken: 'nuevo' } });
      if ((init?.headers as Record<string, string>).Authorization === 'Bearer viejo') return json({ success: false }, 401);
      return json({ success: true, data: { ok: true } });
    });
    api.setAccessToken('viejo');
    expect(await api.apiRequest('items')).toEqual({ ok: true });
    expect(calls).toEqual(['/api/v1/items', '/api/v1/auth/refresh', '/api/v1/items']);
    expect(api.getAccessToken()).toBe('nuevo');
  });

  it('rechaza refresh 401 y emite logout forzado', async () => {
    const api = await client(async () => json({ success: false }, 401));
    const logout = vi.fn();
    window.addEventListener('atlas:auth:logout', logout, { once: true });
    api.setAccessToken('viejo');
    await expect(api.apiRequest('items')).rejects.toMatchObject({ status: 401 });
    expect(api.getAccessToken()).toBeNull();
    expect(logout).toHaveBeenCalledOnce();
  });
});

describe('archivos autenticados', () => {
  it('sanea el nombre de descarga y conserva los bytes', async () => {
    const api = await client(async () => new Response('PDF', {
      headers: { 'content-disposition': "attachment; filename*=UTF-8''..%2F..%5Cfactura.pdf" },
    }));
    const file = await api.apiFileDownload('documents/1', 'alternativo.pdf');
    expect(file.fileName).toBe('factura.pdf');
    const content = typeof file.blob.text === 'function'
      ? await file.blob.text()
      : await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file.blob);
      });
    expect(content).toBe('PDF');
  });

  it('crea un blob URL para recursos protegidos', async () => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:factura') });
    const api = await client(async () => new Response('imagen'));
    expect(await api.apiBlobUrl('documents/1')).toBe('blob:factura');
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
  });
});
