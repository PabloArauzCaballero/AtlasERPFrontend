import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FRASES_PROHIBIDAS } from './fixtures/frases-prohibidas';

/** Todo el texto que el ERP enseña: pantallas, componentes (guías, tours, tooltips) y `lib/`. */
function fuentes(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return fuentes(ruta);
    return /\.(ts|tsx)$/.test(nombre) ? [ruta] : [];
  });
}

const ARCHIVOS = ['app', 'components', 'lib'].flatMap((dir) => fuentes(join(process.cwd(), dir)));
const TEXTOS = ARCHIVOS.map((ruta) => ({ ruta, texto: readFileSync(ruta, 'utf8') }));

describe('el ERP no promete lo que no hace', () => {
  it('recorre de verdad las guías y los tooltips', () => {
    expect(ARCHIVOS.some((ruta) => ruta.endsWith('guias-contabilidad.ts'))).toBe(true);
    expect(ARCHIVOS.length).toBeGreaterThan(100);
  });

  it.each(FRASES_PROHIBIDAS)('no dice «$frase»', ({ frase, motivo }) => {
    const donde = TEXTOS.filter(({ texto }) => texto.includes(frase)).map(({ ruta }) => ruta.replace(`${process.cwd()}/`, ''));
    expect(donde, `${motivo} Aparece en: ${donde.join(', ')}`).toEqual([]);
  });
});
