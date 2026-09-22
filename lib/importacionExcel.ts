/**
 * La lógica de la carga masiva de un listado: de las celdas de una hoja al envío del alta.
 *
 * Vive en `lib/` y no dentro del modal porque es lo único de la importación que se puede equivocar
 * en silencio —agrupar mal las líneas de un asiento, aceptar un valor que no existe en el catálogo,
 * mandar una fecha corrida un día— y porque desde aquí se prueba sin montar React ni levantar la
 * aplicación, igual que `lib/excel.ts`. El modal se queda con lo que es pantalla.
 */
import type { ActionField } from '@/components/screens/StructuredActionForm';
import { fechaDeSerieExcel } from './excel';
import { formDataToPayload, payloadDefinitions } from './formPayload';

/**
 * Un registro que no cabe en una fila: un asiento con sus líneas, un recibo con sus asignaciones,
 * una propuesta con sus condiciones.
 *
 * En la hoja va UNA FILA POR LÍNEA. Las filas que comparten el valor de la columna `clave` son el
 * mismo registro: la cabecera se lee de la primera de ellas y las líneas de todas. Es el formato
 * con el que cualquier contador exporta un libro diario, y es el único que permite importar estos
 * tres tipos de registro sin inventar una sintaxis dentro de una celda.
 */
export interface LineasSpec {
  /** Cómo se llama el array en el envío: `lines`, `allocations`. */
  name: string;
  /** Columna que agrupa las filas. Mismo valor = mismo registro. */
  clave: string;
  /** Qué dice esa columna en la plantilla. */
  claveLabel: string;
  /** Cómo se llama una línea, en singular y minúsculas: «línea», «asignación». */
  nombreLinea: string;
  fields: ActionField[];
  /** Ejemplos de la plantilla: dos líneas del mismo registro, para que se vea que la clave se repite. */
  ejemploClave?: string | undefined;
}

export interface RegistroPreparado {
  /** Fila de la hoja donde empieza el registro; es lo que el usuario ve en Excel. */
  numero: number;
  /** Todas las filas de la hoja que lo componen (una sola, salvo registros con líneas). */
  filasHoja: number[];
  /** Cómo se le nombra en la tabla de la pantalla. */
  etiqueta: string;
  crudo: Record<string, string>;
  payload: Record<string, unknown>;
  errores: string[];
  estado: 'pendiente' | 'creada' | 'fallida';
  detalle?: string | undefined;
}

/** Los campos que se piden en la plantilla: lo que el sistema asigna solo no se importa. */
export function camposImportables(fields: ActionField[]): ActionField[] {
  const salida: ActionField[] = [];
  for (const field of fields) {
    // Un correlativo que pone el sistema no es una columna que nadie tenga que rellenar.
    if (field.assignedByBackend) continue;
    /*
     * `address` compone la dirección con el país y la ciudad de otros dos controles y abre un mapa
     * para confirmarla. Fuera del formulario no es una celda: se deja fuera de la plantilla y la
     * dirección se completa después desde la ficha.
     */
    if (field.type === 'address') continue;
    /*
     * `countryCity` es UN campo que pinta DOS controles —el país y, dentro de él, la ciudad— y
     * manda los dos nombres en el envío. En una hoja de cálculo eso son dos columnas: sin
     * desdoblarlo, la ciudad no tenía columna y el alta llegaba al backend sin ella.
     */
    if (field.type === 'countryCity') {
      salida.push({ ...field, type: 'text', label: `${field.label} · país` });
      if (field.cityFieldName) {
        salida.push({
          name: field.cityFieldName,
          label: `${field.label} · ciudad`,
          type: 'text',
          tooltip: field.tooltip ?? 'Ciudad dentro del país indicado en la columna anterior.',
          optional: true,
        });
      }
      continue;
    }
    salida.push(field);
  }
  return salida;
}

/** Un ejemplo por columna, para que la plantilla enseñe el formato en vez de describirlo. */
export function ejemploDe(field: ActionField): string {
  if (field.defaultValue !== undefined && field.defaultValue !== '') return String(field.defaultValue);
  /*
   * El ejemplo de un select es el NOMBRE de la primera opción, no su código: un UUID en la fila de
   * ejemplo enseña justo lo que no hay que copiar. La celda admite las dos formas.
   */
  if (field.options?.length) {
    const primera = field.options[0];
    return primera ? (primera.label || primera.value) : '';
  }
  if (field.type === 'date') return '2026-01-31';
  if (field.type === 'datetime') return '2026-01-31T14:30';
  if (field.type === 'number') return '0';
  if (field.type === 'multiselect' || field.type === 'chips') return 'VALOR1, VALOR2';
  return field.placeholder ?? '';
}

/** Sin tildes, sin mayúsculas y sin espacios de sobra: comparar «Cuenta Corriente» con «cuenta corriente». */
function plano(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

/** Un solo valor contra la lista del campo: por código, por nombre o por código con otra caja. */
function unaOpcion(valor: string, campo: ActionField): string | null {
  const opciones = campo.options ?? [];
  const exacto = opciones.find((opcion) => opcion.value === valor);
  if (exacto) return exacto.value;
  const porNombre = opciones.find((opcion) => plano(opcion.label) === plano(valor));
  if (porNombre) return porNombre.value;
  // Un código escrito en minúsculas o con otra caja sigue siendo ese código.
  const porCaja = opciones.find((opcion) => plano(opcion.value) === plano(valor));
  if (porCaja) return porCaja.value;
  /*
   * Las opciones del catálogo se leen «1101 — Caja» o «BP-004 — Distribuidora Sur»: el código va
   * delante. Nadie copia la etiqueta entera cuando lo que tiene en su hoja es el código, así que
   * también vale ese primer trozo.
   */
  const porCodigo = opciones.find((opcion) => plano(opcion.label.split('—')[0] ?? '') === plano(valor));
  return porCodigo ? porCodigo.value : null;
}

/**
 * Lo que una celda vale de verdad para un campo con lista de valores.
 *
 * Admite el código que espera el backend y también el NOMBRE de la opción, que es lo único que una
 * persona ve en el formulario. Escribir «Cuenta corriente BNB» en la celda y que la fila se rechace
 * porque el campo quería `1f0c…-a91b` convierte la carga masiva en un ejercicio de adivinar UUIDs.
 */
export function valorDeOpcion(valor: string, campo: ActionField): string | null {
  if (!campo.options?.length) return valor;
  /*
   * Una celda de un campo de varios valores trae la lista separada por comas. Se resuelve valor a
   * valor: si uno solo no existe, la fila se rechaza nombrándolo, no la lista entera.
   */
  if (campo.type === 'multiselect' || campo.type === 'chips' || campo.valueKind === 'codeList' || campo.valueKind === 'stringList') {
    const partes = valor.split(',').map((parte) => parte.trim()).filter(Boolean);
    const resueltas = partes.map((parte) => unaOpcion(parte, campo));
    return resueltas.some((parte) => parte === null) ? null : resueltas.join(', ');
  }
  return unaOpcion(valor, campo);
}

/** Lo que Excel entrega distinto de lo que el formulario entregaría. */
export function normalizar(valor: string, campo: ActionField): string {
  // Un select acepta su código o el nombre que se lee en pantalla; al backend va siempre el código.
  if (campo.options?.length) return valorDeOpcion(valor, campo) ?? valor;
  // Una celda con formato de fecha llega como número de serie («46020»), no como texto.
  if ((campo.type === 'date' || campo.type === 'datetime') && /^\d{5}(\.\d+)?$/.test(valor)) {
    return fechaDeSerieExcel(Number(valor));
  }
  // Excel escribe los decimales con coma en configuración regional española; el backend pide punto.
  if ((campo.type === 'number' || campo.valueKind === 'number') && /^-?\d+,\d+$/.test(valor)) {
    return valor.replace(',', '.');
  }
  return valor;
}

/**
 * Los valores de una fila convertidos al mismo payload que produce el formulario.
 *
 * Reutiliza `formDataToPayload` con las definiciones del alta en vez de construir el objeto a
 * mano: así los números llegan como números, las listas separadas por coma como arrays, los
 * nombres con punto (`primaryContact.email`) como objetos anidados, y nada de eso se puede
 * desincronizar con lo que hace el formulario, porque es la misma función.
 */
export function payloadDeFila(crudo: Record<string, string>, campos: ActionField[]): Record<string, unknown> {
  const datos = new FormData();
  for (const campo of campos) {
    const valor = (crudo[campo.name] ?? '').trim();
    if (valor === '') continue;
    datos.set(campo.name, normalizar(valor, campo));
  }
  return formDataToPayload(datos, payloadDefinitions(campos)) as Record<string, unknown>;
}

/**
 * Lo que falta o no encaja en una fila, dicho con el nombre del campo y no con el de la columna.
 *
 * Un valor fuera del dominio se caza aquí y no en el backend: el error «status must be one of…»
 * llega sin número de fila, y con cien filas eso no dice cuál corregir. Sólo se comprueban los
 * campos con lista fija en el código; los que la piden al catálogo se validan en el servidor.
 */
export function erroresDeFila(
  crudo: Record<string, string>,
  campos: ActionField[],
  obligatorios: ActionField[],
  prefijo = '',
): string[] {
  const errores = obligatorios
    .filter((campo) => !(crudo[campo.name] ?? '').trim())
    .map((campo) => `${prefijo}Falta «${campo.label}»`);

  for (const campo of campos) {
    const valor = (crudo[campo.name] ?? '').trim();
    if (!valor || !campo.options?.length) continue;
    if (valorDeOpcion(valor, campo) === null) {
      const ejemplos = campo.options.slice(0, 3).map((opcion) => opcion.label).join(', ');
      errores.push(`${prefijo}«${campo.label}» no admite «${valor}» (p. ej.: ${ejemplos})`);
    }
  }
  return errores;
}

/** Un registro por fila: el caso normal. */
export function prepararPlana(
  crudo: Record<string, string>,
  numero: number,
  campos: ActionField[],
  obligatorios: ActionField[],
): RegistroPreparado {
  return {
    numero,
    filasHoja: [numero],
    etiqueta: String(numero),
    crudo,
    payload: payloadDeFila(crudo, campos),
    errores: erroresDeFila(crudo, campos, obligatorios),
    estado: 'pendiente',
  };
}

/**
 * Un registro por GRUPO de filas: las que repiten el valor de la columna clave.
 *
 * La cabecera se lee de la primera fila del grupo y las líneas de todas, incluida esa primera. Las
 * filas siguientes pueden dejar las columnas de cabecera en blanco —es como se escribe un libro
 * diario— y si las repiten, se ignoran: manda la primera, porque si no habría que decidir qué hacer
 * cuando dos filas del mismo asiento traen fechas distintas, y cualquier respuesta a eso sorprende.
 */
export function agrupar(
  filas: Array<Record<string, string>>,
  lineas: LineasSpec,
  campos: ActionField[],
  obligatorios: ActionField[],
  camposLinea: ActionField[],
  obligatoriosLinea: ActionField[],
): RegistroPreparado[] {
  const grupos = new Map<string, Array<{ numero: number; crudo: Record<string, string> }>>();
  const sinClave: RegistroPreparado[] = [];

  filas.forEach((crudo, indice) => {
    const numero = indice + 2;
    const clave = (crudo[lineas.clave] ?? '').trim();
    if (!clave) {
      sinClave.push({
        numero,
        filasHoja: [numero],
        etiqueta: '—',
        crudo,
        payload: {},
        errores: [`Falta «${lineas.claveLabel}»: sin ella no se sabe a qué registro pertenece la fila`],
        estado: 'pendiente',
      });
      return;
    }
    const actual = grupos.get(clave) ?? [];
    actual.push({ numero, crudo });
    grupos.set(clave, actual);
  });

  const registros = [...grupos.entries()].map(([clave, miembros]) => {
    const primera = miembros[0]!;
    const errores = erroresDeFila(primera.crudo, campos, obligatorios);
    const cuerpo = miembros.map((miembro) => {
      const fallos = erroresDeFila(miembro.crudo, camposLinea, obligatoriosLinea, `Fila ${miembro.numero}: `);
      errores.push(...fallos);
      return payloadDeFila(miembro.crudo, camposLinea);
    });

    return {
      numero: primera.numero,
      filasHoja: miembros.map((miembro) => miembro.numero),
      etiqueta: clave,
      crudo: primera.crudo,
      payload: { ...payloadDeFila(primera.crudo, campos), [lineas.name]: cuerpo },
      errores,
      estado: 'pendiente' as const,
    };
  });

  return [...registros, ...sinClave].sort((a, b) => a.numero - b.numero);
}
