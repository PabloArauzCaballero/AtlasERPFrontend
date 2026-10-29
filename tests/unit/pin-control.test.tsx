import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PIN_LENGTH, PinControl } from '@/components/atlas/SecretControls';

describe('PinControl', () => {
  afterEach(cleanup);

  it('su ancho cubre seis dígitos con su separación (OBS-11: con 9ch el sexto quedaba recortado)', () => {
    render(<PinControl aria-label="código" />);
    const caja = screen.getByLabelText('código');
    expect(caja.className).toContain('w-[calc(6ch+3em+3rem)]');
    expect(caja.className).not.toContain('9ch');
  });

  it('deja sólo dígitos y corta en seis, aunque peguen «481 516»', () => {
    const onChange = vi.fn();
    render(<PinControl aria-label="código" onChange={onChange} />);
    const caja = screen.getByLabelText('código') as HTMLInputElement;
    fireEvent.change(caja, { target: { value: '481 516 99' } });
    expect(caja.value).toBe('481516');
    expect(caja.value).toHaveLength(PIN_LENGTH);
  });
});
