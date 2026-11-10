#!/usr/bin/env node
/**
 * Guardián: ningún color suelto, ninguna sombra, ningún degradado, ningún vidrio.
 *
 * La identidad de Cuotea vive en UNA capa: `app/tema.css` (variables) y `tailwind.config.ts`
 * (que las consume). Todo lo demás pide un token. Esto impide que vuelva el `#006a61` escrito a
 * mano en ciento veinte clases, que es como estaba el acento hasta el rediseño de 2026-11.
 * Falla si en `app/`, `components/`, `hooks/`, `lib/`, `services/` o `styles/`:
 *   1. hay un `#hex`, `rgb(`, `rgba(`, `hsl(` o `hsla(` (se admite `rgb(var(--c-…) …)`);
 *   2. se usa una familia de Tailwind sin remapear (`lime`, `fuchsia`, `pink`) o `*-black`;
 *   3. hay degradados, vidrio o sombras (`bg-gradient-*`, `from-*`/`via-*`/`to-*`, `backdrop-*`,
 *      `blur-*`, `shadow`, `shadow-sm`, `shadow-md`, `shadow-[…]`, `drop-shadow*`, `bg-clip-text`; en CSS `*-gradient(`,
 *      `backdrop-filter` y `box-shadow` que no sea `none` o un aro `0 0 0 Npx`);
 *   4. un texto baja de 12 px (`text-[9px]`, `text-[10px]`, `text-[11px]`);
 *   5. un texto usa un paso de rampa que no llega a 4,5:1 (`text-<familia>-50…400`, y el 500 de naranja y verde).
 *
 * Qué hacer en su lugar: `text-primary`, `bg-brand`, `border-border-strong`, `bg-scrim`, una clase
 * de rampa (`text-slate-600`, `bg-red-50`) o, en CSS, `rgb(var(--c-ink))`. Una excepción legítima
 * lleva `colores-ok: <motivo>` en la misma línea o en la de encima; un archivo entero exento se
 * declara abajo, con su motivo.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = process.cwd();
const CARPETAS = (process.env.COLORES_DIRS ?? 'app,components,hooks,lib,services,styles').split(',');

/** Archivos exentos de la regla 1 (color literal). Cada uno dice por qué. */
const CAPA_DE_COLOR = new Map([
  ['app/tema.css', 'es la capa de tema: aquí se definen los colores'],
  ['lib/coloresImpresos.ts', 'un lienzo que se imprime no lee variables CSS y el papel no tiene tema oscuro'],
  ['lib/qr.ts', 'un QR es negro sobre blanco en cualquier tema: si no, el lector no lo lee'],
]);

const EXCEPCION = /colores-ok:/;
const FAMILIAS = 'slate|gray|zinc|neutral|stone|red|rose|amber|orange|yellow|emerald|green|teal|blue|sky|indigo|cyan|violet|purple';

const REGLAS = [
  {
    id: 'color-literal',
    exentos: CAPA_DE_COLOR,
    // 6 u 8 dígitos; o 3-4 con alguna letra (#fff, #0af) o repetidos (#000): «Av. Principal #100» no es un color.
    patron: /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})\b|#(?=[0-9a-fA-F]{0,3}[a-fA-F])[0-9a-fA-F]{3,4}\b|#(\d)\1\1\b|\b(?:rgba?|hsla?)\((?!var\(--c-)/g,
    ayuda: 'usa un token (text-primary, bg-brand, rgb(var(--c-ink))…)',
  },
  {
    id: 'familia-sin-remapear',
    patron: /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|divide|outline|from|via|to|fill|stroke|decoration|accent|caret|placeholder|shadow)-(?:(?:lime|fuchsia|pink)-\d{2,3}|black)\b/g,
    ayuda: 'la identidad sólo admite neutro, rojo, naranja, verde y azul; usa una familia remapeada',
  },
  {
    id: 'degradado-vidrio-o-sombra',
    patron: /\bbg-gradient-to-[a-z]+\b|(?<![\w-])(?:[a-z-]+:)*(?:from|via|to)-(?:\[|[a-z]+-\d{2,3}|white|primary|brand)|\bbackdrop-(?:blur|filter|saturate|brightness)[\w\[\]-]*|(?<![\w-])blur(?:-[a-z0-9\[\]]+)?(?=[\s'"`])|\bshadow-\[|(?<![\w-])(?:[a-z-]+:)*shadow(?:-(?:sm|md|inner))?(?=[\s'"`])|\bdrop-shadow\b|\bbg-clip-text\b|\b(?:linear|radial|conic)-gradient\(|\bbackdrop-filter\s*:|\bbox-shadow\s*:(?!\s*(?:none\b|0 0 0 \d+px\b))/g,
    ayuda: 'sin sombras, degradados ni vidrio: superficie + borde; capa flotante = borde `border-strong` + velo `bg-scrim`',
  },
  {
    id: 'texto-menor-de-12px',
    patron: /(?<![\w-])(?:[a-z-]+:)*text-\[(?:9|10|11)px\]/g,
    ayuda: 'el mínimo es 12 px: usa `text-xs`',
  },
  {
    id: 'texto-sin-contraste',
    patron: new RegExp(`(?<![\\w-])(?:[a-z-]+:)*text-(?:(?:${FAMILIAS})-(?:50|100|200|300|400)|(?:amber|orange|yellow|emerald|green|teal)-500)\\b`, 'g'),
    ayuda: 'un paso 50–400 no llega a 4,5:1 como texto: usa 500 o más (o `text-white/70` sobre un relleno oscuro)',
  },
];

function archivos(dir) {
  let salida = [];
  let entradas;
  try { entradas = readdirSync(dir); } catch { return salida; }
  for (const nombre of entradas) {
    if (nombre === 'node_modules' || nombre.startsWith('.')) continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida = salida.concat(archivos(ruta));
    else if (/\.(tsx?|css)$/.test(nombre)) salida.push(ruta);
  }
  return salida;
}

const fallos = [];
for (const ruta of CARPETAS.flatMap((carpeta) => archivos(join(RAIZ, carpeta)))) {
  const rel = relative(RAIZ, ruta).split('\\').join('/');
  const lineas = readFileSync(ruta, 'utf8').split('\n');
  lineas.forEach((linea, indice) => {
    if (EXCEPCION.test(linea) || (indice > 0 && EXCEPCION.test(lineas[indice - 1]))) return;
    for (const regla of REGLAS) {
      if (regla.exentos?.has(rel)) continue;
      for (const m of linea.matchAll(regla.patron)) {
        fallos.push({ rel, n: indice + 1, regla: regla.id, texto: m[0], ayuda: regla.ayuda });
      }
    }
  });
}

if (process.env.COLORES_RESUMEN === '1') {
  const porRegla = {};
  for (const f of fallos) porRegla[f.regla] = (porRegla[f.regla] ?? 0) + 1;
  console.log(JSON.stringify({ total: fallos.length, archivos: new Set(fallos.map((f) => f.rel)).size, porRegla }, null, 2));
  process.exit(0);
}

if (fallos.length) {
  for (const f of fallos) console.error(`${f.rel}:${f.n}  [${f.regla}]  ${f.texto}  → ${f.ayuda}`);
  console.error(`\ncheck-colores: ${fallos.length} hallazgo(s) en ${new Set(fallos.map((f) => f.rel)).size} archivo(s).`);
  console.error('Excepción legítima: `colores-ok: <motivo>` en la misma línea o en la de encima.');
  process.exit(1);
}
console.log('check-colores: sin colores sueltos, sombras, degradados ni vidrio.');
