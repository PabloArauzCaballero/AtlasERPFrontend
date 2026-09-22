/**
 * Leer y escribir Excel (.xlsx) en el navegador, sin dependencias.
 *
 * Por qué a mano y no con una librería: un `.xlsx` es un ZIP con XML dentro, y el navegador ya
 * trae las dos piezas caras —`DecompressionStream` para el deflate y `DOMParser` para el XML—.
 * Las librerías de hoja de cálculo pesan cerca de un megabyte en el paquete que descarga el
 * usuario, y en este monorepo cada dependencia nueva pasa por la auditoría de CI, que ignora
 * `resolutions` y obliga a repetir cada arreglo en `overrides`. Para lo que hace falta aquí —una
 * tabla plana: primera fila cabeceras, el resto datos— eso no compensa.
 *
 * Alcance deliberado: una sola hoja (la primera), valores como texto, sin fórmulas ni formatos.
 * Lo que se importa son registros, no hojas de cálculo.
 */
import { parseCsv } from '@/lib/csv';

export interface TablaLeida {
  /** Cabeceras en el orden del archivo, ya recortadas. */
  cabeceras: string[];
  /** Una entrada por fila con datos, indexada por cabecera. */
  filas: Record<string, string>[];
}

/* ───────────────────────── Lectura ───────────────────────── */

/**
 * Lee la primera hoja de un `.xlsx`, o un `.csv`, y devuelve filas indexadas por cabecera.
 *
 * Acepta las dos porque son las dos que la gente tiene: el CSV lo exporta cualquier sistema y el
 * XLSX es lo que sale de Excel al guardar sin pensar. Distinguirlos por la extensión no basta
 * —Windows manda `.xlsx` con tipos MIME variados—, así que se mira la firma del archivo: un ZIP
 * empieza por `PK`.
 */
export async function leerTabla(file: File): Promise<TablaLeida> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const esZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (!esZip) return desdeCsv(new TextDecoder().decode(bytes));

  const entradas = await abrirZip(bytes);
  const hoja = entradas.get(await rutaDeLaPrimeraHoja(entradas));
  if (!hoja) throw new Error('El archivo no trae ninguna hoja legible.');
  const compartidas = leerCadenasCompartidas(entradas.get('xl/sharedStrings.xml'));
  return desdeHoja(new TextDecoder().decode(hoja), compartidas);
}

function desdeCsv(texto: string): TablaLeida {
  const filas = parseCsv(texto);
  const primera = filas[0];
  return { cabeceras: primera ? Object.keys(primera) : [], filas };
}

/** `A`→0, `B`→1, `AA`→26. La referencia de celda («B7») trae la columna en letras. */
function columnaDeReferencia(referencia: string): number {
  const letras = referencia.replace(/[0-9]/g, '');
  let indice = 0;
  for (const letra of letras) indice = indice * 26 + (letra.charCodeAt(0) - 64);
  return indice - 1;
}

function leerCadenasCompartidas(xml: Uint8Array | undefined): string[] {
  if (!xml) return [];
  const documento = new DOMParser().parseFromString(new TextDecoder().decode(xml), 'application/xml');
  /*
   * El texto de una cadena puede venir partido en varios `<t>` (`<si><r><t>Hola</t></r><r><t> y
   * adiós</t></r></si>`) cuando Excel guarda trozos con formatos distintos dentro de la misma
   * celda. Concatenarlos es lo que devuelve la frase que el usuario ve.
   */
  return [...documento.getElementsByTagName('si')].map((si) =>
    [...si.getElementsByTagName('t')].map((t) => t.textContent ?? '').join(''),
  );
}

async function rutaDeLaPrimeraHoja(entradas: Map<string, Uint8Array>): Promise<string> {
  /*
   * No se asume `xl/worksheets/sheet1.xml`: ese nombre es una convención de Excel, y un archivo
   * guardado por Google Sheets o por un ERP ajeno puede numerar distinto o llamar a la hoja de
   * otra forma. Se sigue la cadena que manda el formato —workbook → rels— y sólo si falla se cae
   * a la primera hoja que haya, que es mejor que negarse a abrir el archivo.
   */
  const workbook = entradas.get('xl/workbook.xml');
  const rels = entradas.get('xl/_rels/workbook.xml.rels');
  if (workbook && rels) {
    const libro = new DOMParser().parseFromString(new TextDecoder().decode(workbook), 'application/xml');
    const primera = libro.getElementsByTagName('sheet')[0];
    const id = primera?.getAttribute('r:id') ?? primera?.getAttribute('id');
    if (id) {
      const relaciones = new DOMParser().parseFromString(new TextDecoder().decode(rels), 'application/xml');
      const destino = [...relaciones.getElementsByTagName('Relationship')]
        .find((relacion) => relacion.getAttribute('Id') === id)
        ?.getAttribute('Target');
      if (destino) {
        const ruta = destino.startsWith('/') ? destino.slice(1) : `xl/${destino.replace(/^\.\//, '')}`;
        if (entradas.has(ruta)) return ruta;
      }
    }
  }
  const alguna = [...entradas.keys()].find((nombre) => nombre.startsWith('xl/worksheets/') && nombre.endsWith('.xml'));
  return alguna ?? 'xl/worksheets/sheet1.xml';
}

function desdeHoja(xml: string, compartidas: string[]): TablaLeida {
  const documento = new DOMParser().parseFromString(xml, 'application/xml');
  const filasXml = [...documento.getElementsByTagName('row')];
  const matriz = filasXml.map((fila) => {
    const celdas: string[] = [];
    for (const celda of [...fila.getElementsByTagName('c')]) {
      const referencia = celda.getAttribute('r') ?? '';
      const columna = referencia ? columnaDeReferencia(referencia) : celdas.length;
      celdas[columna] = valorDeCelda(celda, compartidas);
    }
    return celdas;
  });

  /*
   * La primera fila con algo escrito manda: un archivo real suele traer filas vacías arriba
   * (bordes, un título suelto) y tomar la fila 1 a ciegas daría cabeceras en blanco y ni una fila
   * de datos, que es el fallo que se lee como «el Excel está mal» cuando lo que está mal es el
   * lector.
   */
  const inicio = matriz.findIndex((fila) => fila.some((celda) => (celda ?? '').trim() !== ''));
  if (inicio === -1) return { cabeceras: [], filas: [] };
  const cabeceras = (matriz[inicio] ?? []).map((celda) => (celda ?? '').trim());

  const filas = matriz
    .slice(inicio + 1)
    .filter((fila) => fila.some((celda) => (celda ?? '').trim() !== ''))
    .map((fila) =>
      cabeceras.reduce<Record<string, string>>((registro, cabecera, indice) => {
        if (cabecera) registro[cabecera] = (fila[indice] ?? '').trim();
        return registro;
      }, {}),
    );
  return { cabeceras: cabeceras.filter(Boolean), filas };
}

function valorDeCelda(celda: Element, compartidas: string[]): string {
  const tipo = celda.getAttribute('t');
  if (tipo === 's') {
    const indice = Number(celda.getElementsByTagName('v')[0]?.textContent ?? '');
    return compartidas[indice] ?? '';
  }
  if (tipo === 'inlineStr') {
    return [...celda.getElementsByTagName('t')].map((t) => t.textContent ?? '').join('');
  }
  return celda.getElementsByTagName('v')[0]?.textContent ?? '';
}

/**
 * Convierte el número de serie de una fecha de Excel a `AAAA-MM-DD`.
 *
 * Una celda con formato de fecha NO llega como texto: llega como «46020», los días transcurridos
 * desde el 1900. Sin esta conversión, un Excel con la columna de fechas bien puesta se importa con
 * un número donde va la fecha y el backend lo rechaza sin que nadie entienda por qué.
 *
 * El 1900 lleva dentro un error histórico: Excel cree que ese año fue bisiesto. Por eso la base es
 * el 30/12/1899 y no el 31/12, que es lo que hace cuadrar todas las fechas posteriores a marzo de
 * 1900 —es decir, todas las que alguien va a escribir de verdad—.
 */
export function fechaDeSerieExcel(serie: number): string {
  const dias = Math.round(serie);
  /*
   * El 29 de febrero de 1900 no existió, pero para Excel sí: es la serie 60. Por eso a partir de
   * marzo de 1900 todo va corrido un día y la base que cuadra es el 30/12/1899, mientras que en
   * enero y febrero de 1900 —series 1 a 59— la buena sigue siendo el 31/12. Nadie va a teclear una
   * fecha de 1900 en un alta, pero devolver un día de menos sin avisar es peor que la línea que
   * cuesta evitarlo.
   */
  const base = dias < 60 ? Date.UTC(1899, 11, 31) : Date.UTC(1899, 11, 30);
  return new Date(base + dias * 86_400_000).toISOString().slice(0, 10);
}

/* ───────────────────────── Escritura (la plantilla) ───────────────────────── */

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
const escaparXml = (texto: string) => texto.replace(/[&<>"']/g, (caracter) => ESCAPES[caracter] ?? caracter);

/** `0`→`A`, `26`→`AA`: la referencia de celda que espera el XML de la hoja. */
function letraDeColumna(indice: number): string {
  let resto = indice + 1;
  let letras = '';
  while (resto > 0) {
    const modulo = (resto - 1) % 26;
    letras = String.fromCharCode(65 + modulo) + letras;
    resto = Math.floor((resto - modulo) / 26);
  }
  return letras;
}

function filaXml(valores: string[], numero: number): string {
  const celdas = valores
    .map((valor, columna) =>
      `<c r="${letraDeColumna(columna)}${numero}" t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`,
    )
    .join('');
  return `<row r="${numero}">${celdas}</row>`;
}

/**
 * Descarga una plantilla `.xlsx` con las cabeceras y, si se pasa, una fila de ejemplo.
 *
 * Se escribe con las entradas del ZIP **sin comprimir** (método 0): así no hace falta un
 * compresor, el navegador no tiene API de deflate síncrona y Excel abre igual el archivo. Una
 * plantilla de dos filas no gana nada comprimiéndose.
 */
export function descargarPlantillaExcel(nombreArchivo: string, cabeceras: string[], ejemplos: string[][] = []): void {
  /*
   * Varias filas de ejemplo y no una: un registro con líneas (un asiento, un recibo) se escribe
   * con UNA FILA POR LÍNEA repitiendo la clave, y eso no se entiende leyendo una sola fila.
   */
  const filas = [filaXml(cabeceras, 1), ...ejemplos.map((fila, indice) => filaXml(fila, indice + 2))].join('');
  const hoja =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${filas}</sheetData></worksheet>`;

  const archivos: Array<[string, string]> = [
    [
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '</Types>',
    ],
    [
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ],
    [
      'xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Plantilla" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ],
    [
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '</Relationships>',
    ],
    ['xl/worksheets/sheet1.xml', hoja],
  ];

  descargar(nombreArchivo, construirZip(archivos));
}

function descargar(nombreArchivo: string, contenido: Uint8Array): void {
  const blob = new Blob([contenido as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
}

/* ───────────────────────── ZIP ───────────────────────── */

const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let indice = 0; indice < 256; indice += 1) {
    let valor = indice;
    for (let vuelta = 0; vuelta < 8; vuelta += 1) valor = valor & 1 ? 0xedb88320 ^ (valor >>> 1) : valor >>> 1;
    tabla[indice] = valor >>> 0;
  }
  return tabla;
})();

function crc32(datos: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of datos) crc = (crc >>> 8) ^ (TABLA_CRC[(crc ^ byte) & 0xff] as number);
  return (crc ^ 0xffffffff) >>> 0;
}

function construirZip(archivos: Array<[string, string]>): Uint8Array {
  const codificador = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let desplazamiento = 0;

  for (const [nombre, texto] of archivos) {
    const nombreBytes = codificador.encode(nombre);
    const datos = codificador.encode(texto);
    const crc = crc32(datos);

    const local = new Uint8Array(30 + nombreBytes.length);
    const vistaLocal = new DataView(local.buffer);
    vistaLocal.setUint32(0, 0x04034b50, true);
    vistaLocal.setUint16(4, 20, true);
    vistaLocal.setUint32(14, crc, true);
    vistaLocal.setUint32(18, datos.length, true);
    vistaLocal.setUint32(22, datos.length, true);
    vistaLocal.setUint16(26, nombreBytes.length, true);
    local.set(nombreBytes, 30);
    partes.push(local, datos);

    const entrada = new Uint8Array(46 + nombreBytes.length);
    const vistaEntrada = new DataView(entrada.buffer);
    vistaEntrada.setUint32(0, 0x02014b50, true);
    vistaEntrada.setUint16(4, 20, true);
    vistaEntrada.setUint16(6, 20, true);
    vistaEntrada.setUint32(16, crc, true);
    vistaEntrada.setUint32(20, datos.length, true);
    vistaEntrada.setUint32(24, datos.length, true);
    vistaEntrada.setUint16(28, nombreBytes.length, true);
    vistaEntrada.setUint32(42, desplazamiento, true);
    entrada.set(nombreBytes, 46);
    central.push(entrada);

    desplazamiento += local.length + datos.length;
  }

  const tamanoCentral = central.reduce((total, parte) => total + parte.length, 0);
  const fin = new Uint8Array(22);
  const vistaFin = new DataView(fin.buffer);
  vistaFin.setUint32(0, 0x06054b50, true);
  vistaFin.setUint16(8, archivos.length, true);
  vistaFin.setUint16(10, archivos.length, true);
  vistaFin.setUint32(12, tamanoCentral, true);
  vistaFin.setUint32(16, desplazamiento, true);

  const todo = [...partes, ...central, fin];
  const total = todo.reduce((suma, parte) => suma + parte.length, 0);
  const salida = new Uint8Array(total);
  let posicion = 0;
  for (const parte of todo) {
    salida.set(parte, posicion);
    posicion += parte.length;
  }
  return salida;
}

async function abrirZip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  /*
   * El índice del ZIP está al FINAL, no al principio, y lo precede un comentario de longitud
   * variable: hay que buscar su firma hacia atrás. 66 KiB cubre el comentario más largo posible
   * (65535 bytes) más la propia cabecera.
   */
  let fin = -1;
  for (let posicion = bytes.length - 22; posicion >= Math.max(0, bytes.length - 66_000); posicion -= 1) {
    if (vista.getUint32(posicion, true) === 0x06054b50) { fin = posicion; break; }
  }
  if (fin === -1) throw new Error('El archivo no es un Excel válido (falta el índice del ZIP).');

  const cuantas = vista.getUint16(fin + 10, true);
  let puntero = vista.getUint32(fin + 16, true);
  const decodificador = new TextDecoder();
  const entradas = new Map<string, Uint8Array>();

  for (let numero = 0; numero < cuantas; numero += 1) {
    if (vista.getUint32(puntero, true) !== 0x02014b50) break;
    const metodo = vista.getUint16(puntero + 10, true);
    const comprimido = vista.getUint32(puntero + 20, true);
    const largoNombre = vista.getUint16(puntero + 28, true);
    const largoExtra = vista.getUint16(puntero + 30, true);
    const largoComentario = vista.getUint16(puntero + 32, true);
    const inicioLocal = vista.getUint32(puntero + 42, true);
    const nombre = decodificador.decode(bytes.subarray(puntero + 46, puntero + 46 + largoNombre));

    const nombreLocal = vista.getUint16(inicioLocal + 26, true);
    const extraLocal = vista.getUint16(inicioLocal + 28, true);
    const inicioDatos = inicioLocal + 30 + nombreLocal + extraLocal;
    const crudo = bytes.subarray(inicioDatos, inicioDatos + comprimido);

    // Sólo interesan las piezas que se van a leer: un .xlsx real trae imágenes y temas que no pintan nada aquí.
    if (nombre.endsWith('.xml') || nombre.endsWith('.rels')) {
      entradas.set(nombre, metodo === 0 ? crudo : await inflar(crudo));
    }
    puntero += 46 + largoNombre + largoExtra + largoComentario;
  }
  return entradas;
}

async function inflar(datos: Uint8Array): Promise<Uint8Array> {
  const flujo = new Blob([datos as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(flujo).arrayBuffer());
}
