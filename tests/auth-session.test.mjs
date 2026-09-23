import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function session(fetchImpl, stored = {}) {
  const values = new Map(Object.entries(stored));
  const events = [];
  global.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    location: { origin: 'http://localhost:3010', pathname: '/operaciones' },
    dispatchEvent: (event) => events.push(event.type),
  };
  global.CustomEvent = class { constructor(type) { this.type = type; } };
  global.fetch = fetchImpl;
  const source = fs.readFileSync(path.join(__dirname, '../lib/apiClient.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiledModule = { exports: {} };
  const dependencies = {
    './correlationId': { newCorrelationId: () => 'test-correlation' },
    './reintentos': {
      conReintentos: (attempt) => attempt(),
      esRespuestaDePasarela: () => false,
      repeticionDe: () => 'segura',
    },
    './mensajesValidacion': { describirIncidencia: () => '' },
  };
  new Function('require', 'module', 'exports', compiled)((name) => dependencies[name], compiledModule, compiledModule.exports);
  return { api: compiledModule.exports, values, events };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(status < 400 ? { success: true, data } : { success: false, error: { message: 'Rechazado' } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('bootstrap destruye el bearer heredado y recupera la sesión interna con cookie', async () => {
  const calls = [];
  const { api, values } = session(async (url, init) => {
    calls.push({ path: new URL(url).pathname, init });
    return json({ accessToken: 'nuevo' });
  }, { atlas_access_token: 'viejo', atlas_session_kind: 'internal' });
  assert.equal(await api.bootstrapSession(), true);
  assert.equal(api.getAccessToken(), 'nuevo');
  assert.equal(values.has('atlas_access_token'), false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/v1/auth/refresh');
  assert.equal(calls[0].init.credentials, 'include');
  assert.equal(calls[0].init.headers.Authorization, undefined);
});

test('bootstrap de comercio usa su endpoint y el bearer queda solo en memoria', async () => {
  const paths = [];
  const { api, values } = session(async (url) => {
    paths.push(new URL(url).pathname);
    return json({ accessToken: 'comercio' });
  }, { atlas_session_kind: 'merchant' });
  assert.equal(await api.bootstrapSession(), true);
  assert.equal(api.getAccessToken(), 'comercio');
  assert.deepEqual(paths, ['/api/v1/auth/merchant/refresh']);
  assert.deepEqual([...values.entries()], [['atlas_session_kind', 'merchant']]);
});

test('diez 401 concurrentes hacen un solo refresh y diez reintentos', async () => {
  let refreshCount = 0;
  let oldCount = 0;
  let newCount = 0;
  let release;
  const allOld = new Promise((resolve) => { release = resolve; });
  const { api } = session(async (url, init) => {
    if (new URL(url).pathname.endsWith('/auth/refresh')) {
      refreshCount += 1;
      return json({ accessToken: 'new' });
    }
    if (init.headers.Authorization === 'Bearer old') {
      oldCount += 1;
      if (oldCount === 10) release();
      await allOld;
      return json(null, 401);
    }
    assert.equal(init.headers.Authorization, 'Bearer new');
    newCount += 1;
    return json({ ok: true });
  });
  api.setAccessToken('old');
  await Promise.all(Array.from({ length: 10 }, () => api.apiRequest('test')));
  assert.equal(refreshCount, 1);
  assert.equal(newCount, 10);
});

test('refresh rechazado limpia la sesión; fallo de red la conserva para reintento', async () => {
  const rejected = session(async (url) => new URL(url).pathname.endsWith('/auth/refresh') ? json(null, 401) : json(null, 401), {
    atlas_session_kind: 'merchant',
  });
  await assert.rejects(rejected.api.apiRequest('test'), { status: 401 });
  assert.equal(rejected.values.has('atlas_session_kind'), false);
  assert.deepEqual(rejected.events, ['atlas:auth:logout']);

  const unavailable = session(async (url) => {
    if (new URL(url).pathname.endsWith('/auth/merchant/refresh')) throw new TypeError('network');
    return json(null, 401);
  }, { atlas_session_kind: 'merchant' });
  await assert.rejects(unavailable.api.apiRequest('test'), { status: 503 });
  assert.equal(unavailable.values.get('atlas_session_kind'), 'merchant');
  assert.deepEqual(unavailable.events, []);

  const serverFailure = session(async (url) => json(null, new URL(url).pathname.endsWith('/auth/refresh') ? 503 : 401), {
    atlas_session_kind: 'internal',
  });
  await assert.rejects(serverFailure.api.apiRequest('test'), { status: 503 });
  assert.equal(serverFailure.values.get('atlas_session_kind'), 'internal');
});

test('un refresh pendiente no puede reabrir la sesión después de limpiar logout', async () => {
  let respond;
  const pending = new Promise((resolve) => { respond = resolve; });
  const { api, values } = session(() => pending, { atlas_session_kind: 'internal' });
  const bootstrap = api.bootstrapSession();
  api.clearAccessToken();
  respond(json({ accessToken: 'tardio' }));
  assert.equal(await bootstrap, false);
  assert.equal(api.getAccessToken(), null);
  assert.equal(values.size, 0);
});

test('un refresh de arranque antiguo no reemplaza un login nuevo', async () => {
  let respond;
  const pending = new Promise((resolve) => { respond = resolve; });
  const { api } = session(() => pending, { atlas_session_kind: 'internal' });
  const bootstrap = api.bootstrapSession();
  api.setAccessToken('login-nuevo', 'internal');
  respond(json({ accessToken: 'sesion-antigua' }));
  assert.equal(await bootstrap, true);
  assert.equal(api.getAccessToken(), 'login-nuevo');
});

test('un 401 antiguo no cierra un login que terminó durante el refresh', async () => {
  let respond;
  const pending = new Promise((resolve) => { respond = resolve; });
  let refreshStarted;
  const started = new Promise((resolve) => { refreshStarted = resolve; });
  const { api, events } = session(async (url, init) => {
    if (new URL(url).pathname.endsWith('/auth/refresh')) {
      refreshStarted();
      return pending;
    }
    return init.headers.Authorization === 'Bearer login-nuevo' ? json({ ok: true }) : json(null, 401);
  });
  api.setAccessToken('anterior');
  const request = api.apiRequest('test');
  await started;
  api.setAccessToken('login-nuevo');
  respond(json(null, 401));
  assert.deepEqual(await request, { ok: true });
  assert.equal(api.getAccessToken(), 'login-nuevo');
  assert.deepEqual(events, []);
});

test('descargas mantienen bearer y nombre de archivo', async () => {
  const { api } = session(async (_url, init) => {
    assert.equal(init.headers.Authorization, 'Bearer in-memory');
    return new Response('PDF', { headers: { 'content-disposition': 'attachment; filename="factura.pdf"' } });
  });
  api.setAccessToken('in-memory');
  const result = await api.apiFileDownload('documents/1', 'fallback.pdf');
  assert.equal(result.fileName, 'factura.pdf');
  assert.equal(await result.blob.text(), 'PDF');
});

test('la descarga con 401 renueva una vez y conserva el nombre del archivo', async () => {
  let refreshes = 0;
  let downloads = 0;
  const { api } = session(async (url, init) => {
    if (new URL(url).pathname.endsWith('/auth/refresh')) {
      refreshes += 1;
      return json({ accessToken: 'renovado' });
    }
    downloads += 1;
    if (init.headers.Authorization === 'Bearer viejo') return json(null, 401);
    assert.equal(init.headers.Authorization, 'Bearer renovado');
    return new Response('PDF', { headers: { 'content-disposition': 'attachment; filename="renovado.pdf"' } });
  });
  api.setAccessToken('viejo');
  const result = await api.apiFileDownload('documents/1', 'fallback.pdf');
  assert.equal(result.fileName, 'renovado.pdf');
  assert.equal(await result.blob.text(), 'PDF');
  assert.equal(refreshes, 1);
  assert.equal(downloads, 2);
});
