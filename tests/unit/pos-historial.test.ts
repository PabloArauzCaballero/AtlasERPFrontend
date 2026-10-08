import { describe, expect, it } from 'vitest';
import { movimientosDePago, solicitudesDecididas } from '@/components/screens/MerchantPosHistoryScreen';
import type { ComprobanteDePago, PagoInicial, SolicitudDeCompra } from '@/services/merchantCreditService';

/** Pablo (2026-10-08): el comercio no veía lo ya confirmado ni si un pago era el inicial o una cuota. */
describe('historial de Gestión POS', () => {
  const inicial = {
    applicationId: '4',
    applicationCode: 'CRA-4',
    downPaymentStatus: 'confirmed',
    downPaymentAmount: '720.00',
    currencyCode: 'BOB',
    payerReference: 'OP-1',
    hasProof: true,
    branchName: null,
    terminalAlias: null,
    submittedAt: '2026-10-08T12:01:38Z',
    decidedAt: '2026-10-08T12:01:52Z',
    rejectionReason: null,
  } as PagoInicial;
  const cuota = {
    claimId: '9',
    claimCode: 'PC-9',
    installmentId: '1',
    claimedAmount: '245.50',
    currencyCode: 'BOB',
    payerReference: null,
    proofEvidenceId: '1',
    status: 'rejected',
    submittedAt: '2026-10-09T10:00:00Z',
    decidedAt: '2026-10-09T11:00:00Z',
  } as ComprobanteDePago;

  it('junta iniciales y cuotas con su tipo y su estado en castellano, más recientes primero', () => {
    const filas = movimientosDePago([inicial], [cuota]);
    expect(filas.map((f) => [f.tipo, f.codigo, f.importe, f.estado])).toEqual([
      ['Cuota', 'PC-9', 245.5, 'Rechazado'],
      ['Pago inicial', 'CRA-4', 720, 'Confirmado'],
    ]);
  });

  it('una compra sin pago inicial avisado no aparece como pago', () => {
    expect(movimientosDePago([{ ...inicial, downPaymentStatus: null }], [])).toEqual([]);
  });

  it('sólo las solicitudes respondidas, no las que esperan', () => {
    const base = { applicationCode: 'X', status: 'approved', requestedAmount: '1', requestedTermMonths: 1, currencyCode: 'BOB', submittedAt: '2026-10-08T00:00:00Z' };
    const lista = [
      { ...base, applicationId: '1', businessAcceptance: 'accepted' },
      { ...base, applicationId: '2', businessAcceptance: 'pending' },
      { ...base, applicationId: '3', businessAcceptance: 'declined' },
    ] as SolicitudDeCompra[];
    expect(solicitudesDecididas(lista).map((s) => s.applicationId).sort()).toEqual(['1', '3']);
  });
});
