import { toast } from '@/lib/toast';
import { b2bService } from '@/services/b2bService';
import { subirArchivoDelErp } from '@/services/filesService';
import type { JsonObject } from '@/services/types';

/** Los dos archivos del expediente que se eligen en el alta o en el detalle de la cuenta. */
export interface ArchivosDelExpediente {
  poderNotarial?: unknown;
  qrBancario?: unknown;
}

/** Las claves con las que la cuenta las devuelve y el onboarding las exige, tal como las nombra el servidor. */
export const ETIQUETAS_DEL_EXPEDIENTE: Record<string, string> = {
  commercial_registry: 'la matrícula de comercio',
  legal_representative: 'el representante legal (nombre y documento)',
  power_of_attorney: 'el poder notarial del representante',
  branch: 'la casa matriz (dirección y ciudad)',
  bank_qr: 'el QR bancario de cobro (imagen, entidad y cuenta)',
};

export function describirFaltantesDelExpediente(faltan: readonly unknown[]): string {
  const partes = faltan.map((item) => ETIQUETAS_DEL_EXPEDIENTE[String(item)] ?? String(item));
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

/**
 * Sube el poder y el QR como documentos de la cuenta y deja sus ids en el expediente de la cuenta.
 *
 * El dueño de los archivos es la cuenta recién creada, así que no se pueden subir antes. Si una
 * subida falla NO se lanza: la cuenta ya existe y un error aquí haría que el usuario la volviera a
 * crear. Se avisa de qué faltó y de que se puede completar desde el detalle de la cuenta.
 */
export async function adjuntarArchivosDelExpediente(accountId: string, archivos: ArchivosDelExpediente): Promise<void> {
  const ids: JsonObject = {};
  const fallidos: string[] = [];
  const pendientes: Array<[keyof ArchivosDelExpediente, string, string]> = [
    ['poderNotarial', 'powerOfAttorneyFileId', 'el poder notarial'],
    ['qrBancario', 'bankQrFileId', 'el QR bancario'],
  ];
  for (const [campo, clave, nombre] of pendientes) {
    const archivo = archivos[campo];
    if (!(archivo instanceof File)) continue;
    try {
      const registrado = await subirArchivoDelErp('B2B_ACCOUNT', accountId, archivo);
      if (registrado?.id) ids[clave] = String(registrado.id);
    } catch {
      fallidos.push(nombre);
    }
  }
  if (Object.keys(ids).length) {
    try {
      await b2bService.setAccountDossier(accountId, ids);
    } catch {
      fallidos.push('el enlace de los archivos con la cuenta');
    }
  }
  if (fallidos.length) {
    toast.warning('La empresa se creó, pero faltó subir parte del expediente', `No se pudo guardar ${fallidos.join(' y ')}. Complétalo desde el detalle de la cuenta, en «Datos del expediente».`);
  } else if (Object.keys(ids).length) {
    toast.success('Expediente adjunto', 'El poder y el QR quedaron como documentos de la cuenta.');
  }
}

/** Qué recibió el expediente del comercio en Atlas al guardar la cuenta, cuando ya lo tenía. */
export function avisarEntregaAlExpediente(carpeta: unknown): void {
  const r = (carpeta ?? null) as { partnerId?: string | null; reason?: string | null; gaps?: unknown[]; onboardingStatus?: string | null } | null;
  if (!r) return;
  if (!r.partnerId || r.reason) {
    toast.warning('Guardado en la cuenta, pero no llegó al expediente del comercio', 'Atlas no respondió o la cuenta tiene datos que el expediente no acepta. Se vuelve a intentar al guardar otra vez.');
    return;
  }
  const huecos = Array.isArray(r.gaps) ? r.gaps : [];
  if (r.onboardingStatus === 'under_review') toast.success('Expediente completo y enviado a revisión', 'El comercio ya lo ve hecho en su portal.');
  else if (huecos.length) toast.info('Entregado al expediente del comercio', `Atlas todavía reclama ${describirFaltantesDelExpediente(huecos)}.`);
  else toast.success('Entregado al expediente del comercio', 'El comercio ya lo ve en su portal.');
}
