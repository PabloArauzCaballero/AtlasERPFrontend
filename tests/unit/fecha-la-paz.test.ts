import { describe, expect, it } from 'vitest';
import { diasAntesEnLaPaz, hoyEnLaPaz, vencioEnLaPaz } from '@/lib/fechaLaPaz';

describe('hoy en La Paz', () => {
  // 2026-11-12 21:00 en La Paz = 2026-11-13 01:00 UTC: la fecha UTC ya es mañana.
  const NOCHE = new Date('2026-11-13T01:00:00.000Z');

  it('a las 21:00 de La Paz sigue siendo hoy, aunque en UTC ya sea mañana', () => {
    expect(NOCHE.toISOString().slice(0, 10)).toBe('2026-11-13');
    expect(hoyEnLaPaz(NOCHE)).toBe('2026-11-12');
  });

  it('una cuota que vence hoy no está vencida a las 21:00; la de ayer sí', () => {
    expect(vencioEnLaPaz('2026-11-12', NOCHE)).toBe(false);
    expect(vencioEnLaPaz('2026-11-11', NOCHE)).toBe(true);
    expect(vencioEnLaPaz('2026-11-12T00:00:00.000Z', new Date('2026-11-13T04:00:00.000Z'))).toBe(true);
  });

  it('los rangos «últimos N días» terminan hoy en La Paz', () => {
    expect(diasAntesEnLaPaz(7, NOCHE)).toBe('2026-11-05');
    expect(diasAntesEnLaPaz(0, NOCHE)).toBe('2026-11-12');
  });
});
