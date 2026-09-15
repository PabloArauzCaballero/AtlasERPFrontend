#!/usr/bin/env node
/**
 * Guardián: una pestaña es un sustantivo, un botón es un verbo.
 *
 * El 2026-09-15 el ERP tenía «Propuestas | Nueva propuesta | Rechazar» en la misma barra: acciones
 * metidas entre secciones, en unas pantallas sí y en otras no. Se corrigieron seis vistas; esto
 * impide que vuelva. Falla si:
 *   1. una pestaña de `TabbedPanels` se llama con un verbo de acción o un número de paso;
 *   2. aparece `createOnClick` o un `onClick: () => setTab(...)`: la única razón de existir de esos
 *      atajos era saltar a una pestaña de alta.
 *
 * Qué hacer en su lugar: crear en modal (`create.fields`) o en su página (`create.href`); operar
 * sobre un registro desde su fila (`extraActions[].form` / `rowActions[].form`); un proceso sin fila
 * en `toolbarActions`; y lo de la pantalla entera en `WorkspaceHeader actions`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = process.cwd();
const CARPETAS = (process.env.PESTANAS_DIRS ?? 'app,components').split(',');
const VERBO = /^(nuev[oa]s?|crear|registrar|rechazar|aprobar|cerrar|reabrir|reapertura|emitir|subir|enviar|añadir|agregar|editar|eliminar|borrar|activar|desactivar|programar|confirmar|postear|contabilizar|importar|cargar|generar|encolar|suprimir|abrir|pedir|solicitar)\b|^\d+\s*·/i;
const PESTANA = /\bid:\s*'([^']+)',\s*label:\s*'([^']+)'/g;
const SALTO = /\bcreateOnClick\b|onClick:\s*\(\)\s*=>\s*setTab\(/g;

function archivos(dir) {
  let salida = [];
  let entradas;
  try { entradas = readdirSync(dir); } catch { return salida; }
  for (const nombre of entradas) {
    if (nombre === 'node_modules' || nombre.startsWith('.')) continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida = salida.concat(archivos(ruta));
    else if (ruta.endsWith('.tsx')) salida.push(ruta);
  }
  return salida;
}

const linea = (texto, indice) => texto.slice(0, indice).split('\n').length;
const fallos = [];

for (const ruta of CARPETAS.flatMap((carpeta) => archivos(join(RAIZ, carpeta)))) {
  const texto = readFileSync(ruta, 'utf8');
  const rel = relative(RAIZ, ruta);
  if (texto.includes('<TabbedPanels')) {
    for (const m of texto.matchAll(PESTANA)) {
      if (VERBO.test(m[2])) fallos.push(`${rel}:${linea(texto, m.index)} pestaña «${m[2]}» es una acción: va como botón (cabecera, fila o barra de la tabla), no como sección.`);
    }
  }
  for (const m of texto.matchAll(SALTO)) {
    fallos.push(`${rel}:${linea(texto, m.index)} «${m[0]}» salta a una pestaña de alta: usa create.href (página propia) o create.fields (modal).`);
  }
}

if (fallos.length) {
  console.error(`check-pestanas-accion: ${fallos.length} problema(s)\n  ${fallos.join('\n  ')}`);
  process.exit(1);
}
console.log('check-pestanas-accion: ninguna pestaña es una acción.');
