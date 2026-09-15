import type { ActionField, FormSectionDefinition } from '@/components/screens/StructuredActionForm';
import { resolveOptions } from '@/services/domains';

/**
 * De la definición de un formulario de pantalla al formulario EN PAPEL.
 *
 * La regla de la casa: un formulario se declara UNA vez y sale por tres puertas —pantalla, papel y
 * transcripción—. Este módulo es la segunda puerta: toma el mismo `ActionField[]` que pintan
 * `StructuredActionForm`, `InlineActionForm` y el modal de `CrudDirectory`, y lo convierte en lo
 * que el worker de PDF sabe dibujar (`blank-form`): casillas, fechas, opciones para marcar,
 * renglones. Nada se describe dos veces, así que el papel no puede desincronizarse de la pantalla.
 *
 * Las opciones de los `select` se resuelven AL PULSAR (misma regla que `BotonPdf`): un catálogo
 * corto se imprime como casillas; uno largo, como anexo «código — nombre» al final del PDF.
 */

export type CampoPapelKind =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'chips'
  | 'countryCity'
  | 'address'
  | 'boolean'
  | 'file'
  | 'email'
  | 'url'
  | 'phone';

export interface CampoPapel {
  label: string;
  kind: CampoPapelKind;
  required?: boolean;
  hint?: string;
  options?: Array<{ code?: string; label: string }>;
  catalogRef?: string;
  width?: 1 | 2 | 3;
  lines?: number;
  prefilled?: string | number | boolean | null;
}

export interface TablaPapel {
  columns: Array<{ label: string; width?: 1 | 2 | 3; numeric?: boolean }>;
  rows: number;
  totalRow?: boolean;
}

export interface SeccionPapel {
  title: string;
  description?: string;
  pageBreakBefore?: boolean;
  fields?: CampoPapel[];
  table?: TablaPapel;
}

export interface AnexoPapel {
  title: string;
  entries: Array<{ code: string; label: string }>;
}

export interface FormularioPapel {
  formCode: string;
  formVersion: string;
  title: string;
  subtitle?: string;
  instructions?: string[];
  context?: Array<{ label: string; value: string | number | boolean | null }>;
  sections: SeccionPapel[];
  annexes?: AnexoPapel[];
  declarations?: string[];
  signatures?: Array<{ name: string; role?: string }>;
}

/** Más opciones que esto no caben como casillas en una fila: van al anexo. */
export const MAX_OPCIONES_EN_CASILLAS = 12;
/** Tope del contrato del worker por anexo. */
const MAX_ENTRADAS_ANEXO = 400;

const INSTRUCCIONES_POR_DEFECTO = [
  'Rellene los campos marcados con asterisco, en mayúsculas y con letra clara.',
  'Donde haya casillas, marque una sola opción salvo que se indique lo contrario.',
  'Cuando un campo pida un código, cópielo del anexo que va al final de este formulario.',
  'Entregue el formulario a la persona de ATLAS que lo transcribirá al sistema; el número de serie del pie identifica este papel.',
];

/** Huella corta y estable de la estructura: cambia si cambian los campos, no si cambia una frase. */
export function versionDeFormulario(sections: FormSectionDefinition[]): string {
  const estructura = JSON.stringify(
    sections.map((section) => [
      section.title,
      section.fields.map((field) => [field.name, field.type ?? 'text', Boolean(field.required), field.options?.length ?? 0]),
    ]),
  );
  // FNV-1a de 32 bits: determinista, sin dependencias y suficiente para distinguir versiones.
  let hash = 0x811c9dc5;
  for (let i = 0; i < estructura.length; i += 1) {
    hash ^= estructura.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Código imprimible y estable a partir de la ruta de la pantalla y la acción. */
export function codigoDeFormulario(ruta: string, accion: string): string {
  const limpio = (texto: string) =>
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const partes = ruta.split('/').filter((parte) => parte && parte !== 'operaciones' && parte !== 'portal-comercio');
  const lado = ruta.includes('portal-comercio') ? 'PORTAL' : 'ERP';
  return [lado, ...partes.map(limpio), limpio(accion)].filter(Boolean).join('-').slice(0, 64);
}

function kindDe(field: ActionField): CampoPapelKind {
  switch (field.type) {
    case 'email':
    case 'number':
    case 'date':
    case 'datetime':
    case 'url':
    case 'textarea':
    case 'select':
    case 'chips':
    case 'countryCity':
    case 'address':
      return field.type;
    default:
      return 'text';
  }
}

/** Un `select` de Sí/No se imprime como dos casillas, no como un anexo. */
function esBooleano(options: Array<{ label: string; value: string }>): boolean {
  if (options.length !== 2) return false;
  const valores = options.map((option) => option.value.toLowerCase()).sort();
  return valores.join(',') === 'false,true' || valores.join(',') === 'no,si' || valores.join(',') === 'no,sí';
}

async function opcionesDe(field: ActionField): Promise<Array<{ label: string; value: string }> | undefined> {
  if (field.options) return field.options;
  if (!field.optionsLoader && !field.optionsSource) return undefined;
  try {
    // Un dominio del backend (`domain:…`) o una lista ISO (`catalog:…`) sale como anexo de códigos.
    if (field.optionsSource) return await resolveOptions(field.optionsSource);
    return await field.optionsLoader!();
  } catch {
    // Sin catálogo (sin red, sin permiso): el papel pide el código y quien transcribe lo resuelve.
    // Un anexo vacío que pareciera completo sería peor que ninguno.
    return undefined;
  }
}

interface ContextoConversion {
  anexos: AnexoPapel[];
}

async function campoAPapel(field: ActionField, contexto: ContextoConversion): Promise<CampoPapel> {
  // Con fuente de opciones y sin `type`, el campo es un select (así lo pinta la pantalla); la selección
  // múltiple se imprime igual: casillas o anexo, marcando las que correspondan.
  const kind =
    field.type === 'multiselect' || (!field.type && (field.optionsSource || field.optionsLoader || field.options))
      ? 'select'
      : kindDe(field);
  const campo: CampoPapel = {
    label: field.label,
    kind,
    ...(field.required ? { required: true } : {}),
    ...(field.hint ? { hint: field.hint } : field.placeholder ? { hint: field.placeholder } : {}),
    ...(field.span ? { width: field.span } : {}),
  };
  if (kind === 'textarea') campo.lines = 4;
  if (kind === 'chips') campo.lines = 3;
  if (kind === 'address') campo.lines = 2;

  if (kind === 'select') {
    const opciones = await opcionesDe(field);
    if (!opciones || opciones.length === 0) {
      campo.hint = [campo.hint, 'Escriba el código o el nombre exacto.'].filter(Boolean).join(' · ');
    } else if (esBooleano(opciones)) {
      campo.kind = 'boolean';
    } else if (opciones.length <= MAX_OPCIONES_EN_CASILLAS) {
      // Los valores cortos y legibles (códigos de catálogo) se imprimen entre corchetes; un UUID no
      // ayuda a nadie en papel, así que no se imprime.
      campo.options = opciones.map((option) => ({
        label: option.label,
        ...(esCodigoLegible(option.value) ? { code: option.value } : {}),
      }));
    } else {
      const titulo = field.label;
      if (!contexto.anexos.some((anexo) => anexo.title === titulo)) {
        contexto.anexos.push({
          title: titulo,
          entries: opciones.slice(0, MAX_ENTRADAS_ANEXO).map((option, indice) => ({
            code: esCodigoLegible(option.value) ? option.value : String(indice + 1).padStart(3, '0'),
            label: option.label.slice(0, 160),
          })),
        });
      }
      campo.catalogRef = titulo;
    }
  }
  return campo;
}

function esCodigoLegible(valor: string): boolean {
  return /^[A-Za-z0-9_.:-]{1,24}$/.test(valor) && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(valor);
}

export interface OpcionesFormularioPapel {
  formCode: string;
  title: string;
  subtitle?: string;
  instructions?: string[];
  context?: FormularioPapel['context'];
  /** Tablas de líneas dinámicas (asiento, recibo, propuesta), una sección cada una. */
  tablas?: Array<{ title: string; description?: string; table: TablaPapel }>;
  declarations?: string[];
  signatures?: FormularioPapel['signatures'];
}

/**
 * Convierte las secciones de un formulario declarativo en el payload del formulario en papel.
 * Resuelve los catálogos del backend al llamarse: por eso es asíncrona y por eso se llama al pulsar.
 */
export async function armarFormularioPapel(
  sections: FormSectionDefinition[],
  opciones: OpcionesFormularioPapel,
): Promise<FormularioPapel> {
  const contexto: ContextoConversion = { anexos: [] };
  const secciones: SeccionPapel[] = [];
  for (const section of sections) {
    const fields: CampoPapel[] = [];
    for (const field of section.fields) {
      // Lo que asigna el backend (un correlativo) no lo escribe nadie a mano: no va en el papel.
      if (field.assignedByBackend) continue;
      fields.push(await campoAPapel(field, contexto));
    }
    if (fields.length) {
      secciones.push({
        title: section.title,
        ...(section.description ? { description: section.description } : {}),
        fields,
      });
    }
  }
  for (const tabla of opciones.tablas ?? []) secciones.push(tabla);
  if (!secciones.length) secciones.push({ title: 'Sin campos', fields: [{ label: 'Observaciones', kind: 'textarea', width: 3 }] });

  return {
    formCode: opciones.formCode,
    formVersion: versionDeFormulario(sections),
    title: opciones.title,
    ...(opciones.subtitle ? { subtitle: opciones.subtitle } : {}),
    instructions: opciones.instructions ?? INSTRUCCIONES_POR_DEFECTO,
    ...(opciones.context?.length ? { context: opciones.context } : {}),
    sections: secciones.slice(0, 40),
    ...(contexto.anexos.length ? { annexes: contexto.anexos.slice(0, 12) } : {}),
    ...(opciones.declarations ? { declarations: opciones.declarations } : {}),
    signatures: opciones.signatures ?? [
      { name: 'Firma de quien rellena', role: 'Solicitante' },
      { name: 'Recibido por', role: 'Personal de ATLAS' },
    ],
  };
}

/** Atajo para un formulario de una sola sección (modales, inline). */
export function seccionUnica(title: string, fields: ActionField[]): FormSectionDefinition[] {
  return [{ title, fields }];
}
