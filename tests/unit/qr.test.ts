// @vitest-environment node
import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { qrMatrix, qrSvg } from '@/lib/qr';
import referencia from './fixtures/qr-referencia.json';

/**
 * El codificador propio de `lib/qr.ts`, leído de vuelta por un lector que no escribimos nosotros.
 *
 * Hasta el 2026-09-26 la única comprobación era `scripts/verificar-qr.py`, que usa el lector de
 * macOS y por eso CI (Linux) no la puede correr. Un fallo de Reed-Solomon, de entrelazado o de
 * máscara no se ve —el QR sale igual de cuadriculado— y aparece recién en la caja, con el cliente
 * delante. Aquí cada QR se rasteriza a píxeles y lo decodifica `jsqr`, comparando el texto EXACTO.
 *
 * Además de leerlo, se mira la cadena de formato y la de versión contra un BCH calculado aquí, no
 * contra las tablas de `lib/qr.ts`: un lector tolera que UNA de las dos copias venga mal (se queda
 * con la que mejor encaja), así que «jsqr lo leyó» no prueba que las dos estén bien. Eso es lo que
 * pasaba con la primera copia del formato, escrita traspuesta, hasta este mismo cambio.
 *
 * Y un lector CORRIGE errores: un fallo que estropee pocos bytes de Reed-Solomon también se lee.
 * Por eso hay además matrices de referencia bit a bit (`fixtures/qr-referencia.json`) de otra
 * implementación, node-qrcode 1.5.4, con la versión y la máscara que elige `lib/qr.ts`. Si alguien
 * cambia a propósito la elección de máscara, se regeneran con
 * `QRCode.create([{ data: new TextEncoder().encode(contenido), mode: 'byte' }],
 * { errorCorrectionLevel: 'M', version, maskPattern })` y cada fila en hexadecimal.
 */

// --- Datos deterministas -----------------------------------------------------------------------

/** mulberry32: generador sembrado. Sin `Math.random`, la prueba falla siempre igual o nunca. */
function sembrado(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIGITOS = '0123456789';
const ALFANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Seriales con la forma real del terminal: `SN-<13 dígitos>-<6 alfanuméricos en mayúscula>`. */
function seriales(cuantos: number, semilla: number): string[] {
  const azar = sembrado(semilla);
  const elegir = (alfabeto: string, n: number) =>
    Array.from({ length: n }, () => alfabeto[Math.floor(azar() * alfabeto.length)]).join('');
  return Array.from({ length: cuantos }, () => `SN-${elegir(DIGITOS, 13)}-${elegir(ALFANUM, 6)}`);
}

// --- Rasterizar y leer --------------------------------------------------------------------------

const SILENCIO = 4;

/** La matriz a RGBA, con la zona de silencio de 4 módulos del estándar y `escala` px por módulo. */
function rasterizar(matriz: boolean[][], escala = 4): { datos: Uint8ClampedArray; lado: number } {
  const lado = (matriz.length + SILENCIO * 2) * escala;
  const datos = new Uint8ClampedArray(lado * lado * 4).fill(255);
  for (let fila = 0; fila < matriz.length; fila += 1) {
    for (let col = 0; col < matriz.length; col += 1) {
      if (!matriz[fila]![col]) continue;
      for (let dy = 0; dy < escala; dy += 1) {
        for (let dx = 0; dx < escala; dx += 1) {
          const y = (fila + SILENCIO) * escala + dy;
          const x = (col + SILENCIO) * escala + dx;
          const i = (y * lado + x) * 4;
          datos[i] = 0;
          datos[i + 1] = 0;
          datos[i + 2] = 0;
        }
      }
    }
  }
  return { datos, lado };
}

function leer(matriz: boolean[][]) {
  const { datos, lado } = rasterizar(matriz);
  return jsQR(datos, lado, lado, { inversionAttempts: 'dontInvert' });
}

const versionDe = (matriz: boolean[][]) => (matriz.length - 17) / 4;
const bytesDe = (texto: string) => Array.from(new TextEncoder().encode(texto));

/** Genera, lee y compara: el texto exacto, los bytes exactos y la versión esperada. */
function esperarQueSeLea(contenido: string): boolean[][] {
  const matriz = qrMatrix(contenido);
  const leido = leer(matriz);
  expect(leido, `jsqr no encontró el QR de ${JSON.stringify(contenido.slice(0, 40))}`).not.toBeNull();
  expect(leido!.data).toBe(contenido);
  expect(leido!.binaryData).toEqual(bytesDe(contenido));
  expect(leido!.version).toBe(versionDe(matriz));
  return matriz;
}

// --- Formato y versión, calculados aquí ------------------------------------------------------------

/** Resto BCH de `valor` desplazado, con el polinomio generador `gen` de grado `grado`. */
function bch(valor: number, gen: number, grado: number): number {
  let resto = valor << grado;
  const alto = 31 - Math.clz32(gen);
  for (let bit = 31 - Math.clz32(resto); bit >= alto; bit -= 1) {
    if ((resto >> bit) & 1) resto ^= gen << (bit - alto);
  }
  return (valor << grado) | resto;
}

/** Nivel M (bits `00`) con cada máscara, con la máscara XOR del estándar. */
const FORMATOS_M_VALIDOS = Array.from({ length: 8 }, (_, mascara) => bch(mascara, 0x537, 10) ^ 0x5412);

/** Las dos copias de la cadena de formato, leídas en las posiciones de ISO/IEC 18004 §7.9. */
function formatos(m: boolean[][]): { primera: number; segunda: number } {
  const n = m.length;
  const bit = (fila: number, col: number) => (m[fila]![col] ? 1 : 0);
  let primera = 0;
  let segunda = 0;
  for (let i = 0; i < 15; i += 1) {
    // Junto al localizador superior izquierdo: bits 0–7 bajando por la columna 8 (saltando el
    // temporizador de la fila 6) y 8–14 hacia la izquierda por la fila 8 (saltando la columna 6).
    const [f1, c1] = i < 6 ? [i, 8] : i === 6 ? [7, 8] : i === 7 ? [8, 8] : i === 8 ? [8, 7] : [8, 14 - i];
    primera |= bit(f1, c1) << i;
    // Repartida: bits 0–7 en la fila 8 desde la derecha, 8–14 en la columna 8 abajo.
    const [f2, c2] = i < 8 ? [8, n - 1 - i] : [n - 15 + i, 8];
    segunda |= bit(f2, c2) << i;
  }
  return { primera, segunda };
}

/** Los dos bloques de 6×3 de la cadena de versión (v7+). */
function versiones(m: boolean[][]): { arriba: number; abajo: number } {
  const n = m.length;
  let arriba = 0;
  let abajo = 0;
  for (let i = 0; i < 18; i += 1) {
    const a = Math.floor(i / 3);
    const b = n - 11 + (i % 3);
    arriba |= (m[a]![b] ? 1 : 0) << i;
    abajo |= (m[b]![a] ? 1 : 0) << i;
  }
  return { arriba, abajo };
}

/** Invierte todos los módulos de la segunda copia del formato: como si una pegatina la tapara. */
function danarSegundaCopiaDelFormato(m: boolean[][]): boolean[][] {
  const n = m.length;
  const copia = m.map((fila) => [...fila]);
  for (let i = 0; i < 8; i += 1) copia[8]![n - 1 - i] = !copia[8]![n - 1 - i];
  for (let i = 8; i < 15; i += 1) copia[n - 15 + i]![8] = !copia[n - 15 + i]![8];
  return copia;
}

/** Capacidad en bytes, modo byte y nivel M, por versión (ISO/IEC 18004, tabla 7). */
const CAPACIDAD_M: Record<number, number> = { 1: 14, 2: 26, 3: 42, 4: 62, 5: 84, 6: 106, 7: 122, 8: 152, 9: 180, 10: 213 };

// --- Pruebas ----------------------------------------------------------------------------------------

describe('qrMatrix · seriales de terminal', () => {
  const lote = seriales(200, 20260926);

  it('el generador es determinista y da 200 seriales distintos con la forma real', () => {
    expect(seriales(200, 20260926)).toEqual(lote);
    expect(new Set(lote).size).toBe(200);
    for (const serial of lote) expect(serial).toMatch(/^SN-\d{13}-[A-Z0-9]{6}$/);
  });

  it('jsqr lee de vuelta los 200, texto exacto', () => {
    for (const serial of lote) esperarQueSeLea(serial);
  });

  it('las dos copias del formato coinciden y son de nivel M en todos', () => {
    for (const serial of lote) {
      const { primera, segunda } = formatos(qrMatrix(serial));
      expect(primera).toBe(segunda);
      expect(FORMATOS_M_VALIDOS).toContain(primera);
    }
  });

  it('se lee aunque la segunda copia del formato esté dañada', () => {
    for (const serial of lote.slice(0, 50)) {
      const leido = leer(danarSegundaCopiaDelFormato(qrMatrix(serial)));
      expect(leido?.data).toBe(serial);
    }
  });

  it('el mismo contenido da siempre la misma matriz', () => {
    expect(qrMatrix(lote[0]!)).toEqual(qrMatrix(lote[0]!));
  });
});

describe('qrMatrix · bordes de longitud', () => {
  it('un solo byte', () => {
    const matriz = esperarQueSeLea('7');
    expect(versionDe(matriz)).toBe(1);
  });

  it.each(Object.entries(CAPACIDAD_M).map(([v, c]) => [Number(v), c] as const))(
    'versión %i: %i bytes entran en ella y uno más pasa a la siguiente',
    (version, capacidad) => {
      const azar = sembrado(version);
      const contenido = Array.from({ length: capacidad }, () => ALFANUM[Math.floor(azar() * ALFANUM.length)]).join('');
      expect(versionDe(esperarQueSeLea(contenido))).toBe(version);
      if (version < 10) expect(versionDe(esperarQueSeLea(`${contenido}X`))).toBe(version + 1);
    },
  );

  it('213 bytes es el máximo (versión 10-M); 214, 216 y 217 lanzan en vez de recortar', () => {
    expect(versionDe(esperarQueSeLea('Z'.repeat(213)))).toBe(10);
    for (const largo of [214, 216, 217]) {
      expect(() => qrMatrix('Z'.repeat(largo))).toThrow('QR_CONTENT_TOO_LONG');
    }
  });

  it('el límite es en bytes UTF-8, no en caracteres', () => {
    // «ñ» son 2 bytes: 106 de ellas (212 bytes) + 1 ASCII = 213 entran; 107 (214 bytes) no.
    esperarQueSeLea(`${'ñ'.repeat(106)}a`);
    expect(() => qrMatrix('ñ'.repeat(107))).toThrow('QR_CONTENT_TOO_LONG');
  });

  it('la cadena de versión (v7–v10) está en sus dos bloques con su BCH', () => {
    for (let version = 7; version <= 10; version += 1) {
      const matriz = qrMatrix('V'.repeat(CAPACIDAD_M[version]!));
      expect(versionDe(matriz)).toBe(version);
      const { arriba, abajo } = versiones(matriz);
      expect(arriba).toBe(bch(version, 0x1f25, 12));
      expect(abajo).toBe(arriba);
      const { primera, segunda } = formatos(matriz);
      expect(primera).toBe(segunda);
      expect(FORMATOS_M_VALIDOS).toContain(primera);
    }
  });
});

describe('qrMatrix · contenido no ASCII', () => {
  it.each([
    'Peña & Cía. — caja nº 3',
    'SN-0000000000000-ÑANDÚ',
    'Ωmega · 東京 · حساب',
    'emoji 🧾💳 al final',
    'https://atlas.test/pago?caja=SN-1234567890123-ABC123&moneda=Bs',
  ])('%s', (contenido) => {
    esperarQueSeLea(contenido);
  });
});

describe('qrMatrix · contra otra implementación, bit a bit', () => {
  type Caso = { contenido: string; version: number; mascara: number; filas: string[] };
  const casos = (referencia as { casos: Caso[] }).casos;

  it('las referencias cubren las diez versiones', () => {
    expect([...new Set(casos.map((caso) => caso.version))].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  // Los 200 seriales nunca eligen la máscara 7 (y casi nunca la 5): sin estos casos, una entrada
  // mal de `FORMAT_M` o un fallo de Reed-Solomon que sólo asome con esas máscaras pasaría todo,
  // porque jsqr lo corrige. Cada caso fuerza una máscara con un contenido que `lib/qr.ts` elige así.
  it('las referencias cubren las ocho máscaras', () => {
    expect([...new Set(casos.map((caso) => caso.mascara))].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it.each(casos.map((caso) => [caso.version, caso.mascara, caso] as const))(
    'versión %i, máscara %i: la misma matriz que node-qrcode',
    (_version, mascara, caso) => {
      const lado = 17 + caso.version * 4;
      const esperada = caso.filas.map((hex) =>
        [...BigInt(`0x${hex}`).toString(2).padStart(lado, '0')].map((bit) => bit === '1'),
      );
      const matriz = qrMatrix(caso.contenido);
      expect(matriz.length).toBe(lado);
      expect(((formatos(matriz).segunda ^ 0x5412) >> 10) & 7).toBe(mascara);
      // Las dos copias contra el BCH calculado aquí, no sólo contra la otra implementación.
      expect(formatos(matriz)).toEqual({ primera: FORMATOS_M_VALIDOS[mascara], segunda: FORMATOS_M_VALIDOS[mascara] });
      expect(matriz).toEqual(esperada);
    },
  );
});

describe('qrSvg', () => {
  /** Reconstruye la matriz desde los `<rect>` del SVG, descontando la zona de silencio. */
  function matrizDelSvg(svg: string, lado: number, pixel: number): boolean[][] {
    const matriz = Array.from({ length: lado }, () => new Array<boolean>(lado).fill(false));
    const rects = [...svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"\/>/g)];
    for (const [, x, y, ancho, alto] of rects) {
      expect(Number(ancho)).toBe(pixel);
      expect(Number(alto)).toBe(pixel);
      const col = Number(x) / pixel - SILENCIO;
      const fila = Number(y) / pixel - SILENCIO;
      expect(Number.isInteger(col) && col >= 0 && col < lado).toBe(true);
      expect(Number.isInteger(fila) && fila >= 0 && fila < lado).toBe(true);
      expect(matriz[fila]![col], `módulo repetido en ${fila},${col}`).toBe(false);
      matriz[fila]![col] = true;
    }
    return matriz;
  }

  it.each([
    ['un serial', seriales(1, 7)[0]!, 8],
    ['texto UTF-8', 'Peña & Cía. — caja nº 3', 5],
    ['el máximo de la versión 10', 'V'.repeat(CAPACIDAD_M[10]!), 3],
  ])('%s: la misma matriz que qrMatrix, con silencio de 4 módulos', (_nombre, contenido, pixel) => {
    const matriz = qrMatrix(contenido);
    const svg = qrSvg(contenido, pixel);
    const dimension = (matriz.length + SILENCIO * 2) * pixel;
    expect(svg).toContain(`width="${dimension}" height="${dimension}" viewBox="0 0 ${dimension} ${dimension}"`);
    expect(svg).toContain(`<rect width="${dimension}" height="${dimension}" fill="#ffffff"/>`);
    expect(matrizDelSvg(svg, matriz.length, pixel)).toEqual(matriz);
  });

  it('el SVG por defecto usa 8 px por módulo', () => {
    const serial = seriales(1, 8)[0]!;
    const lado = qrMatrix(serial).length;
    expect(qrSvg(serial)).toContain(`width="${(lado + 8) * 8}"`);
  });
});
