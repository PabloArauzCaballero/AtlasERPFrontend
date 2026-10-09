import { describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { maskCedula, maskComplementoCedula, maskPii } from '@/lib/formatters';
import { fiscalService } from '@/services/fiscalService';

describe('enmascarado de la cédula (ERP-11)', () => {
  it('deja los tres últimos dígitos del número y tapa complemento y extensión', () => {
    expect(maskCedula('7654321')).toBe('****321');
    expect(maskCedula('7654321-1A')).toBe('****321-**');
    expect(maskCedula('7654321-1A SC')).toBe('****321-** **');
    expect(maskCedula('7654321 LP')).toBe('****321 **');
  });

  it('una cédula sin número delante (extranjera) conserva sólo los tres últimos caracteres', () => {
    expect(maskCedula('E-1234567')).toBe('*-****567');
  });

  it('vacío y nulo como el resto de formateadores', () => {
    expect(maskCedula(null)).toBe('—');
    expect(maskCedula('')).toBe('');
    expect(maskComplementoCedula('1A')).toBe('**');
  });

  it('maskPii reconoce las columnas de cédula, su complemento y su extensión', () => {
    expect(maskPii('7654321', 'ci')).toBe('****321');
    expect(maskPii('7654321', 'documentNumber')).toBe('****321');
    expect(maskPii('7654321', 'legalRepDocumentNumber')).toBe('****321');
    expect(maskPii('7654321', 'nationalId')).toBe('****321');
    expect(maskPii('1A', 'taxIdComplement')).toBe('**');
    expect(maskPii('SC', 'documentExtension')).toBe('**');
  });

  it('no confunde columnas parecidas que no son una cédula', () => {
    expect(maskPii('Santa Cruz', 'city')).toBe('Santa Cruz');
    expect(maskPii('AS-2026-0001', 'documentNo')).toBe('AS-2026-0001');
    expect(maskPii('1020304050', 'taxId')).toBe('10***');
    expect(maskPii('70012345', 'phone')).toBe('*****345');
  });
});

describe('documentos fiscales: el receptor con CI sale enmascarado', () => {
  function documento(tipo: number | undefined, numero: string, complemento: string | null) {
    return {
      id: 'd',
      receptorSnapshot: { nombreRazonSocial: 'X', numeroDocumento: numero, complemento, ...(tipo ? { codigoTipoDocumentoIdentidad: tipo } : {}) },
    };
  }

  it('CI y CEX se enmascaran; NIT y snapshots sin tipo, tal cual', async () => {
    vi.spyOn(apiClient, 'apiRequest').mockResolvedValue({
      items: [documento(1, '7654321', '1A'), documento(2, '1234567', null), documento(5, '1020304050', null), documento(undefined, '4455667788', null)],
      total: 4,
    } as never);
    const filas = await fiscalService.listAllDocuments();
    expect(filas.map((fila) => fila.nit)).toEqual(['****321-**', '****567', '1020304050', '4455667788']);
  });
});
