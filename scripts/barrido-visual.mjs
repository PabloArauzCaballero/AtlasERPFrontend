#!/usr/bin/env node
/**
 * Barrido visual del ERP: todas las páginas × tema claro y oscuro × 1280, 768 y 390.
 *
 * NO es una batería de CI: son ~400 cargas. Se corre a mano al cerrar un cambio visual, contra un
 * `next start` propio (nunca contra el `.next` de otra sesión):
 *
 *   BARRIDO_BASE=http://localhost:3111 BARRIDO_SALIDA=/private/tmp/barrido node scripts/barrido-visual.mjs
 *
 * La API va SIMULADA (sesión incluida), así que no necesita backend ni credenciales. Por cada
 * página comprueba: que no haya errores de JavaScript, que no desborde en horizontal, que el tema
 * pedido sea el aplicado y que ningún texto baje de 12 px. Deja una captura por combinación.
 * Sale con 1 si hay algún hallazgo.
 */
import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.BARRIDO_BASE ?? 'http://localhost:3111';
const SALIDA = process.env.BARRIDO_SALIDA ?? '/private/tmp/barrido-erp';
const ANCHOS = (process.env.BARRIDO_ANCHOS ?? '1280,768,390').split(',').map(Number);
const TEMAS = (process.env.BARRIDO_TEMAS ?? 'light,dark').split(',');
const SOLO = process.env.BARRIDO_SOLO; // p. ej. «/operaciones/crm» para repetir una parte

/** Las rutas salen del árbol `app/`: una página nueva entra sola en el barrido. */
function rutas(dir, prefijo = '') {
  const salida = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...rutas(ruta, `${prefijo}/${nombre}`));
    else if (nombre === 'page.tsx') salida.push(prefijo || '/');
  }
  return salida;
}

const RUTAS = rutas(join(process.cwd(), 'app'))
  .filter((ruta) => ruta !== '/' && ruta !== '/login') // sólo redirigen
  .filter((ruta) => !SOLO || ruta.startsWith(SOLO))
  .sort();

const json = (route, body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function simularApi(page, audiencia) {
  await page.route('**/api/v1/**', (route) => {
    const url = route.request().url();
    if (/\/auth\/(merchant\/)?refresh/.test(url)) return json(route, { success: true, data: { accessToken: `barrido-${audiencia}` } });
    if (url.includes('/auth/merchant/me')) {
      return json(route, { user: { id: '1', email: 'comercio@ejemplo.test', fullName: 'Comercio de ejemplo', userCode: null, phone: null, role: 'merchant', status: 'ACTIVE', mustChangePassword: false, lastLoginAt: null } });
    }
    if (url.includes('/auth/me')) {
      return json(route, { user: { id: '1', email: 'operaciones@ejemplo.test', fullName: 'Operaciones de ejemplo', roleCode: 'SUPER_ADMIN', status: 'ACTIVE', permissions: [] } });
    }
    // Lo que una pantalla espera con otra forma que `{ items, total }` se añade aquí, no en la pantalla.
    if (url.includes('/partner-onboarding/mine')) return json(route, { profiles: [] });
    if (url.includes('/portal/scope')) return json(route, { isInternalOperator: false, requiresAccountSelection: false, accounts: [] });
    return json(route, { items: [], total: 0 });
  });
}

const audienciaDe = (ruta) => (ruta.startsWith('/portal-comercio') ? 'merchant' : ruta.startsWith('/operaciones') ? 'internal' : null);

mkdirSync(SALIDA, { recursive: true });
const hallazgos = [];
const navegador = await chromium.launch();

for (const tema of TEMAS) {
  for (const ancho of ANCHOS) {
    const contexto = await navegador.newContext({ viewport: { width: ancho, height: 900 }, colorScheme: tema === 'dark' ? 'dark' : 'light' });
    for (const ruta of RUTAS) {
      const page = await contexto.newPage();
      const errores = [];
      page.on('pageerror', (error) => errores.push(error.message));
      const audiencia = audienciaDe(ruta);
      if (audiencia) {
        await simularApi(page, audiencia);
        // Clave de sesión que el portal YA usa: es un identificador técnico y no cambia con la marca.
        await page.addInitScript((tipo) => window.localStorage.setItem('atlas_session_kind', tipo), audiencia);
      }
      await page.addInitScript((elegido) => window.localStorage.setItem('cuotea-tema', elegido), tema);
      const etiqueta = `${tema}  ${String(ancho).padStart(4)}  ${ruta}`;
      try {
        await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle', timeout: 45_000 });
        await page.waitForTimeout(400);
        const medida = await page.evaluate(() => {
          const raiz = document.documentElement;
          const chicos = new Set();
          for (const nodo of document.querySelectorAll('body *')) {
            const propio = [...nodo.childNodes].some((hijo) => hijo.nodeType === 3 && hijo.textContent.trim().length > 1);
            if (!propio || nodo.closest('.material-symbols-outlined')) continue;
            const estilo = getComputedStyle(nodo);
            if (estilo.visibility === 'hidden' || estilo.display === 'none') continue;
            const px = parseFloat(estilo.fontSize);
            if (px < 12) chicos.add(`${px}px «${nodo.textContent.trim().slice(0, 30)}»`);
          }
          return { tema: raiz.getAttribute('data-theme'), desborde: raiz.scrollWidth - raiz.clientWidth, chicos: [...chicos].slice(0, 5) };
        });
        if (medida.tema !== tema) hallazgos.push(`${etiqueta}  → tema aplicado «${medida.tema}»`);
        if (medida.desborde > 1) hallazgos.push(`${etiqueta}  → desborda ${medida.desborde}px en horizontal`);
        if (medida.chicos.length) hallazgos.push(`${etiqueta}  → texto < 12 px: ${medida.chicos.join(' | ')}`);
        for (const error of errores) hallazgos.push(`${etiqueta}  → error de página: ${error}`);
        const archivo = `${tema}_${ancho}_${ruta.replace(/^\//, '').replace(/\//g, '__') || 'raiz'}.png`;
        await page.screenshot({ path: join(SALIDA, archivo), fullPage: true });
      } catch (error) {
        hallazgos.push(`${etiqueta}  → no cargó: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`);
      }
      await page.close();
    }
    await contexto.close();
    console.log(`hecho: ${tema} a ${ancho}px (${RUTAS.length} páginas)`);
  }
}
await navegador.close();

writeFileSync(join(SALIDA, 'hallazgos.txt'), hallazgos.join('\n') + '\n');
console.log(`\n${RUTAS.length} páginas × ${TEMAS.length} temas × ${ANCHOS.length} anchos. Capturas en ${SALIDA}`);
if (hallazgos.length) {
  console.error(`\n${hallazgos.length} hallazgo(s):\n${hallazgos.join('\n')}`);
  process.exit(1);
}
console.log('Sin hallazgos.');
