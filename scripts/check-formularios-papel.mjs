#!/usr/bin/env node
/**
 * Guardián: todo formulario del ERP sale también en papel.
 *
 * Regla de la casa (2026-09-15): un formulario se declara UNA vez y sale por tres puertas
 * —pantalla, PDF para rellenar a mano y transcripción—. Los declarativos (`ActionField[]`) la
 * cumplen solos, porque el botón «Formulario en papel» vive en los componentes compartidos. Los
 * hechos a mano (`<FormField>` sueltos) sólo la cumplen si alguien escribió su definición en
 * `lib/formulariosPapel/*` y puso el botón. Esto falla cuando una pantalla con `<FormField>`:
 *   1. no importa nada de `@/lib/formulariosPapel/` ni pinta `<BotonFormularioPapel`, y
 *   2. no está en la lista de exentas, cada una con su motivo escrito.
 *
 * Qué hacer: añadir la definición (mismo orden y etiquetas que la pantalla) en
 * `lib/formulariosPapel/portal.ts` u `operaciones.ts`, y el botón en `WorkspaceHeader actions` o
 * en el `action` del `Panel`. O, si de verdad no tiene sentido en papel, exentarla AQUÍ con el
 * porqué: una exención sin motivo es una pantalla olvidada.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = process.cwd();
const CARPETAS = (process.env.PAPEL_DIRS ?? 'app,components').split(',');

/** Pantallas con `<FormField>` que NO son un formulario de captura, y por qué. */
const EXENTAS = new Map([
  ['app/login/page.tsx', 'credenciales: no se transcriben'],
  ['components/screens/PasswordChangePanel.tsx', 'credenciales: no se transcriben'],
  ['components/screens/CommandCenterScreen.tsx', 'buscador de navegación, no envía datos'],
  ['components/screens/AccountDetailScreen.tsx', 'sólo el selector de cuenta; la actividad y los contactos tienen su propio formulario'],
  ['components/screens/MerchantBillingScreen.tsx', 'selectores de alcance (negocio, expediente): filtran, no capturan'],
  ['components/screens/MerchantCampaignsScreen.tsx', 'filtros de negocio y anunciante: no capturan'],
  ['components/screens/MerchantPlansScreen.tsx', 'selector de negocio: no captura'],
  ['components/screens/MerchantPaymentProofsScreen.tsx', 'motivo de rechazo sobre un comprobante que sólo existe en pantalla'],
  ['components/screens/MerchantRequestsScreen.tsx', 'motivo de rechazo sobre una solicitud que sólo existe en pantalla'],
  ['components/screens/PartnerRequirementsPanel.tsx', 'sus campos van en el formulario del expediente (PartnerDossierScreen)'],
  ['components/atlas/TranscripcionBar.tsx', 'es el control del modo transcripción: pide la serie del papel, no captura datos'],
  ['components/campaigns/', 'Campaña de notificación masiva: se diseña y programa en pantalla con audiencia calculada en vivo; no existe formulario físico que transcribir.'],
  // Controles compartidos: pintan campos, no son un formulario.
  ['components/screens/ActionFieldControl.tsx', 'control compartido'],
  ['components/screens/CrudDirectory.tsx', 'componente compartido; el botón lo pone ActionFormModal'],
  ['components/ui/CrudTable.tsx', 'componente compartido de tabla'],
]);

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

const fallos = [];
const exentasUsadas = new Set();
let revisadas = 0;
for (const carpeta of CARPETAS) {
  for (const ruta of archivos(join(RAIZ, carpeta))) {
    const texto = readFileSync(ruta, 'utf8');
    if (!/<FormField\b/.test(texto)) continue;
    revisadas += 1;
    const rel = relative(RAIZ, ruta);
    // Una exención que termina en «/» cubre la carpeta entera (trabajo en curso de otra sesión).
    const exencion = EXENTAS.has(rel) ? rel : [...EXENTAS.keys()].find((clave) => clave.endsWith('/') && rel.startsWith(clave));
    if (exencion) { exentasUsadas.add(exencion); continue; }
    const tienePapel = /@\/lib\/formulariosPapel\//.test(texto) || /<BotonFormularioPapel\b/.test(texto);
    if (!tienePapel) fallos.push(`${rel}: tiene <FormField> y ningún formulario en papel (ni importa @/lib/formulariosPapel/ ni pinta <BotonFormularioPapel>).`);
  }
}
for (const rel of EXENTAS.keys()) {
  if (exentasUsadas.has(rel)) continue;
  // Un archivo que no existe (todavía, o ya) no puede tener un formulario: la exención sobra pero
  // no miente. La que sí miente es la de un archivo que existe y ya no tiene <FormField>.
  if (rel.endsWith('/')) continue;
  try { statSync(join(RAIZ, rel)); } catch { continue; }
  fallos.push(`${rel}: figura como exenta pero ya no tiene <FormField>; quita la exención.`);
}

if (fallos.length) {
  console.error(`check-formularios-papel: ${fallos.length} fallo(s).\n` + fallos.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.log(`check-formularios-papel: ${revisadas} pantallas con <FormField>, todas con formulario en papel o exentas con motivo.`);
