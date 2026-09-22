/**
 * La carga masiva de un listado, de las celdas al envío, sin montar la aplicación.
 *
 * `lib/importacionExcel.ts` es lo único de la importación que puede equivocarse EN SILENCIO: si
 * agrupa mal las líneas de un asiento o acepta un valor que el catálogo no tiene, no hay excepción
 * ni pantalla roja —se crean registros mal hechos, o el backend los rechaza con un mensaje que no
 * dice qué celda corregir—. Por eso se prueba aquí, aparte del modal.
 *
 * Como en `excel-lector.spec.ts`: el módulo se transpila al vuelo y se inyecta en una página en
 * blanco. Necesita navegador porque `formDataToPayload` usa `FormData`, que en Node no es la misma.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import ts from 'typescript';

const RAIZ = join(__dirname, '..');

function moduloEnUnGuion(): string {
  const transpilar = (ruta: string) =>
    ts.transpileModule(readFileSync(join(RAIZ, ruta), 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
    }).outputText;

  return [transpilar('lib/csv.ts'), transpilar('lib/excel.ts'), transpilar('lib/formPayload.ts'), transpilar('lib/importacionExcel.ts')]
    .join('\n')
    .replace(/^import .*$/gm, '')
    .replace(/^export (async )?function/gm, '$1function')
    .replace(/^export function/gm, 'function')
    .replace(/^export const/gm, 'const')
    .concat('\nglobalThis.imp = { camposImportables, ejemploDe, valorDeOpcion, normalizar, payloadDeFila, erroresDeFila, prepararPlana, agrupar };');
}

async function conElModulo(page: Page): Promise<void> {
  await page.setContent('<!doctype html><html lang="es"><body></body></html>');
  await page.addScriptTag({ content: moduloEnUnGuion() });
}

const CAMPOS_ASIENTO = [
  { name: 'legalEntityId', label: 'Empresa', type: 'select', required: true, options: [{ label: 'E01 — Atlas SRL', value: 'uuid-empresa' }] },
  { name: 'documentDate', label: 'Fecha', type: 'date', required: true },
  { name: 'currencyCode', label: 'Moneda', type: 'select', required: true, options: [{ label: 'BOB', value: 'BOB' }] },
];

const CAMPOS_LINEA = [
  { name: 'glAccountId', label: 'Cuenta contable', type: 'select', required: true, options: [
    { label: '1101 — Caja', value: 'uuid-caja' },
    { label: '4101 — Ventas', value: 'uuid-ventas' },
  ] },
  { name: 'debit', label: 'Debe', type: 'number', valueKind: 'number', optional: true },
  { name: 'credit', label: 'Haber', type: 'number', valueKind: 'number', optional: true },
];

const LINEAS = { name: 'lines', clave: 'asiento', claveLabel: 'Referencia del asiento', nombreLinea: 'línea', fields: CAMPOS_LINEA };

test.describe('la carga masiva de los listados', () => {
  test('un campo que pide dos controles se desdobla en dos columnas, y el que abre un mapa se queda fuera', async ({ page }) => {
    await conElModulo(page);
    const nombres = await page.evaluate(() =>
      globalThis.imp
        .camposImportables([
          { name: 'legalName', label: 'Razón social' },
          { name: 'countryCode', label: 'País y ciudad', type: 'countryCity', cityFieldName: 'city', required: true },
          { name: 'address', label: 'Casa matriz', type: 'address' },
          { name: 'accountNo', label: 'Número', assignedByBackend: true },
        ])
        .map((campo) => campo.name),
    );
    /*
     * `countryCity` manda país Y ciudad. Sin desdoblarlo la ciudad no tenía columna y el alta
     * llegaba sin ella; `address` se compone con un mapa y no es una celda; el correlativo lo pone
     * el sistema y pedirlo sólo invita a inventárselo.
     */
    expect(nombres).toEqual(['legalName', 'countryCode', 'city']);
  });

  test('una celda acepta el nombre de la opción, su código y el código que lleva delante la etiqueta', async ({ page }) => {
    await conElModulo(page);
    const resuelto = await page.evaluate(() => {
      const campo = { name: 'glAccountId', label: 'Cuenta', type: 'select', options: [{ label: '1101 — Caja', value: 'uuid-caja' }] };
      return {
        porCodigoInterno: globalThis.imp.valorDeOpcion('uuid-caja', campo),
        porEtiquetaEntera: globalThis.imp.valorDeOpcion('1101 — Caja', campo),
        porNumeroDeCuenta: globalThis.imp.valorDeOpcion('1101', campo),
        inexistente: globalThis.imp.valorDeOpcion('9999', campo),
      };
    });
    // Nadie tiene a mano el UUID de una cuenta contable: en su hoja está el número, o el nombre.
    expect(resuelto.porCodigoInterno).toBe('uuid-caja');
    expect(resuelto.porEtiquetaEntera).toBe('uuid-caja');
    expect(resuelto.porNumeroDeCuenta).toBe('uuid-caja');
    expect(resuelto.inexistente).toBeNull();
  });

  test('las filas que repiten la referencia son UN registro: cabecera de la primera, líneas de todas', async ({ page }) => {
    await conElModulo(page);
    const registros = await page.evaluate(({ campos, lineas, camposLinea }) => globalThis.imp.agrupar(
      [
        { asiento: 'A-1', legalEntityId: 'E01 — Atlas SRL', documentDate: '2026-03-01', currencyCode: 'BOB', glAccountId: '1101', debit: '500', credit: '' },
        { asiento: 'A-1', legalEntityId: '', documentDate: '', currencyCode: '', glAccountId: '4101', debit: '', credit: '500' },
        { asiento: 'A-2', legalEntityId: 'E01 — Atlas SRL', documentDate: '2026-03-02', currencyCode: 'BOB', glAccountId: '1101', debit: '80', credit: '' },
      ],
      lineas,
      campos,
      campos.filter((campo) => campo.required),
      camposLinea,
      camposLinea.filter((campo) => campo.required),
    ), { campos: CAMPOS_ASIENTO, lineas: LINEAS, camposLinea: CAMPOS_LINEA });

    expect(registros).toHaveLength(2);
    const primero = registros[0]!;
    // La fila que se enseña es la PRIMERA del grupo: es la que el usuario busca en su Excel.
    expect(primero.numero).toBe(2);
    expect(primero.filasHoja).toEqual([2, 3]);
    expect(primero.errores).toEqual([]);
    expect(primero.payload.legalEntityId).toBe('uuid-empresa');
    expect(primero.payload.lines).toEqual([
      { glAccountId: 'uuid-caja', debit: 500 },
      { glAccountId: 'uuid-ventas', credit: 500 },
    ]);
    /*
     * La segunda fila deja la cabecera en blanco —es como se escribe un libro diario— y aun así el
     * asiento sale completo. Si esto se rompiera, el síntoma sería «falta la empresa» en la fila 3
     * de un archivo que está bien escrito.
     */
    expect(registros[1]!.payload.lines).toHaveLength(1);
  });

  test('una línea con un valor que el catálogo no tiene dice qué fila y qué se admite', async ({ page }) => {
    await conElModulo(page);
    const errores = await page.evaluate(({ campos, lineas, camposLinea }) => globalThis.imp.agrupar(
      [
        { asiento: 'A-1', legalEntityId: 'E01 — Atlas SRL', documentDate: '2026-03-01', currencyCode: 'BOB', glAccountId: '1101', debit: '500', credit: '' },
        { asiento: 'A-1', glAccountId: '9999', debit: '', credit: '500' },
      ],
      lineas,
      campos,
      campos.filter((campo) => campo.required),
      camposLinea,
      camposLinea.filter((campo) => campo.required),
    )[0]!.errores, { campos: CAMPOS_ASIENTO, lineas: LINEAS, camposLinea: CAMPOS_LINEA });

    // Con cien filas, «glAccountId must be a uuid» no dice cuál corregir. Éste sí.
    expect(errores).toHaveLength(1);
    expect(errores[0]).toContain('Fila 3');
    expect(errores[0]).toContain('1101 — Caja');
  });

  test('una fila sin referencia no se cuela dentro de otro registro: se señala sola', async ({ page }) => {
    await conElModulo(page);
    const registros = await page.evaluate(({ campos, lineas, camposLinea }) => globalThis.imp.agrupar(
      [
        { asiento: 'A-1', legalEntityId: 'E01 — Atlas SRL', documentDate: '2026-03-01', currencyCode: 'BOB', glAccountId: '1101', debit: '500', credit: '' },
        { asiento: '', glAccountId: '4101', debit: '', credit: '500' },
      ],
      lineas,
      campos,
      campos.filter((campo) => campo.required),
      camposLinea,
      camposLinea.filter((campo) => campo.required),
    ), { campos: CAMPOS_ASIENTO, lineas: LINEAS, camposLinea: CAMPOS_LINEA });

    /*
     * Lo tentador sería colgarla del registro anterior. Sería adivinar: una celda de referencia en
     * blanco puede ser una línea mal copiada o una fila de totales, y meterla en el asiento de
     * arriba lo descuadra sin que nadie lo vea.
     */
    expect(registros).toHaveLength(2);
    expect(registros[1]!.errores[0]).toContain('Referencia del asiento');
  });

  test('la fecha con formato de Excel y el decimal con coma llegan como el formulario los mandaría', async ({ page }) => {
    await conElModulo(page);
    const fila = await page.evaluate(() => globalThis.imp.payloadDeFila(
      { documentDate: '46023', amount: '1500,50' },
      [
        { name: 'documentDate', label: 'Fecha', type: 'date', required: true },
        { name: 'amount', label: 'Importe', type: 'number', valueKind: 'number', required: true },
      ],
    ));
    // Una celda con formato de fecha llega como número de serie; con coma, el backend leería 1500.
    expect(fila.documentDate).toBe('2026-01-01');
    expect(fila.amount).toBe(1500.5);
  });
});

declare global {
  var imp: {
    camposImportables: (campos: unknown[]) => Array<{ name: string }>;
    ejemploDe: (campo: unknown) => string;
    valorDeOpcion: (valor: string, campo: unknown) => string | null;
    normalizar: (valor: string, campo: unknown) => string;
    payloadDeFila: (crudo: Record<string, string>, campos: unknown[]) => Record<string, never>;
    erroresDeFila: (crudo: Record<string, string>, campos: unknown[], obligatorios: unknown[], prefijo?: string) => string[];
    prepararPlana: (crudo: Record<string, string>, numero: number, campos: unknown[], obligatorios: unknown[]) => Record<string, never>;
    agrupar: (
      filas: Array<Record<string, string>>,
      lineas: unknown,
      campos: unknown[],
      obligatorios: unknown[],
      camposLinea: unknown[],
      obligatoriosLinea: unknown[],
    ) => Array<{ numero: number; filasHoja: number[]; etiqueta: string; errores: string[]; payload: Record<string, never> }>;
  };
}
