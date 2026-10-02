import { describe, expect, it } from 'vitest';
import { agrupar, camposImportables, columnasPlantilla } from '@/lib/importacionExcel';
import type { ActionField } from '@/components/screens/StructuredActionForm';

const campos: ActionField[] = [
  { name: 'city', label: 'Ciudad', type: 'text', optional: true },
  { name: 'address', label: 'Dirección', optional: true },
];
const camposCaja: ActionField[] = [
  { name: 'terminalAlias', label: 'Caja', optional: true },
  { name: 'terminalSerial', label: 'Serial de la caja', required: true },
];
const lineas = {
  name: 'cajas', clave: 'sucursal', claveLabel: 'Sucursal', claveEnPayload: 'name', nombreLinea: 'caja', fields: camposCaja,
};

describe('carga masiva de sucursales con cajas', () => {
  it('filas con la misma sucursal son UNA sucursal con varias cajas, y el nombre llega al envío', () => {
    const filas = [
      { sucursal: 'Equipetrol', city: 'Santa Cruz', address: 'Av. 1', terminalAlias: 'Caja 1', terminalSerial: 'SN-1' },
      { sucursal: 'Equipetrol', city: '', address: '', terminalAlias: 'Caja 2', terminalSerial: 'SN-2' },
      { sucursal: 'Centro', city: 'Santa Cruz', address: '', terminalAlias: '', terminalSerial: 'SN-3' },
    ];
    const registros = agrupar(filas, lineas, campos, [], camposCaja, camposCaja.filter((c) => c.required));
    expect(registros).toHaveLength(2);
    expect(registros[0]!.errores).toEqual([]);
    expect(registros[0]!.payload).toMatchObject({
      name: 'Equipetrol',
      city: 'Santa Cruz',
      cajas: [{ terminalAlias: 'Caja 1', terminalSerial: 'SN-1' }, { terminalAlias: 'Caja 2', terminalSerial: 'SN-2' }],
    });
    expect(registros[1]!.payload).toMatchObject({ name: 'Centro', cajas: [{ terminalSerial: 'SN-3' }] });
  });

  it('una caja sin serial se rechaza nombrando la fila: sin serial no hay QR', () => {
    const [registro] = agrupar(
      [{ sucursal: 'Norte', terminalAlias: 'Caja 1', terminalSerial: '' }],
      lineas, campos, [], camposCaja, camposCaja.filter((c) => c.required),
    );
    expect(registro!.errores.join(' ')).toContain('Fila 2: Falta «Serial de la caja»');
  });

  it('la plantilla pide la sucursal primero y marca el serial como obligatorio', () => {
    const cabeceras = columnasPlantilla(camposImportables(campos), camposImportables(camposCaja), lineas).map((c) => c.cabecera);
    expect(cabeceras).toEqual(['Sucursal *', 'Ciudad', 'Dirección', 'Caja', 'Serial de la caja *']);
  });
});
