import { describe, expect, it, vi } from 'vitest';
import { downloadCsv, escapeCsvCell, parseCsv } from '@/lib/csv';

/**
 * Portado de `erpf-csv.diag.ts` (plan de producción 2026-09-24, FND-ERPF-02).
 *
 * Decisión documentada: un número negativo PURO (`-12.50`, `-3`) se exporta tal cual, porque una
 * hoja lo lee como número y no ejecuta nada; cualquier otro texto que empiece por `-` lleva apóstrofo.
 */
describe('escapeCsvCell', () => {
  it.each([
    ['=HYPERLINK("http://evil","x")', `"'=HYPERLINK(""http://evil"",""x"")"`],
    ['+1+1', "'+1+1"],
    ['-2+3', "'-2+3"],
    ['@SUM(1)', "'@SUM(1)"],
    ['\tcmd', "'\tcmd"],
    ['\r=1', `"'\r=1"`],
  ])('neutraliza %j', (entrada, esperado) => {
    expect(escapeCsvCell(entrada)).toBe(esperado);
  });

  it.each(['-12.50', '-3', '12.50', 'Comercio, S.R.L.', ''])('deja %j sin apóstrofo', (entrada) => {
    expect(escapeCsvCell(entrada).startsWith("'")).toBe(false);
  });

  it('sigue escapando comillas, comas y saltos de línea', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(escapeCsvCell('línea 1\nlínea 2')).toBe('"línea 1\nlínea 2"');
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(-7)).toBe('-7');
  });
});

describe('downloadCsv', () => {
  it('escribe la fórmula neutralizada y el texto vuelve legible al leerlo', async () => {
    let blob: Blob | null = null;
    URL.createObjectURL = vi.fn((b: Blob) => {
      blob = b;
      return 'blob:x';
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    downloadCsv('x.csv', [{ key: 'n', label: 'Nombre' }], [{ n: '=HYPERLINK("http://evil","x")' }, { n: '-12.50' }]);
    // El `Blob` es el de jsdom: se lee con su `FileReader`, no con el `Response` de Node.
    const texto = await new Promise<string>((listo) => {
      const lector = new FileReader();
      lector.onload = () => listo(String(lector.result));
      lector.readAsText(blob as unknown as Blob);
    });
    expect(texto).not.toMatch(/^=|\n=/m);
    const filas = parseCsv(texto);
    expect(filas.map((fila) => fila['Nombre'])).toEqual([`'=HYPERLINK("http://evil","x")`, '-12.50']);
  });
});
