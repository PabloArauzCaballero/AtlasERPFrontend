import { describe, expect, it } from 'vitest';
import { dibujarCartel, nombreArchivoCartel } from '@/lib/cartelQr';

describe('cartel del QR de una caja', () => {
  it('el nombre de archivo no lleva tildes, espacios ni signos', () => {
    expect(nombreArchivoCartel({ comercio: 'Panadería «El Sol»', sucursal: 'Sucursal Norte (Equipetrol)', caja: 'Caja 1' })).toBe(
      'atlas-qr_Panaderia-El-Sol_Sucursal-Norte-Equipetrol_Caja-1.png',
    );
  });

  it('con datos vacíos sigue dando un nombre de archivo válido', () => {
    expect(nombreArchivoCartel({ comercio: '', sucursal: '', caja: '' })).toBe('atlas-qr_caja.png');
  });

  it('no imprime un cartel sin código manual: sería un QR sin su alternativa', async () => {
    await expect(
      dibujarCartel({ serial: 'SN-0001', codigoManual: '', comercio: 'Tienda', sucursal: 'Centro', caja: 'Caja 1' }),
    ).rejects.toThrow(/código manual/);
  });
});
