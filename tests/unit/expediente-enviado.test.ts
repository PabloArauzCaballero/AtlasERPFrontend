import { describe, expect, it } from 'vitest';
import { expedienteYaEnviado } from '@/lib/expedienteEnviado';

describe('expedienteYaEnviado', () => {
  it.each(['under_review', 'approved'])('%s ya no admite reenvío', (estado) => {
    expect(expedienteYaEnviado(estado)).toBe(true);
  });

  it.each(['draft', 'contact_verified', 'documents_submitted', 'rejected', '', null, undefined])(
    '%s sigue decidiéndolo el backend (el botón se ofrece)',
    (estado) => {
      expect(expedienteYaEnviado(estado)).toBe(false);
    },
  );
});
