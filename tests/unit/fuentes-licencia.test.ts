import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Outfit y JetBrains Mono son OFL 1.1: quien redistribuye los archivos de la fuente debe llevar con ellos
 * el aviso de copyright y la licencia. Las .woff2 viven en el repo y salen en la imagen, así que cada una
 * tiene su licencia al lado. Si se añade otra fuente, esta prueba exige su licencia.
 */
const DIR = join(process.cwd(), 'app/fuentes');
const LICENCIA: Record<string, { archivo: string; autores: string }> = {
  outfit: { archivo: 'OFL-Outfit.txt', autores: 'The Outfit Project Authors' },
  jbmono: { archivo: 'OFL-JetBrainsMono.txt', autores: 'The JetBrains Mono Project Authors' },
};

describe('las fuentes autoalojadas llevan su licencia al lado', () => {
  const fuentes = readdirSync(DIR).filter((f) => f.endsWith('.woff2'));

  it('hay fuentes que comprobar', () => {
    expect(fuentes.length).toBeGreaterThan(0);
  });

  it.each(fuentes)('%s tiene su OFL con el copyright de sus autores', (fuente) => {
    const familia = fuente.split('-')[0]!;
    const esperada = LICENCIA[familia];
    expect(esperada, 'fuente sin licencia registrada: ${fuente}').toBeDefined();
    const texto = readFileSync(join(DIR, esperada!.archivo), 'utf8');
    expect(texto).toContain(esperada!.autores);
    expect(texto).toContain('SIL Open Font License, Version 1.1');
    expect(texto).toContain('PERMISSION & CONDITIONS');
  });
});
