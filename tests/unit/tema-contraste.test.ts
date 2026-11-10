import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guardián de contraste de la identidad de Cuotea (ESPECIFICACION-COMUN §7.1).
 *
 * Lee `app/tema.css` —la única capa donde viven los colores— y mide, para los DOS temas, cada
 * texto contra la PEOR superficie donde puede caer. Si un par falla se corrige el paso de la
 * rampa en `app/tema.css`; el umbral no se toca nunca.
 */
type Tema = Record<string, [number, number, number]>;

const CSS = readFileSync(join(process.cwd(), 'app/tema.css'), 'utf8');

function leerTema(selector: string): Tema {
  const inicio = CSS.indexOf(`${selector} {`);
  if (inicio < 0) throw new Error(`No existe el bloque «${selector}» en app/tema.css`);
  const cuerpo = CSS.slice(inicio, CSS.indexOf('}', inicio));
  const tema: Tema = {};
  for (const m of cuerpo.matchAll(/--c-([a-z0-9-]+):\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*;/g)) {
    tema[m[1]!] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return tema;
}

const TEMAS: Record<string, Tema> = {
  claro: leerTema(':root'),
  oscuro: leerTema(':root[data-theme="dark"]'),
};

function luminancia([r, g, b]: [number, number, number]): number {
  const canal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(tema: Tema, a: string, b: string): number {
  const ca = tema[a];
  const cb = tema[b];
  if (!ca || !cb) throw new Error(`Falta el token --c-${!ca ? a : b}`);
  const [x, y] = [luminancia(ca), luminancia(cb)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const PASOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const RAMPAS = ['neutral', 'red', 'orange', 'green', 'azul'];
const BASE = [
  'yellow', 'yellow-strong', 'yellow-soft', 'on-yellow', 'ink', 'ink-muted', 'canvas', 'surface',
  'surface-sunken', 'border', 'border-strong', 'blue', 'blue-soft', 'focus', 'success', 'success-soft',
  'warning', 'warning-soft', 'danger', 'danger-soft', 'scrim',
];

/** Dónde puede caer un texto: el fondo de la app, una tarjeta, un hueco y los dos lavados neutros. */
const SUPERFICIES = ['canvas', 'surface', 'surface-sunken', 'neutral-50', 'neutral-100'];
/** Lo que se usa como TEXTO sobre esas superficies. `neutral-400` y menores no son texto. */
const TEXTOS = [
  'ink', 'ink-muted', 'blue', 'success', 'warning', 'danger',
  'neutral-500', 'neutral-600', 'neutral-700', 'neutral-800', 'neutral-900',
  'red-600', 'red-700', 'orange-600', 'orange-700', 'green-600', 'green-700', 'azul-600', 'azul-700',
];
/** Texto sobre un relleno concreto: [texto, relleno]. */
const PARES_DE_RELLENO: Array<[string, string]> = [
  ['on-yellow', 'yellow'], ['on-yellow', 'yellow-strong'],
  ['ink', 'yellow-soft'], ['ink-muted', 'yellow-soft'],
  ['success', 'success-soft'], ['warning', 'warning-soft'], ['danger', 'danger-soft'], ['blue', 'blue-soft'],
  // `white` es `surface`: lo que hoy es `text-white` sobre un relleno.
  ['surface', 'ink'], ['canvas', 'ink'], ['surface', 'neutral-800'], ['surface', 'danger'], ['surface', 'red-700'],
  ['surface', 'success'], ['surface', 'green-700'], ['surface', 'blue'], ['surface', 'azul-700'],
];

describe.each(Object.keys(TEMAS))('tema %s', (nombre) => {
  const tema = TEMAS[nombre]!;

  it('declara todos los tokens', () => {
    const esperados = [...BASE, ...RAMPAS.flatMap((r) => PASOS.map((p) => `${r}-${p}`))];
    expect(esperados.filter((t) => !tema[t]), 'faltan tokens').toEqual([]);
  });

  it.each(TEXTOS.flatMap((texto) => SUPERFICIES.map((fondo) => ({ texto, fondo }))))(
    'texto $texto sobre $fondo ≥ 4,5:1',
    ({ texto, fondo }) => {
      expect(contraste(tema, texto, fondo), `${texto} sobre ${fondo}`).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(SUPERFICIES.flatMap((fondo) => ['border-strong', 'focus'].map((borde) => ({ borde, fondo }))))(
    'borde $borde sobre $fondo ≥ 3:1',
    ({ borde, fondo }) => {
      expect(contraste(tema, borde, fondo), `${borde} sobre ${fondo}`).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(PARES_DE_RELLENO.map(([texto, fondo]) => ({ texto, fondo })))(
    'texto $texto sobre relleno $fondo ≥ 4,5:1',
    ({ texto, fondo }) => {
      expect(contraste(tema, texto, fondo), `${texto} sobre ${fondo}`).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(RAMPAS.flatMap((rampa) => [
    { texto: `${rampa}-700`, fondo: `${rampa}-50` },
    { texto: `${rampa}-800`, fondo: `${rampa}-100` },
    { texto: `${rampa}-900`, fondo: `${rampa}-50` },
    { texto: `${rampa}-900`, fondo: `${rampa}-100` },
    { texto: `${rampa}-700`, fondo: `${rampa}-100` },
    { texto: `${rampa}-600`, fondo: `${rampa}-50` },
  ]))('rampa: $texto sobre $fondo ≥ 4,5:1', ({ texto, fondo }) => {
    expect(contraste(tema, texto, fondo), `${texto} sobre ${fondo}`).toBeGreaterThanOrEqual(4.5);
  });
});

describe('los dos temas son juegos distintos', () => {
  it('el oscuro no es el claro repetido', () => {
    expect(TEMAS.oscuro!.canvas!.join(' ') === TEMAS.claro!.canvas!.join(' ')).toBe(false);
  });
  it('el amarillo de marca es el mismo en los dos', () => {
    expect(TEMAS.oscuro!.yellow!.join(' ')).toBe(TEMAS.claro!.yellow!.join(' '));
  });
});
