import { beforeEach, describe, expect, it, vi } from 'vitest';

const servicio = vi.hoisted(() => ({
  listCoreExceptions: vi.fn(),
  reprocessCoreException: vi.fn(),
  dismissCoreException: vi.fn(),
}));
const avisos = vi.hoisted(() => ({ success: vi.fn(), warning: vi.fn(), info: vi.fn(), error: vi.fn() }));

vi.mock('@/services/b2bService', () => ({ b2bService: servicio }));
vi.mock('@/services/optionLoaders', () => ({ loadB2BAccounts: vi.fn(), loadMerchantBranches: vi.fn() }));
vi.mock('@/lib/toast', () => ({ toast: avisos }));

import {
  accionesDeExcepcion,
  cargarExcepcionesDeCore,
  motivoDeExcepcion,
} from '@/components/screens/coreExceptionActions';

/**
 * La bandeja «Sin aplicar»: lo que llegó de Atlas y el ERP no pudo registrar sin adivinar. Lo que se
 * fija aquí es que el motivo se dice en palabras, que el comercio sólo se pregunta cuando el evento
 * no lo traía, y que un reproceso que vuelve a fallar se avisa como tal y no como éxito.
 */
describe('bandeja de lo que llegó de Atlas sin aplicar', () => {
  const recargar = vi.fn();
  const [reprocesar, descartar] = accionesDeExcepcion(recargar);
  const compraSinComercio = { id: '00000000-0000-4000-8000-000000000001', topic: 'loan.originated', reason: 'MISSING_MERCHANT_MAPPING' };
  const compraSinContrato = { ...compraSinComercio, reason: 'NO_ACTIVE_CONTRACT', detail: 'El comercio no tenía contrato vigente el 2026-11-09.' };

  beforeEach(() => vi.clearAllMocks());

  it('dice el motivo y el tipo en palabras, y no inventa uno desconocido', async () => {
    servicio.listCoreExceptions.mockResolvedValue([
      { ...compraSinComercio, loanCode: 'LOAN-1' },
      { id: '2', topic: 'payment.confirmed', reason: 'UNLINKED_INSTALLMENT', coreLoanId: '77' },
    ]);
    await expect(cargarExcepcionesDeCore()).resolves.toEqual([
      expect.objectContaining({ motivo: 'Comercio o sucursal sin ligar', queEs: 'Compra a plazos', referencia: 'LOAN-1' }),
      expect.objectContaining({ motivo: 'Pago de una cuota sin compra registrada', queEs: 'Pago confirmado', referencia: '77' }),
    ]);
    expect(motivoDeExcepcion('ALGO_NUEVO')).toBe('algo nuevo');
    expect(motivoDeExcepcion(undefined)).toBe('—');
  });

  // Los dos motivos que trae el dinero exacto Core ↔ ERP (#72): antes salían como el código en
  // minúsculas («legacy amounts derived», «reconciliation mismatch»).
  it('dice en palabras los avisos del dinero exacto y de la conciliación diaria', async () => {
    servicio.listCoreExceptions.mockResolvedValue([
      { id: '3', topic: 'loan.originated', reason: 'LEGACY_AMOUNTS_DERIVED', coreLoanId: '88' },
      { id: '4', topic: 'core.reconciliation', reason: 'RECONCILIATION_MISMATCH', coreLoanId: '99' },
    ]);
    const filas = await cargarExcepcionesDeCore();
    expect(filas[0]).toMatchObject({ motivo: 'Compra registrada con importes deducidos (evento antiguo)', queEs: 'Compra a plazos' });
    expect(filas[1]).toMatchObject({ motivo: 'El ERP y la plataforma de Cuotea no cuadran en la conciliación diaria', queEs: 'Conciliación diaria' });
    for (const fila of filas) expect(String(fila.motivo)).not.toMatch(/_|legacy|reconciliation/i);
  });

  it('sólo pregunta comercio y sucursal cuando el evento no los traía', () => {
    const campos = reprocesar!.form!.fields as (row: Record<string, unknown>) => Array<{ name: string }>;
    expect(campos(compraSinComercio).map((campo) => campo.name)).toEqual(['merchantAccountId', 'branchId']);
    expect(campos(compraSinContrato)).toEqual([]);
    expect(campos({ topic: 'payment.reported', reason: 'UNLINKED_INSTALLMENT' })).toEqual([]);
  });

  it('reprocesar con éxito lo dice y recarga; manda el comercio elegido', async () => {
    servicio.reprocessCoreException.mockResolvedValue({ resolved: true, outcome: 'PURCHASE_REGISTERED' });
    await reprocesar!.form!.submit(compraSinComercio, { merchantAccountId: 'cuenta', branchId: 'sucursal' });
    expect(servicio.reprocessCoreException).toHaveBeenCalledWith(compraSinComercio.id, { merchantAccountId: 'cuenta', branchId: 'sucursal' });
    expect(avisos.success).toHaveBeenCalledWith('Aplicado', 'La compra quedó registrada con su comisión.');
    expect(recargar).toHaveBeenCalledTimes(1);
  });

  it('un reproceso que vuelve a fallar se avisa con el motivo de ahora, no como éxito', async () => {
    servicio.reprocessCoreException.mockResolvedValue({ resolved: false, outcome: 'EXCEPTION', reason: 'MERCHANT_NOT_ELIGIBLE', detail: 'La sucursal no puede vender a crédito.' });
    await reprocesar!.form!.submit(compraSinContrato, {});
    expect(servicio.reprocessCoreException).toHaveBeenCalledWith(compraSinContrato.id, {});
    expect(avisos.success).not.toHaveBeenCalled();
    expect(avisos.warning).toHaveBeenCalledWith('Sigue sin poder aplicarse', 'Comercio o sucursal no habilitados. La sucursal no puede vender a crédito.');
  });

  it('descartar manda el motivo recortado y recarga', async () => {
    servicio.dismissCoreException.mockResolvedValue({ resolved: true });
    await descartar!.form!.submit(compraSinContrato, { note: '  préstamo de prueba  ' });
    expect(servicio.dismissCoreException).toHaveBeenCalledWith(compraSinContrato.id, { note: 'préstamo de prueba' });
    expect(recargar).toHaveBeenCalledTimes(1);
  });
});
