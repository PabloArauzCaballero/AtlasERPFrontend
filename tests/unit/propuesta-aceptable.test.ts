import { describe, expect, it } from 'vitest';
import { puedeAceptarse } from '@/lib/propuestaAceptable';

describe('puedeAceptarse', () => {
  it('sólo una propuesta enviada puede aceptarse', () => {
    expect(puedeAceptarse('SENT')).toBe(true);
    expect(puedeAceptarse('sent')).toBe(true);
  });

  it('un borrador, una aceptada, una rechazada o sin estado no', () => {
    for (const estado of ['DRAFT', 'ACCEPTED', 'REJECTED', 'PENDING_APPROVAL', '', undefined, null]) {
      expect(puedeAceptarse(estado)).toBe(false);
    }
  });
});
