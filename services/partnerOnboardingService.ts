import { apiRequest } from '@/lib/apiClient';
import type { JsonObject } from '@/services/types';

/**
 * El expediente verificable del comercio.
 *
 * Las rutas van contra ESTE backend, que las reenvía a AtlasBackend —donde vive la evidencia— con
 * el token del usuario que las pidió. El portal nunca habla con AtlasBackend directo: es lo que
 * permite exponer el portal por un túnel sin exponer el backend de identidad.
 */

export type PartnerOnboardingStatus =
  | 'draft'
  | 'contact_verified'
  | 'documents_submitted'
  | 'under_review'
  | 'approved'
  | 'rejected';

export interface PartnerProfile {
  partnerId: string;
  legalName: string;
  tradeName: string | null;
  taxId: string;
  commercialRegistry: string | null;
  businessCategory: string | null;
  contactEmail: string;
  contactPhone: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  onboardingStatus: PartnerOnboardingStatus;
  submittedAt: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  erpAccountId: string | null;
}

/** Un requisito que le falta al expediente para poder enviarse. */
export interface SubmissionGap {
  requirement: string;
  detail: string;
}

export interface PartnerBranch {
  branchId: string;
  branchCode: string;
  name: string;
  addressLine: string | null;
  city: string | null;
  status: string;
}

export interface PartnerQrCode {
  qrId: string;
  qrKind: 'business' | 'bank';
  branchId: string | null;
  /** Prefijo del SHA-256 del archivo: identifica la evidencia sin publicarla entera. */
  fingerprint: string;
  bankInstitutionCode: string | null;
  accountNumberMasked: string | null;
  status: string;
  replacedById: string | null;
  createdAt: string;
}

export interface PartnerPosTerminal {
  terminalId: string;
  branchId: string;
  terminalSerial: string;
  terminalAlias: string | null;
  provider: string | null;
  model: string | null;
  status: string;
  activatedAt: string | null;
}

export interface PartnerOnboardingState {
  profile: PartnerProfile;
  gaps: SubmissionGap[];
  readyToSubmit: boolean;
  branches: PartnerBranch[];
  qrCodes: PartnerQrCode[];
  posTerminals: PartnerPosTerminal[];
}

/** Ticket firmado de subida. La ruta la impone el servidor; aquí sólo se devuelve. */
export interface QrUploadTicket {
  storageKey: string;
  uploadUrl: string;
  method: 'PUT';
  requiredHeaders: Record<string, string>;
  expiresAt: string;
}

const RUTA = '/partner-onboarding';

export const partnerOnboardingService = {
  start(body: JsonObject) {
    return apiRequest<PartnerProfile>(`${RUTA}/start`, { method: 'POST', body });
  },
  getState(partnerId: string) {
    return apiRequest<PartnerOnboardingState>(`${RUTA}/${encodeURIComponent(partnerId)}/status`);
  },
  submit(partnerId: string) {
    return apiRequest<PartnerProfile>(`${RUTA}/${encodeURIComponent(partnerId)}/submit`, { method: 'POST' });
  },
  registerBranch(partnerId: string, body: JsonObject) {
    return apiRequest<PartnerBranch>(`${RUTA}/${encodeURIComponent(partnerId)}/branches`, { method: 'POST', body });
  },
  createQrUploadUrl(partnerId: string, body: JsonObject) {
    return apiRequest<QrUploadTicket>(`${RUTA}/${encodeURIComponent(partnerId)}/qr-codes/upload-url`, {
      method: 'POST',
      body,
    });
  },
  registerQr(partnerId: string, body: JsonObject) {
    return apiRequest<PartnerQrCode>(`${RUTA}/${encodeURIComponent(partnerId)}/qr-codes`, { method: 'POST', body });
  },
  registerPosTerminal(partnerId: string, branchId: string, body: JsonObject) {
    return apiRequest<PartnerPosTerminal>(
      `${RUTA}/${encodeURIComponent(partnerId)}/branches/${encodeURIComponent(branchId)}/pos-terminals`,
      { method: 'POST', body },
    );
  },
  changePosStatus(partnerId: string, terminalId: string, body: JsonObject) {
    return apiRequest<PartnerPosTerminal>(
      `${RUTA}/${encodeURIComponent(partnerId)}/pos-terminals/${encodeURIComponent(terminalId)}`,
      { method: 'PATCH', body },
    );
  },
};

/**
 * Sube el archivo del QR al almacenamiento con el ticket firmado.
 *
 * Va **directo al almacenamiento** y no a través de la API: el ticket firma tipo y tamaño, así que
 * el bucket rechaza cualquier subida que no coincida con lo autorizado. Hacer pasar el binario por
 * el backend sólo añadiría un salto y un límite de cuerpo que nadie necesita.
 *
 * No usa el cliente HTTP del portal a propósito —ni debe—: aquél inyecta la sesión de ATLAS en cada
 * llamada, y mandar la credencial del portal a un origen de almacenamiento sería filtrarla.
 */
export async function uploadQrFile(ticket: QrUploadTicket, file: File): Promise<void> {
  const response = await fetch(ticket.uploadUrl, {
    method: ticket.method,
    headers: ticket.requiredHeaders,
    body: file,
  });
  if (!response.ok) {
    throw new Error(`El almacenamiento rechazó la subida del QR (${response.status}).`);
  }
}

/** Rótulos de los requisitos, para no enseñar la clave del contrato en pantalla. */
export const REQUIREMENT_LABELS: Record<string, string> = {
  commercial_registry: 'Matrícula de comercio',
  legal_representative: 'Representante legal',
  power_of_attorney: 'Poder del representante',
  branch: 'Al menos una sucursal',
  business_qr: 'QR del negocio',
  bank_qr: 'QR bancario de cobro',
};
