import { describe, expect, it } from 'vitest';
import { dibujarCartel, nombreArchivoCartel, planoDelLogo } from '@/lib/cartelQr';
import { IMPRESO } from '@/lib/coloresImpresos';

describe('cartel del QR de una caja', () => {
  it('el nombre de archivo no lleva tildes, espacios ni signos', () => {
    expect(nombreArchivoCartel({ comercio: 'Panadería «El Sol»', sucursal: 'Sucursal Norte (Equipetrol)', caja: 'Caja 1' })).toBe(
      'cuotea-qr_Panaderia-El-Sol_Sucursal-Norte-Equipetrol_Caja-1.png',
    );
  });

  it('con datos vacíos sigue dando un nombre de archivo válido', () => {
    expect(nombreArchivoCartel({ comercio: '', sucursal: '', caja: '' })).toBe('cuotea-qr_caja.png');
  });

  it('no imprime un cartel sin código manual: sería un QR sin su alternativa', async () => {
    await expect(
      dibujarCartel({ serial: 'SN-0001', codigoManual: '', comercio: 'Tienda', sucursal: 'Centro', caja: 'Caja 1' }),
    ).rejects.toThrow(/código manual/);
  });

  it('usa la paleta de lo impreso de la app del comercio (PLAN-06, fase 4)', () => {
    expect(IMPRESO).toEqual({
      amarillo: '#FCEE3A',
      tinta: '#111111',
      tintaSuave: '#5C5C55',
      papel: '#FFFFFF',
      hundido: '#ECECE5',
      bordeFuerte: '#85857B',
    });
  });

  it('coloca el logo como la app: escala 0,9 y el cuadro de la «c» en (90, 82,5)', () => {
    const plano = planoDelLogo();
    expect(plano.ancho).toBeCloseTo(684);
    expect(plano.alto).toBeCloseTo(288);
    expect(plano.x + 117.08 * 0.9).toBeCloseTo(90);
    expect(plano.y + 85 * 0.9).toBeCloseTo(82.5);
    // El logo entero cabe en la banda amarilla de 300 px: su fondo amarillo no asoma sobre el papel.
    expect(plano.y).toBeGreaterThanOrEqual(0);
    expect(plano.y + plano.alto).toBeLessThanOrEqual(300);
  });
});
