import { beforeEach, describe, expect, it, vi } from 'vitest';

const llamadas = vi.hoisted(() => ({
  registrar: vi.fn(async (_p: string, _b: string, body: { terminalSerial: string; terminalAlias: string }) => ({
    terminalId: `t-${body.terminalSerial}`,
    terminalSerial: body.terminalSerial,
    terminalAlias: body.terminalAlias,
    status: 'registered',
  })),
  estado: vi.fn(async () => ({ status: 'active' })),
}));

vi.mock('@/services/partnerOnboardingService', () => ({
  partnerOnboardingService: { registerPosTerminal: llamadas.registrar, changePosStatus: llamadas.estado },
}));

const { aliasDeCaja, crearCajas, serialDeCaja, siguienteNumero, slugDeSucursal } = await import('@/lib/cajasDeSucursal');

/**
 * Pablo (2026-10-02): cantidad de cajas por sucursal, con nombres de un patrón claro —«Caja 1»,
 * «Caja 2»…— y un serial que se lee en la etiqueta del QR; el serial propio, opcional.
 */
describe('cajas de una sucursal por cantidad', () => {
  beforeEach(() => {
    llamadas.registrar.mockClear();
    llamadas.estado.mockClear();
  });

  it('el patrón: alias «Caja N» y serial NOMBRE-HUELLA-CAJA-N, sólo letras, dígitos y guiones', () => {
    expect(aliasDeCaja(3)).toBe('Caja 3');
    expect(slugDeSucursal('Tienda Norte (Equipetrol)')).toBe('TIENDA-NORTE-EQUIPETROL');
    expect(slugDeSucursal('Cochabamba — Av. Uyuni #1171')).toBe('COCHABAMBA-AV-UYUNI-1171');
    const serial = serialDeCaja('Tienda Norte', '1ae06870-6fe1-4ade-93c5-cdc421ed95bf', 2);
    expect(serial).toBe('TIENDA-NORTE-1AE068-CAJA-2');
    expect(serial).toMatch(/^[A-Za-z0-9-]{3,80}$/u);
  });

  it('numera a continuación de las cajas que ya tiene el local', () => {
    expect(siguienteNumero([])).toBe(1);
    expect(siguienteNumero([{ terminalAlias: 'Caja 1' }, { terminalAlias: 'Caja 4' }])).toBe(5);
    expect(siguienteNumero([{ terminalAlias: 'Mostrador' }, { terminalAlias: null }])).toBe(3);
  });

  it('crea la cantidad pedida, cada una con su alias y serial, y las deja ACTIVAS para que su QR funcione', async () => {
    const resultado = await crearCajas({
      partnerId: '2',
      branchId: '9',
      erpBranchId: 'abcdef12-0000',
      nombreSucursal: 'Tienda Sur',
      cantidad: 3,
      existentes: [],
    });

    expect(resultado).toEqual({ creadas: 3, sinActivar: 0 });
    expect(llamadas.registrar.mock.calls.map((call) => call[2])).toEqual([
      { terminalSerial: 'TIENDA-SUR-ABCDEF-CAJA-1', terminalAlias: 'Caja 1' },
      { terminalSerial: 'TIENDA-SUR-ABCDEF-CAJA-2', terminalAlias: 'Caja 2' },
      { terminalSerial: 'TIENDA-SUR-ABCDEF-CAJA-3', terminalAlias: 'Caja 3' },
    ]);
    expect(llamadas.estado).toHaveBeenCalledTimes(3);
    expect(llamadas.estado).toHaveBeenCalledWith('2', 't-TIENDA-SUR-ABCDEF-CAJA-1', { status: 'active' });
  });

  it('el serial propio sólo se usa al crear UNA caja', async () => {
    await crearCajas({ partnerId: '2', branchId: '9', erpBranchId: 'x', nombreSucursal: 'Sur', cantidad: 1, existentes: [], serialPropio: 'SN-00042' });
    expect(llamadas.registrar.mock.calls[0]?.[2]).toEqual({ terminalSerial: 'SN-00042', terminalAlias: 'Caja 1' });
  });

  it('si la activación falla, la caja queda creada y se cuenta como sin activar', async () => {
    llamadas.estado.mockRejectedValueOnce(new Error('409'));
    const resultado = await crearCajas({ partnerId: '2', branchId: '9', erpBranchId: 'x', nombreSucursal: 'Sur', cantidad: 2, existentes: [] });
    expect(resultado).toEqual({ creadas: 2, sinActivar: 1 });
  });
});
