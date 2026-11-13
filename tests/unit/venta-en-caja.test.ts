import { describe, expect, it } from 'vitest';
import { planLegible, resumenDeVenta } from '@/components/atlas/VentaEnCaja';
import { llaveDeEnvio } from '@/services/b2bService';

describe('la venta completa en caja', () => {
  it('el plan se lee en palabras', () => {
    expect(planLegible('policy-bnpl-60-40-v1', 4)).toBe('60 % en caja · 40 % en 4 cuotas');
    expect(planLegible(null, 1)).toBe('Financiado en 1 cuota');
    expect(planLegible(null, null)).toBeNull();
  });

  it('la cartera dice la venta entera, no sólo lo financiado', () => {
    const texto = resumenDeVenta({ grossAmount: '1700.00', downPaymentAmount: '1020.00', financedAmount: '680.00', planCode: 'policy-bnpl-60-40-v1', installmentsCount: 4 });
    expect(texto).toContain('Venta');
    expect(texto).toContain('1.700');
    expect(texto).toContain('1.020');
    expect(texto).toContain('680');
    expect(texto).toContain('40 % en 4 cuotas');
  });
});

describe('la llave del envío de una propuesta', () => {
  it('es la misma para el mismo envío y cambia si cambian destinatarios o mensaje', () => {
    const base = { contactIds: ['b', 'a'], extraEmails: ['X@Y.bo'], message: 'Hola' };
    expect(llaveDeEnvio('p1', base)).toBe(llaveDeEnvio('p1', { contactIds: ['a', 'b'], extraEmails: ['x@y.bo '], message: 'Hola' }));
    expect(llaveDeEnvio('p1', base)).not.toBe(llaveDeEnvio('p1', { ...base, message: 'Otro' }));
    expect(llaveDeEnvio('p1', base)).not.toBe(llaveDeEnvio('p2', base));
  });
});
