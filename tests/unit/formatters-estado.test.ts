import { describe, expect, it } from 'vitest';
import { formatDateTime, statusTone } from '@/lib/formatters';

describe('estado y fecha-hora de las actividades', () => {
  it('HECHA (DONE) es verde, pero «ABANDONED» no lo es por contener «DONE»', () => {
    expect(statusTone('DONE')).toBe('success');
    expect(statusTone('ABANDONED')).toBe('neutral');
    expect(statusTone('PENDING')).toBe('warning');
    expect(statusTone('CANCELLED')).toBe('danger');
  });

  it('pinta fecha y hora en La Paz, y una fecha sin hora sin inventarle una', () => {
    expect(formatDateTime('2026-10-02T19:00:00.000Z')).toMatch(/2 oct.*2026.*3:00/);
    expect(formatDateTime('2026-10-02')).not.toMatch(/:/);
    expect(formatDateTime(null)).toBe('—');
  });
});
