/**
 * El lector y el escritor de Excel, probados en un navegador de verdad.
 *
 * `lib/excel.ts` no se puede probar en Node: usa `DOMParser`, `Blob` y `DecompressionStream`, que
 * son del navegador. Tampoco tiene sentido probarlo con la aplicación levantada y una sesión
 * iniciada —no depende de ninguna de las dos—, así que esta batería no navega a ninguna página:
 * transpila el módulo al vuelo con el TypeScript que ya está instalado, lo inyecta en una página
 * en blanco y comprueba lo que de verdad falla con un Excel ajeno.
 *
 * Por qué importa: el importador de cada listado depende entero de este módulo. Si deja de leer un
 * `.xlsx` de Excel, el síntoma no es una excepción: es «el archivo no trae ninguna fila», que se
 * lee como «el Excel está mal» y manda al usuario a rehacer un archivo que estaba bien.
 */
import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import ts from 'typescript';

const RAIZ = join(__dirname, '..');

/** El módulo y su única dependencia, en un solo guion que el navegador pueda tragar. */
function moduloEnUnGuion(): string {
  const transpilar = (ruta: string) =>
    ts.transpileModule(readFileSync(join(RAIZ, ruta), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;

  return [transpilar('lib/csv.ts'), transpilar('lib/excel.ts')]
    .join('\n')
    .replace(/^import .*$/gm, '')
    .replace(/^export (async )?function/gm, '$1function')
    .replace(/^export function/gm, 'function')
    .concat('\nglobalThis.excel = { leerTabla, descargarPlantillaExcel, fechaDeSerieExcel };');
}

/* CRC-32, el mismo que exige el ZIP. Duplicarlo aquí es a propósito: si la prueba usara el del
 * módulo, un error en esa función pasaría inadvertido porque las dos partes se equivocarían igual. */
function crc32(datos: Buffer): number {
  const tabla = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[i] = c;
  }
  let crc = -1;
  for (const byte of datos) crc = (crc >>> 8) ^ (tabla[(crc ^ byte) & 0xff] as number);
  return (crc ^ -1) >>> 0;
}

/** Un `.xlsx` como los que guarda Excel: entradas comprimidas con deflate y tabla de cadenas. */
function xlsxComoLoGuardaExcel(): Buffer {
  const compartidas = ['legalName', 'tradeName', 'fecha', 'Comercial Uno SRL', 'Uno', 'Comercial Dos SA'];
  const archivos: Array<[string, string]> = [
    ['[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'],
    ['_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x" Target="xl/workbook.xml"/></Relationships>'],
    [
      'xl/workbook.xml',
      '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Datos" sheetId="1" r:id="rId7"/></sheets></workbook>',
    ],
    // La hoja NO se llama sheet1.xml: se llega a ella por las relaciones, como manda el formato.
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId7" Type="x" Target="worksheets/hoja-rara.xml"/></Relationships>'],
    [
      'xl/worksheets/hoja-rara.xml',
      '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' +
        // Fila vacía arriba, cabeceras en la 2, una fila en blanco intercalada y una fecha en serie.
        '<row r="1"><c r="A1"/></row>' +
        '<row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2" t="s"><v>1</v></c><c r="C2" t="s"><v>2</v></c></row>' +
        '<row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3" t="s"><v>4</v></c><c r="C3"><v>46023</v></c></row>' +
        '<row r="4"/>' +
        '<row r="5"><c r="A5" t="s"><v>5</v></c><c r="B5" t="inlineStr"><is><t>Dos</t></is></c><c r="C5"><v>46024</v></c></row>' +
        '</sheetData></worksheet>',
    ],
    [
      'xl/sharedStrings.xml',
      `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${compartidas
        .map((texto) => `<si><t>${texto}</t></si>`)
        .join('')}</sst>`,
    ],
  ];

  const partes: Buffer[] = [];
  const central: Buffer[] = [];
  let desplazamiento = 0;
  for (const [nombre, contenido] of archivos) {
    const nombreBytes = Buffer.from(nombre, 'utf8');
    const datos = Buffer.from(contenido, 'utf8');
    const comprimido = deflateRawSync(datos);
    const crc = crc32(datos);

    const local = Buffer.alloc(30 + nombreBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(nombreBytes.length, 26);
    nombreBytes.copy(local, 30);
    partes.push(local, comprimido);

    const entrada = Buffer.alloc(46 + nombreBytes.length);
    entrada.writeUInt32LE(0x02014b50, 0);
    entrada.writeUInt16LE(20, 4);
    entrada.writeUInt16LE(20, 6);
    entrada.writeUInt16LE(8, 10);
    entrada.writeUInt32LE(crc, 16);
    entrada.writeUInt32LE(comprimido.length, 20);
    entrada.writeUInt32LE(datos.length, 24);
    entrada.writeUInt16LE(nombreBytes.length, 28);
    entrada.writeUInt32LE(desplazamiento, 42);
    nombreBytes.copy(entrada, 46);
    central.push(entrada);
    desplazamiento += local.length + comprimido.length;
  }
  const directorio = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(archivos.length, 8);
  fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat([...partes, directorio, fin]);
}

async function conElModulo(page: Page): Promise<void> {
  await page.setContent('<!doctype html><html lang="es"><body></body></html>');
  await page.addScriptTag({ content: moduloEnUnGuion() });
}

test.describe('el lector de Excel de los listados', () => {
  test('escribe una plantilla que él mismo vuelve a leer', async ({ page }) => {
    await conElModulo(page);
    const leido = await page.evaluate(async () => {
      let blob: Blob | null = null;
      const original = URL.createObjectURL;
      const click = HTMLAnchorElement.prototype.click;
      URL.createObjectURL = (objeto: Blob | MediaSource) => { blob = objeto as Blob; return 'blob:x'; };
      HTMLAnchorElement.prototype.click = function () {};
      try {
        globalThis.excel.descargarPlantillaExcel('p.xlsx', ['legalName', 'tradeName', 'monto'], ['Comercial Uno SRL', 'Uno', '1500']);
      } finally {
        URL.createObjectURL = original;
        HTMLAnchorElement.prototype.click = click;
      }
      return globalThis.excel.leerTabla(new File([blob as unknown as Blob], 'p.xlsx'));
    });

    expect(leido.cabeceras).toEqual(['legalName', 'tradeName', 'monto']);
    expect(leido.filas).toEqual([{ legalName: 'Comercial Uno SRL', tradeName: 'Uno', monto: '1500' }]);
  });

  test('lee un .xlsx guardado por Excel: comprimido, con tabla de cadenas y filas vacías', async ({ page }) => {
    await conElModulo(page);
    const bytes = [...xlsxComoLoGuardaExcel()];
    const leido = await page.evaluate(async (crudo) => {
      const archivo = new File([new Uint8Array(crudo)], 'real.xlsx');
      return globalThis.excel.leerTabla(archivo);
    }, bytes);

    // La fila vacía de arriba no son las cabeceras, y la intercalada no es un registro.
    expect(leido.cabeceras).toEqual(['legalName', 'tradeName', 'fecha']);
    expect(leido.filas).toHaveLength(2);
    // Cadena de la tabla compartida, cadena en línea y número de serie tal cual.
    expect(leido.filas[0]).toEqual({ legalName: 'Comercial Uno SRL', tradeName: 'Uno', fecha: '46023' });
    expect(leido.filas[1]?.tradeName).toBe('Dos');
  });

  test('traduce el número de serie de una fecha, con el 1900 que Excel se inventó', async ({ page }) => {
    await conElModulo(page);
    const fechas = await page.evaluate(() => ({
      moderna: globalThis.excel.fechaDeSerieExcel(46023),
      primera: globalThis.excel.fechaDeSerieExcel(1),
    }));
    expect(fechas.moderna).toBe('2026-01-01');
    // Antes del 29/02/1900 inexistente la base es otra; sin esto enero de 1900 sale un día corrido.
    expect(fechas.primera).toBe('1900-01-01');
  });

  test('un archivo que no es un Excel se rechaza con un motivo legible', async ({ page }) => {
    await conElModulo(page);
    const mensaje = await page.evaluate(async () => {
      try {
        await globalThis.excel.leerTabla(new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])], 'roto.xlsx'));
        return '';
      } catch (error) {
        return error instanceof Error ? error.message : '';
      }
    });
    expect(mensaje).toContain('no es un Excel válido');
  });

  test('también acepta el CSV, que es lo que exporta cualquier otro sistema', async ({ page }) => {
    await conElModulo(page);
    const leido = await page.evaluate(async () => {
      const texto = 'legalName,tradeName\nAlfa SRL,Alfa\nBeta SA,Beta';
      return globalThis.excel.leerTabla(new File([new TextEncoder().encode(texto)], 'x.csv'));
    });
    expect(leido.filas).toHaveLength(2);
    expect(leido.filas[1]).toEqual({ legalName: 'Beta SA', tradeName: 'Beta' });
  });
});

declare global {
  var excel: {
    leerTabla: (file: File) => Promise<{ cabeceras: string[]; filas: Record<string, string>[] }>;
    descargarPlantillaExcel: (nombre: string, cabeceras: string[], ejemplo?: string[]) => void;
    fechaDeSerieExcel: (serie: number) => string;
  };
}
