import { deflateSync } from 'node:zlib';
import { qrMatrix } from '../../lib/qr';

/**
 * Un PNG que contiene un código QR de verdad, para las pruebas que suben QR.
 *
 * ## Por qué hace falta
 *
 * La pantalla dejó de aceptar cualquier imagen: antes de subir nada le pregunta al navegador si esa
 * imagen lleva un código (`lib/qrImagen.ts`, `BarcodeDetector`), y si no lo lleva se planta. Es la
 * comprobación correcta —evita el viaje completo al almacenamiento para acabar rechazado— pero dejó
 * a la prueba de extremo a extremo subiendo un PNG blanco de 1x1, o sea justo lo que la pantalla
 * ahora rechaza. El recorrido se caía en el paso del QR y nunca llegaba a lo que venía después.
 *
 * La salida NO es bajar la validación en la prueba. Un test que se salta la comprobación deja de
 * ejercitar la pantalla que existe. Lo que hace falta es una imagen legítima, y el codificador ya
 * está en el repositorio (`lib/qr.ts`) porque es el mismo con el que se dibujan los QR de cada caja.
 *
 * ## Por qué se escribe el PNG a mano
 *
 * Porque no hay con qué convertir una matriz en PNG desde Node en este proyecto, y traerse una
 * dependencia para las pruebas sería pagar mucho por muy poco: un PNG sin filtros ni entrelazado son
 * tres bloques y un CRC. Todo lo que sigue es el formato mínimo del estándar.
 */

/** CRC-32 del PNG, con su tabla calculada una vez. */
const TABLA_CRC = (() => {
  const tabla = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabla[n] = c >>> 0;
  }
  return tabla;
})();

function crc32(datos: Buffer): number {
  let c = 0xffffffff;
  for (const byte of datos) c = TABLA_CRC[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloque(tipo: string, datos: Buffer): Buffer {
  const longitud = Buffer.alloc(4);
  longitud.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([longitud, cuerpo, crc]);
}

/**
 * Dibuja `contenido` como QR y lo devuelve en PNG.
 *
 * `escala` y `margen` no son decoración: un QR sin zona tranquila alrededor, o con módulos de un
 * píxel, no lo reconoce ningún lector. Los valores por defecto son los que hacen que el detector del
 * navegador lo encuentre sin depender de la resolución de la pantalla que corra la prueba.
 */
export function pngConQr(contenido: string, escala = 8, margen = 4): Buffer {
  const matriz = qrMatrix(contenido);
  const modulos = matriz.length;
  const lado = (modulos + margen * 2) * escala;

  // Escala de grises, 8 bits: un QR es blanco y negro y no necesita canal de color.
  const lineas = Buffer.alloc((lado + 1) * lado);
  for (let y = 0; y < lado; y += 1) {
    const inicio = y * (lado + 1);
    lineas[inicio] = 0; // filtro «ninguno», que es lo que hace el resto trivial
    const fila = Math.floor(y / escala) - margen;
    for (let x = 0; x < lado; x += 1) {
      const columna = Math.floor(x / escala) - margen;
      const dentro = fila >= 0 && fila < modulos && columna >= 0 && columna < modulos;
      const negro = dentro && matriz[fila]![columna];
      lineas[inicio + 1 + x] = negro ? 0x00 : 0xff;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; // bits por muestra
  ihdr[9] = 0; // escala de grises
  ihdr[10] = 0; // compresión estándar
  ihdr[11] = 0; // filtrado estándar
  ihdr[12] = 0; // sin entrelazado

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque('IHDR', ihdr),
    bloque('IDAT', deflateSync(lineas)),
    bloque('IEND', Buffer.alloc(0)),
  ]);
}
