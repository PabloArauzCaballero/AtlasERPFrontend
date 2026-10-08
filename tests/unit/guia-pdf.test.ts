import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUIAS_PDF, guiaPdfDe } from '@/components/tutorial/guia-pdf';

describe('guía en PDF', () => {
  it('cada guía ofrecida existe en public/: el botón nunca lleva a un 404', () => {
    for (const guia of Object.values(GUIAS_PDF)) {
      expect(existsSync(join(process.cwd(), 'public', guia!.href)), guia!.href).toBe(true);
      expect(guia!.href.endsWith(guia!.archivo)).toBe(true);
    }
  });

  it('el comercio tiene guía; una población sin guía no recibe botón', () => {
    expect(guiaPdfDe('merchant')?.href).toBe('/guias/ATLAS-Guia-del-portal-del-comercio.pdf');
    expect(guiaPdfDe('internal')).toBeNull();
  });
});
