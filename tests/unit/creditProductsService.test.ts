import { describe, expect, it } from 'vitest';
import { avisoDeCobertura, codigoDeProducto, cuerpoDeProducto, productoQueAdmite, type ProductoDeCredito } from '@/services/creditProductsService';

const producto = (min: number, max: number, status = 'active'): ProductoDeCredito => ({
  id: String(min), productCode: `p${min}`, productName: `P${min}`, currencyCode: 'BOB', minAmount: min, maxAmount: max,
  minTermMonths: 1, maxTermMonths: 3, annualInterestRate: null, status,
});

describe('productos de crédito en el ERP', () => {
  it('el código sale del nombre y cumple lo que exige el Core (minúsculas, dígitos, guion bajo)', () => {
    const codigo = codigoDeProducto('Compra a cuotas Atlas ñandú', 1_700_000_000_000);
    expect(codigo).toMatch(/^[a-z0-9_-]{2,60}$/);
    expect(codigo.startsWith('compra_a_cuotas_atlas_nandu_')).toBe(true);
    expect(codigoDeProducto('', 1)).toMatch(/^producto_/);
    expect(codigoDeProducto('x'.repeat(200), 1).length).toBeLessThanOrEqual(60);
  });

  it('la tasa vacía no viaja y el producto nace sin revisión manual', () => {
    const cuerpo = cuerpoDeProducto({ productName: 'Base', currencyCode: 'BOB', minAmount: 50, maxAmount: 5000, minTermMonths: 1, maxTermMonths: 3, annualInterestRate: '' });
    expect(cuerpo).not.toHaveProperty('annualInterestRate');
    expect(cuerpo.requiresManualReview).toBe(false);
    expect(cuerpoDeProducto({ productName: 'B', annualInterestRate: 18 }).annualInterestRate).toBe(18);
  });

  it('sólo un producto ACTIVO cuyo rango incluya lo financiado admite la compra', () => {
    expect(productoQueAdmite([producto(50, 5000)], 80)?.id).toBe('50');
    expect(productoQueAdmite([producto(300, 5000)], 80)).toBeNull();
    expect(productoQueAdmite([producto(50, 5000, 'draft')], 80)).toBeNull();
    expect(productoQueAdmite([producto(50, 5000, 'suspended')], 80)).toBeNull();
  });

  it('sin productos activos el aviso dice que ninguna compra puede financiarse', () => {
    expect(avisoDeCobertura([])).toMatch(/ningún producto activo/);
    expect(avisoDeCobertura([producto(50, 5000, 'draft')])).toMatch(/ningún producto activo/);
  });

  it('con productos activos dice desde qué compra hay crédito (40 % financiado)', () => {
    expect(avisoDeCobertura([producto(50, 5000)])).toMatch(/menores de Bs 125/);
  });

  it('avisa del hueco entre dos productos activos', () => {
    expect(avisoDeCobertura([producto(50, 500), producto(1000, 5000)])).toMatch(/hueco.*500.*1000/);
  });
});
