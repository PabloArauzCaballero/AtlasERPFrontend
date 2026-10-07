import { describe, expect, it } from 'vitest';
import { estadoBnplSucursal } from '@/lib/estadoBnplSucursal';

describe('BNPL de una sucursal', () => {
  it('habilitada: «Sí»', () => {
    expect(estadoBnplSucursal({ canOriginateBnpl: true, status: 'ACTIVE' }).texto).toBe('Sí');
  });

  it('activa pero sin habilitar NO se dice «No»: está por habilitar (no rechazada)', () => {
    const estado = estadoBnplSucursal({ canOriginateBnpl: false, status: 'ACTIVE' });
    expect(estado.texto).toBe('Por habilitar');
    expect(estado.tono).toBe('warning');
  });

  it('«No» sólo para la dada de baja', () => {
    expect(estadoBnplSucursal({ canOriginateBnpl: false, status: 'INACTIVE' }).texto).toBe('No');
  });
});
