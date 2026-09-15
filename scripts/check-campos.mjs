#!/usr/bin/env node
/**
 * Guardián: el ERP no pide lo que genera el backend, ni deja escribir a mano un dominio cerrado.
 *
 * El 2026-09-15 se corrigieron 87 campos de dos clases:
 *   A. pedían al usuario un correlativo que asigna el sistema (placeholder «CP-2026-001») o un UUID
 *      de otro registro («UUID de la cuenta GL»);
 *   B. pintaban como texto libre un campo que el backend sólo acepta dentro de un enum («Moneda»,
 *      «Método», «Superficie»…), así que el alta fallaba hasta adivinar la palabra exacta.
 * Esto impide que vuelvan. Falla si en `app/` o `components/`:
 *   1. un placeholder parece un correlativo (`ABC-2026-001`) o un UUID;
 *   2. un hint o placeholder pide pegar/escribir un UUID o un identificador;
 *   3. un campo declarativo (`{ name: '…', label: '…' }`) cuyo nombre es de dominio cerrado
 *      (moneda, país, estado, tipo, método, régimen…) no tiene `optionsSource`, `options`,
 *      `optionsLoader`, `optionsLoaderFor` ni un `type` distinto de texto.
 *
 * Qué hacer en su lugar: `optionsSource: 'domain:<nombre>'` (lo publica GET /catalog/domains) o
 * `catalog:currency|country|city|timezone`; `assignedByBackend: true` para un correlativo;
 * `dependsOn` + `optionsLoaderFor` para elegir un registro. Una excepción legítima lleva el
 * comentario `// campo-libre: <motivo>` en la misma línea.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = process.cwd();
const CARPETAS = (process.env.CAMPOS_DIRS ?? 'app,components').split(',');

const CORRELATIVO = /placeholder[=:]\s*["'`{]*\s*["'`]?[A-Z]{2,8}-(?:[A-Z]+-)?\d{3,4}-\d{1,6}["'`]/;
const UUID_EN_PLACEHOLDER = /placeholder[=:]\s*["'`{]*\s*["'`]?[0-9a-f]{8}-[0-9a-f]{4}-/i;
const PIDE_UUID = /(hint|placeholder)[=:]\s*["'`][^"'`\n]{0,40}(\bUUID(\s+de\b|\*{0,2}\.)|pega su identificador|pegar el identificador)/i;
/** Frases que NOMBRAN el UUID para decir que no hace falta: no son un campo que lo pida. */
const NIEGA_UUID = /sin pegar|lo resuelve el backend|no hace falta/i;

/** Nombres que SIEMPRE son un dominio cerrado en este ERP. */
const NOMBRE_DE_DOMINIO =
  /^(currency|currencyCode|country|countryCode|status|kybStatus|riskStatus|reviewStatus|approvalStatus|siatStatus|paymentMethod|billingCycle|settlementPolicy|taxRegime|surface|category|businessCategory|productCategory|roleTitle|decisionRole|roleCode|relation|subClassification|sourceSystem|sourceType|documentType|accountType|partnerType|contractType|opportunityType|termType|billingTiming|tier|riskTier|severity|ruleType|billingModel|buyingModel|billingMode|objective|creativeType|segmentType|operator|closeType|taxType|accountingBasis|normalBalance|statementType|classification|itemType|eventType|bankInstitutionCode)$/;

const TIPOS_CON_VALORES = /type:\s*'(select|multiselect|date|datetime|number|countryCity|address)'/;
const CON_FUENTE = /\b(optionsSource|options|optionsLoader|optionsLoaderFor|assignedByBackend)\s*:/;
const EXCEPCION = /\/\/\s*campo-libre:/;

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

/** El objeto literal `{ name: 'x', … }` que empieza en `inicio`, hasta su llave de cierre. */
function objetoDesde(texto, inicio) {
  let profundidad = 0;
  for (let i = inicio; i < texto.length; i += 1) {
    const c = texto[i];
    if (c === '{') profundidad += 1;
    else if (c === '}') {
      profundidad -= 1;
      if (profundidad === 0) return texto.slice(inicio, i + 1);
    }
  }
  return texto.slice(inicio);
}

const hallazgos = [];
for (const carpeta of CARPETAS) {
  let lista = [];
  try {
    lista = archivos(join(RAIZ, carpeta));
  } catch {
    continue;
  }
  for (const archivo of lista) {
    const texto = readFileSync(archivo, 'utf8');
    const lineas = texto.split('\n');
    lineas.forEach((linea, indice) => {
      if (EXCEPCION.test(linea)) return;
      const donde = `${relative(RAIZ, archivo)}:${indice + 1}`;
      if (CORRELATIVO.test(linea)) hallazgos.push(`${donde}  placeholder de correlativo: lo asigna el backend (assignedByBackend)`);
      if (UUID_EN_PLACEHOLDER.test(linea)) hallazgos.push(`${donde}  placeholder de UUID: elige el registro en un select`);
      if (PIDE_UUID.test(linea) && !NIEGA_UUID.test(linea)) hallazgos.push(`${donde}  pide teclear un identificador: elige el registro en un select`);
    });

    for (const match of texto.matchAll(/\{\s*name:\s*'([A-Za-z0-9_.]+)',\s*label:/g)) {
      const nombre = match[1].split('.').pop();
      if (!NOMBRE_DE_DOMINIO.test(nombre)) continue;
      const objeto = objetoDesde(texto, match.index);
      if (CON_FUENTE.test(objeto) || TIPOS_CON_VALORES.test(objeto) || EXCEPCION.test(objeto)) continue;
      const linea = texto.slice(0, match.index).split('\n').length;
      if (EXCEPCION.test(lineas[linea - 1] ?? '')) continue;
      hallazgos.push(`${relative(RAIZ, archivo)}:${linea}  «${match[1]}» es un dominio cerrado y se pide como texto: optionsSource`);
    }
  }
}

if (hallazgos.length) {
  console.error(`check-campos: ${hallazgos.length} campo(s) piden a mano lo que es un código o un dominio cerrado:\n`);
  for (const hallazgo of hallazgos) console.error(`  ${hallazgo}`);
  console.error('\nVer la cabecera de scripts/check-campos.mjs para el arreglo o la excepción `// campo-libre: <motivo>`.');
  process.exit(1);
}
console.log('check-campos: ningún formulario pide códigos del sistema ni escribe dominios a mano.');
