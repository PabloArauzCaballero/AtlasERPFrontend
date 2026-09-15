#!/usr/bin/env node
/**
 * Guardián: ningún campo sin «qué poner», ninguna opción sin «qué significa», ningún select nativo.
 *
 * Hasta el 2026-09-15 la opción de un select era `{ label, value }` y nada más, así que nadie
 * escribía qué significaba; y la única ayuda de campo era un `hint` siempre visible que casi
 * nadie rellenaba. Esto impide que vuelva. Falla si en `app/` o `components/`:
 *   1. un campo declarativo (`{ name: '…', label: '…' }`) no tiene `tooltip`;
 *   2. un `<FormField`, `<ChipsField`, `<CountryCityField`, `<AddressMapField` o
 *      `<MultiSelectField` en JSX no tiene `tooltip=`;
 *   3. un catálogo de `lib/catalogs.ts` tiene una opción sin `description`;
 *   4. un `tooltip`/`description` repite la etiqueta (sin tildes ni mayúsculas) o tiene menos de
 *      cuatro palabras;
 *   5. aparece un `<select` nativo fuera de `components/atlas/OptionSelect.tsx`.
 *
 * Qué hacer en su lugar: `tooltip: 'Qué poner y por qué importa. Ej.: …'`; `description:` en cada
 * opción; `OptionSelect` (o `FormField kind="select"`) en vez de `<select>`. Una excepción legítima
 * lleva `// sin-ayuda: <motivo>` en la misma línea o en la de encima (p. ej. un catálogo de
 * nombres propios). Modo aviso mientras se rellena un módulo: `AYUDA_AVISO=1`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = process.cwd();
const CARPETAS = (process.env.AYUDA_DIRS ?? 'app,components,lib').split(',');
/** Los formularios en papel son plantillas de impresión, no campos con control. */
const IGNORADAS = /^lib\/formulariosPapel\//;
const EXCEPCION = /\/\/\s*sin-ayuda:/;
const ATOMOS = /<(FormField|ChipsField|CountryCityField|AddressMapField|MultiSelectField)\b/g;
const SELECT_PERMITIDO = /components\/atlas\/OptionSelect\.tsx$/;

const normalizar = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim();

function archivos(dir) {
  const salida = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (entrada === 'node_modules' || entrada.startsWith('.')) continue;
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (/\.(tsx?|jsx?)$/.test(entrada)) salida.push(ruta);
  }
  return salida;
}

/** El objeto literal o la etiqueta JSX que empieza en `inicio`, hasta cerrar llaves/paréntesis. */
function bloqueDesde(texto, inicio, abre, cierra) {
  let profundidad = 0;
  let enCadena = null;
  for (let i = inicio; i < texto.length; i += 1) {
    const c = texto[i];
    if (enCadena) {
      if (c === '\\') i += 1;
      else if (c === enCadena) enCadena = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { enCadena = c; continue; }
    if (c === abre) profundidad += 1;
    else if (c === cierra) {
      profundidad -= 1;
      if (profundidad <= 0) return texto.slice(inicio, i + 1);
    }
  }
  return texto.slice(inicio);
}

/** Cierre de una etiqueta JSX: el `>` o `/>` que no está dentro de `{…}` ni de una cadena. */
function etiquetaDesde(texto, inicio) {
  let llaves = 0;
  let enCadena = null;
  for (let i = inicio; i < texto.length; i += 1) {
    const c = texto[i];
    if (enCadena) { if (c === enCadena) enCadena = null; continue; }
    if (llaves === 0 && (c === '"' || c === "'")) { enCadena = c; continue; }
    if (c === '{') llaves += 1;
    else if (c === '}') llaves -= 1;
    else if (c === '>' && llaves === 0) return texto.slice(inicio, i + 1);
  }
  return texto.slice(inicio);
}

const lineaDe = (texto, indice) => texto.slice(0, indice).split('\n').length;
const textoDe = (bloque, clave) => {
  const m = bloque.match(new RegExp(`\\b${clave}[=:]\\s*\\{?\\s*(['"\`])((?:\\\\.|(?!\\1).)*)\\1`));
  return m ? m[2] : null;
};

function malRedactado(texto, etiqueta) {
  if (texto === null) return null;
  const palabras = normalizar(texto).split(' ').filter(Boolean);
  if (palabras.length < 4) return 'tiene menos de cuatro palabras';
  if (etiqueta && normalizar(texto) === normalizar(etiqueta)) return 'repite la etiqueta';
  return null;
}

const hallazgos = [];
for (const carpeta of CARPETAS) {
  let lista = [];
  try { lista = archivos(join(RAIZ, carpeta)); } catch { continue; }
  for (const archivo of lista) {
    const texto = readFileSync(archivo, 'utf8');
    const lineas = texto.split('\n');
    const rel = relative(RAIZ, archivo);
    if (IGNORADAS.test(rel)) continue;
    const exenta = (linea) => EXCEPCION.test(lineas[linea - 1] ?? '') || EXCEPCION.test(lineas[linea - 2] ?? '');

    // 5. selects nativos
    if (!SELECT_PERMITIDO.test(rel)) {
      for (const m of texto.matchAll(/<select(?=[\s>])/g)) {
        const linea = lineaDe(texto, m.index);
        const antes = lineas[linea - 1].slice(0, m.index - texto.lastIndexOf('\n', m.index) - 1);
        if (/\/\/|\/\*|^\s*\*/.test(antes)) continue;
        if (!exenta(linea)) hallazgos.push(`${rel}:${linea}  <select> nativo: usa OptionSelect (o FormField kind="select")`);
      }
    }

    // 1 y 4. campos declarativos
    for (const m of texto.matchAll(/\{\s*name:\s*(['"`])[^'"`]+\1,\s*label:/g)) {
      const linea = lineaDe(texto, m.index);
      if (exenta(linea)) continue;
      const objeto = bloqueDesde(texto, m.index, '{', '}');
      if (EXCEPCION.test(objeto)) continue;
      const tooltip = textoDe(objeto, 'tooltip');
      if (tooltip === null && !/\btooltip:/.test(objeto)) {
        hallazgos.push(`${rel}:${linea}  campo «${textoDe(objeto, 'name')}» sin tooltip: di qué poner y por qué importa`);
        continue;
      }
      const motivo = malRedactado(tooltip, textoDe(objeto, 'label'));
      if (motivo) hallazgos.push(`${rel}:${linea}  el tooltip de «${textoDe(objeto, 'name')}» ${motivo}`);
    }

    // 2 y 4. átomos en JSX
    if (!/^components\/(atlas|screens\/ActionFieldControl)/.test(rel)) {
      for (const m of texto.matchAll(ATOMOS)) {
        const linea = lineaDe(texto, m.index);
        if (exenta(linea)) continue;
        const etiqueta = etiquetaDesde(texto, m.index);
        if (EXCEPCION.test(etiqueta)) continue;
        if (!/\btooltip=/.test(etiqueta)) {
          hallazgos.push(`${rel}:${linea}  <${m[1]}> «${textoDe(etiqueta, 'label') ?? textoDe(etiqueta, 'name') ?? '?'}» sin tooltip`);
          continue;
        }
        const motivo = malRedactado(textoDe(etiqueta, 'tooltip'), textoDe(etiqueta, 'label'));
        if (motivo) hallazgos.push(`${rel}:${linea}  el tooltip de <${m[1]}> «${textoDe(etiqueta, 'label') ?? '?'}» ${motivo}`);
      }
    }

    // 3 y 4. opciones de catálogo
    if (/^lib\/catalogs\.ts$/.test(rel)) {
      // Una lista entera de nombres propios se exime con el comentario encima de su `export const`.
      const exentas = [];
      for (const m of texto.matchAll(/\/\/\s*sin-ayuda:[^\n]*\nexport const \w+[^\n]*\[/g)) {
        const cierre = texto.indexOf('\n];', m.index);
        exentas.push([m.index, cierre === -1 ? texto.length : cierre]);
      }
      const enListaExenta = (indice) => exentas.some(([a, b]) => indice >= a && indice <= b);
      for (const m of texto.matchAll(/\{\s*label:\s*(['"`])((?:\\.|(?!\1).)*)\1,\s*value:/g)) {
        const linea = lineaDe(texto, m.index);
        if (exenta(linea) || enListaExenta(m.index)) continue;
        const objeto = bloqueDesde(texto, m.index, '{', '}');
        const descripcion = textoDe(objeto, 'description');
        if (descripcion === null) { hallazgos.push(`${rel}:${linea}  opción «${m[2]}» sin description`); continue; }
        const motivo = malRedactado(descripcion, m[2]);
        if (motivo) hallazgos.push(`${rel}:${linea}  la description de «${m[2]}» ${motivo}`);
      }
    }
  }
}

if (hallazgos.length) {
  const aviso = process.env.AYUDA_AVISO === '1';
  console[aviso ? 'warn' : 'error'](`check-ayuda: ${hallazgos.length} campo(s) u opción(es) sin explicar${aviso ? ' (modo aviso)' : ''}:\n`);
  for (const hallazgo of hallazgos) console[aviso ? 'warn' : 'error'](`  ${hallazgo}`);
  console[aviso ? 'warn' : 'error']('\nVer la cabecera de scripts/check-ayuda.mjs para el arreglo o la excepción `// sin-ayuda: <motivo>`.');
  if (!aviso) process.exit(1);
} else {
  console.log('check-ayuda: todos los campos dicen qué poner y todas las opciones qué significan.');
}
