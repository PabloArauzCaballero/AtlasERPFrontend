import { apiRequest } from '@/lib/apiClient';
import type { JsonObject } from './types';

/** Una solicitud esperando la respuesta del comercio. Sin identidad del cliente, a propósito. */
export interface SolicitudDeCompra {
  applicationId: string;
  applicationCode: string;
  status: string;
  requestedAmount: string | number;
  requestedTermMonths: number;
  currencyCode: string;
  businessAcceptance: string | null;
  submittedAt: string;
}

export interface ExpedientePropio {
  partnerId: string;
  legalName: string | null;
  tradeName: string | null;
  status: string;
}

/**
 * Las compras que el cliente pidió en el local y el motor aprobó.
 *
 * No hay ningún método para MODIFICAR una solicitud, y es deliberado: el importe y el esquema de
 * pagos los fijó el motor de decisión al aprobarla. Si el comercio pudiera cambiarlos estaría
 * deshaciendo desde el mostrador la decisión que sostiene el riesgo de la operación.
 */
/** Un comprobante de transferencia esperando la palabra del comercio. */
export interface ComprobanteDePago {
  claimId: string;
  claimCode: string;
  installmentId: string;
  claimedAmount: string | number;
  currencyCode: string;
  payerReference: string | null;
  proofEvidenceId: string | null;
  status: string;
  submittedAt: string;
  decidedAt: string | null;
}

export interface CuotaDeCartera {
  installmentId: string;
  installmentNumber: number;
  dueDate: string;
  amountDue: string;
  amountPaid: string;
  amountOutstanding: string;
  status: string;
  daysPastDue: number;
  overdue: boolean;
}

export interface CreditoDeCartera {
  loanId: string;
  loanCode: string;
  currencyCode: string;
  principalAmount: string;
  status: string;
  outstanding: string;
  installments: CuotaDeCartera[];
}

export interface Cartera {
  partnerProfileId: string;
  summary: {
    activeCredits: number;
    totalCredits: number;
    outstanding: string;
    overdueAmount: string;
    overdueInstallments: number;
    collected: string;
    proofsAwaitingVerification: number;
  };
  credits: CreditoDeCartera[];
  calendar: { date: string; installments: number; amount: string; overdue: boolean }[];
}

export const merchantCreditService = {
  /** Cuál es mi expediente. El portal no lo sabía: sólo lo conocía justo tras crearlo. */
  misExpedientes() {
    return apiRequest<{ profiles: ExpedientePropio[] }>('/partner-onboarding/mine');
  },

  listar(partnerId: string, soloPendientes = true) {
    return apiRequest<{ partnerProfileId: string; applications: SolicitudDeCompra[] }>(
      `/merchant-credit/${encodeURIComponent(partnerId)}/applications`,
      { query: { onlyPending: soloPendientes ? 'true' : 'false' } },
    );
  },

  /**
   * Los comprobantes que esperan mi confirmación.
   *
   * El dinero de una transferencia entra en la cuenta del comercio, no en la de Atlas: es el único
   * que puede decir si llegó.
   */
  listarComprobantes(partnerId: string, soloPendientes = true) {
    return apiRequest<{ partnerProfileId: string; claims: ComprobanteDePago[] }>(
      `/merchant-credit/${encodeURIComponent(partnerId)}/payment-claims`,
      { query: { onlyPending: soloPendientes ? 'true' : 'false' } },
    );
  },

  /** Qué me deben, quién y cuándo. Una sola lectura para créditos, calendario y panel. */
  cartera(partnerId: string) {
    return apiRequest<Cartera>(`/merchant-credit/${encodeURIComponent(partnerId)}/portfolio`);
  },

  /** Confirmar registra el pago del préstamo. Rechazar exige motivo. */
  verificarComprobante(partnerId: string, claimId: string, body: JsonObject) {
    return apiRequest<JsonObject>(
      `/merchant-credit/${encodeURIComponent(partnerId)}/payment-claims/${encodeURIComponent(claimId)}/verification`,
      { method: 'POST', body },
    );
  },

  /** `accepted: false` exige motivo: rechazar algo que el motor aprobó tiene que quedar explicado. */
  decidir(partnerId: string, applicationId: string, body: JsonObject) {
    return apiRequest<JsonObject>(
      `/merchant-credit/${encodeURIComponent(partnerId)}/applications/${encodeURIComponent(applicationId)}/acceptance`,
      { method: 'POST', body },
    );
  },
};
