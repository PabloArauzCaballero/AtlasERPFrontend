import { describe, expect, it } from 'vitest';
import { nombreDeCaja, textoDeOrigen } from '@/components/atlas/OrigenDeCaja';
import { aplicarFiltro, cajasDeSucursal, estadoDe, tipoDe } from '@/components/screens/MerchantPosHistoryScreen';
import type { HistorialDePos, MovimientoDePos } from '@/services/merchantCreditService';

/**
 * Pablo (2026-10-08): historial con filtros de sucursal, caja y fechas, paginado, y cada fila con su sucursal y caja
 * («pueden haber dos montos iguales pero de cajas distintas»).
 */
describe('historial de Gestión POS', () => {
  const filtros: HistorialDePos['filters'] = {
    branches: [
      { branchId: '1', branchName: 'Equipetrol', branchCode: 'EQ' },
      { branchId: '2', branchName: 'Centro', branchCode: 'CE' },
    ],
    terminals: [
      { terminalId: '5', branchId: '1', branchName: 'Equipetrol', terminalAlias: 'Caja 1', terminalSerial: 'SN-5' },
      { terminalId: '6', branchId: '2', branchName: 'Centro', terminalAlias: null, terminalSerial: 'SN-6' },
    ],
  };

  it('la caja se nombra siempre: alias, o la serie si no tiene alias', () => {
    expect(nombreDeCaja({ terminalAlias: 'Caja 1' })).toBe('Caja 1');
    expect(nombreDeCaja({ terminalAlias: null, terminalSerial: 'SN-6' })).toBe('Caja SN-6');
    expect(textoDeOrigen({ branchName: 'Centro', terminalSerial: 'SN-6' })).toBe('Centro · Caja SN-6');
    expect(textoDeOrigen({})).toBe('Sin caja registrada');
  });

  it('el filtro de caja ofrece sólo las cajas de la sucursal elegida', () => {
    expect(cajasDeSucursal(filtros, '2').map((t) => t.terminalId)).toEqual(['6']);
    expect(cajasDeSucursal(filtros, undefined).map((t) => t.terminalId)).toEqual(['5', '6']);
  });

  it('cambiar de sucursal suelta una caja de otra sucursal, y cualquier cambio vuelve a la página 1', () => {
    const actual = { branchId: '1', terminalId: '5', page: 3, pageSize: 20 };
    expect(aplicarFiltro(actual, { branchId: '2' }, filtros)).toEqual({ branchId: '2', page: 1, pageSize: 20 });
    expect(aplicarFiltro(actual, { from: '2026-10-01' }, filtros)).toEqual({ ...actual, from: '2026-10-01', page: 1 });
    expect(aplicarFiltro(actual, { page: 4 }, filtros).page).toBe(4);
  });

  it('nombra el tipo y el estado de cada fila', () => {
    const m = { kind: 'installment_payment', status: 'verified' } as MovimientoDePos;
    expect(tipoDe(m).texto).toBe('Cuota');
    expect(estadoDe(m)).toEqual({ texto: 'Confirmado', tono: 'success' });
    expect(tipoDe({ ...m, kind: 'purchase_request' }).texto).toBe('Solicitud de compra');
    expect(estadoDe({ ...m, status: 'declined' }).texto).toBe('Rechazada');
  });
});
