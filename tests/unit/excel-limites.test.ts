import { deflateRawSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { LIMITES_DE_LECTURA, leerTabla } from '@/lib/excel';

/**
 * ERP-15: el importador no puede colgar la pestaña con un archivo enorme ni con una bomba de
 * descompresión. Los ZIP se fabrican aquí a mano, con lo justo del formato (cabecera local,
 * directorio central y fin de directorio), igual que los lee `lib/excel.ts`.
 */
interface Pieza {
  nombre: string;
  datos: Uint8Array;
  comprimir?: boolean;
}

function zip(piezas: Pieza[]): Uint8Array {
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let desplazamiento = 0;
  for (const pieza of piezas) {
    const nombre = Buffer.from(pieza.nombre);
    const metodo = pieza.comprimir === false ? 0 : 8;
    const cuerpo = metodo === 8 ? deflateRawSync(pieza.datos) : Buffer.from(pieza.datos);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(metodo, 8);
    local.writeUInt32LE(cuerpo.length, 18);
    local.writeUInt32LE(pieza.datos.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(metodo, 10);
    central.writeUInt32LE(cuerpo.length, 20);
    central.writeUInt32LE(pieza.datos.length, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt32LE(desplazamiento, 42);
    locales.push(local, nombre, cuerpo);
    centrales.push(central, nombre);
    desplazamiento += local.length + nombre.length + cuerpo.length;
  }
  const directorio = Buffer.concat(centrales);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(piezas.length, 8);
  fin.writeUInt16LE(piezas.length, 10);
  fin.writeUInt32LE(directorio.length, 12);
  fin.writeUInt32LE(desplazamiento, 16);
  return new Uint8Array(Buffer.concat([...locales, directorio, fin]));
}

/** Un `File` que sólo sabe su tamaño y sus bytes: lo único que usa `leerTabla`. */
function archivo(bytes: Uint8Array, size = bytes.byteLength) {
  const arrayBuffer = vi.fn(async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  return { file: { name: 'datos.xlsx', size, arrayBuffer } as unknown as File, arrayBuffer };
}

const HOJA = new TextEncoder().encode(
  '<worksheet><sheetData>' +
    '<row r="1"><c r="A1" t="inlineStr"><is><t>nombre</t></is></c></row>' +
    '<row r="2"><c r="A2" t="inlineStr"><is><t>Alfa</t></is></c></row>' +
    '</sheetData></worksheet>',
);

describe('leerTabla con topes (ERP-15)', () => {
  it('los topes son 10 MB de archivo, 1000 entradas y 50 MB descomprimidos', () => {
    expect(LIMITES_DE_LECTURA).toEqual({
      bytesArchivo: 10 * 1024 * 1024,
      entradasZip: 1000,
      bytesDescomprimidos: 50 * 1024 * 1024,
    });
  });

  it('un xlsx normal se sigue leyendo', async () => {
    const { file } = archivo(zip([{ nombre: 'xl/worksheets/sheet1.xml', datos: HOJA }]));
    await expect(leerTabla(file)).resolves.toEqual({ cabeceras: ['nombre'], filas: [{ nombre: 'Alfa' }] });
  });

  it('un archivo de más de 10 MB se rechaza SIN cargarlo en memoria', async () => {
    const { file, arrayBuffer } = archivo(new Uint8Array(4), LIMITES_DE_LECTURA.bytesArchivo + 1);
    await expect(leerTabla(file)).rejects.toThrow(/pesa demasiado.*10 MB/);
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('un ZIP con más de 1000 entradas se rechaza', async () => {
    const piezas = Array.from({ length: LIMITES_DE_LECTURA.entradasZip + 1 }, (_, i) => ({
      nombre: `x${i}.bin`,
      datos: new Uint8Array(0),
      comprimir: false,
    }));
    const { file } = archivo(zip(piezas));
    await expect(leerTabla(file)).rejects.toThrow(/1001 piezas/);
  });

  it('una bomba de descompresión se corta al pasar de 50 MB', async () => {
    const ceros = new Uint8Array(LIMITES_DE_LECTURA.bytesDescomprimidos + 1024 * 1024);
    const bytes = zip([{ nombre: 'xl/worksheets/sheet1.xml', datos: ceros }]);
    expect(bytes.byteLength).toBeLessThan(LIMITES_DE_LECTURA.bytesArchivo);
    const { file } = archivo(bytes);
    await expect(leerTabla(file)).rejects.toThrow(/descomprimido pasa de 50 MB/);
  });

  it('el presupuesto es del archivo entero, no de cada entrada', async () => {
    const treinta = new Uint8Array(30 * 1024 * 1024);
    const { file } = archivo(
      zip([
        { nombre: 'xl/a.xml', datos: treinta },
        { nombre: 'xl/b.xml', datos: treinta },
      ]),
    );
    await expect(leerTabla(file)).rejects.toThrow(/descomprimido/);
  });
});
