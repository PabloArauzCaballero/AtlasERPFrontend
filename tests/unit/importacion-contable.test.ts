import { describe, expect, it } from 'vitest';
import { parseCsv } from '@/lib/csv';
import { fechaDeSerieExcel } from '@/lib/excel';
import { agrupar, erroresDeFila, normalizar, payloadDeFila } from '@/lib/importacionExcel';
import { asientoDesdeExcel } from '@/components/screens/altas/asientoContable';
import type { ActionField } from '@/components/screens/StructuredActionForm';

const campos: ActionField[] = [
  { name: 'fecha', label: 'Fecha', type: 'date', required: true },
  { name: 'monto', label: 'Monto', type: 'number', valueKind: 'number', required: true },
  { name: 'estado', label: 'Estado', type: 'select', required: true, options: [
    { value: 'OK', label: 'Aprobado' }, { value: 'REJECTED', label: 'Rechazado' },
  ] },
];

describe('importador CSV y Excel', () => {
  it('lee una fila válida con comillas y conserva las cabeceras', () => {
    expect(parseCsv('fecha,monto,estado,nota\n2026-09-23,"1,25",Aprobado,"a,b"')).toEqual([
      { fecha: '2026-09-23', monto: '1,25', estado: 'Aprobado', nota: 'a,b' },
    ]);
    expect(parseCsv('fecha,monto,estado\n')).toEqual([]);
  });

  it('detecta cabeceras equivocadas, fila incompleta y opción fuera del catálogo', () => {
    const [fila] = parseCsv('fecha,importe,estado\n2026-09-23,10,DESCONOCIDO');
    expect(fila).toBeDefined();
    const errores = erroresDeFila(fila!, campos, campos);
    expect(errores).toContain('Falta «Monto»');
    expect(errores.join(' ')).toContain('Estado');
  });

  it('normaliza fecha serial y decimal con coma; deduplica códigos repetidos', () => {
    expect(fechaDeSerieExcel(46020)).toBe('2025-12-29');
    expect(normalizar('10,25', campos[1]!)).toBe('10.25');
    const codigos: ActionField[] = [{ name: 'codes', label: 'Códigos', type: 'multiselect', valueKind: 'codeList' }];
    expect(payloadDeFila({ codes: 'A, B, A' }, codigos)).toEqual({ codes: ['A', 'B'] });
  });

  it('rechaza un número extremo y una fecha inexistente antes del envío', () => {
    const errores = erroresDeFila({ fecha: '2026-02-30', monto: '1e999', estado: 'OK' }, campos, campos);
    expect(errores.join(' ')).toContain('Fecha');
    expect(errores.join(' ')).toContain('Monto');
  });

  it('agrupa líneas de un asiento y señala una fila sin clave', () => {
    const lineas: ActionField[] = [{ name: 'debit', label: 'Debe', type: 'number', valueKind: 'number', required: true }];
    const records = agrupar(
      [
        { clave: 'A-1', debit: '10' }, { clave: 'A-1', debit: '5' }, { clave: '', debit: '3' },
      ],
      { name: 'lines', clave: 'clave', claveLabel: 'Asiento', nombreLinea: 'línea', fields: lineas },
      [], [], lineas, lineas,
    );
    expect(records).toHaveLength(2);
    expect(records[0]?.filasHoja).toEqual([2, 3]);
    expect(records[0]?.payload.lines).toEqual([{ debit: 10 }, { debit: 5 }]);
    expect(records[1]?.errores.join(' ')).toContain('Asiento');
  });
});

it('asiento Excel conserva moneda, fecha y magnitudes debe/haber por línea', () => {
  const result = asientoDesdeExcel({ documentDate: '2026-09-23', currencyCode: 'BOB', lines: [
    { debit: '10.25', credit: '0' }, { debit: '0', credit: '10.25' },
  ] });
  expect(result.postingDate).toBe('2026-09-23');
  expect(result.lines).toEqual([
    { debit: 10.25, credit: 0, currencyCode: 'BOB', amountLc: 10.25 },
    { debit: 0, credit: 10.25, currencyCode: 'BOB', amountLc: 10.25 },
  ]);
});
