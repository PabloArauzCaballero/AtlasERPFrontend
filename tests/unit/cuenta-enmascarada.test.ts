import { describe, expect, it } from 'vitest';
import { leerCuentaEnmascarada } from '@/lib/cuentaEnmascarada';

describe('leerCuentaEnmascarada (ERP-10: nunca el número de cuenta completo)', () => {
  it.each([
    ['', ''],
    ['   ', ''],
    ['****7890', '****7890'],
    ['**7890', '****7890'],
    ['*7890', '****7890'],
    ['1234 5678 7890', '****7890'],
    ['10000-7890', '****7890'],
    ['1.234.567.890', '****7890'],
    ['7890', '****7890'],
  ])('%j → %j', (entrada, esperado) => {
    expect(leerCuentaEnmascarada(entrada)).toEqual({ ok: true, valor: esperado });
  });

  it.each(['abc7890', 'cuenta 1234', '12-3', '***'])('rechaza %j con un motivo', (entrada) => {
    const leida = leerCuentaEnmascarada(entrada);
    expect(leida.ok).toBe(false);
    if (!leida.ok) expect(leida.motivo).toMatch(/\*\*\*\*7890/);
  });

  it('nunca devuelve más de 4 dígitos', () => {
    const leida = leerCuentaEnmascarada('2010 0000 1234 5678 9012');
    expect(leida).toEqual({ ok: true, valor: '****9012' });
  });
});
