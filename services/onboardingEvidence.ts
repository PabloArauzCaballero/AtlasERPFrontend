import { b2bService } from '@/services/b2bService';
import { contentTypeDeArchivo, sha256DeArchivo, uploadWithTicket } from '@/services/filesService';

/** Las etapas de la subida, para que quien espera vea que algo pasa aunque el archivo pese. */
export type FaseDeSubida = 'preparando' | 'subiendo' | 'registrando';

/**
 * Sube el archivo de UN requisito de un caso: permiso firmado → subida al almacén → registro
 * verificado. Lo usan el alta del caso (el archivo se elige al crearlo) y el modal de la fila
 * (para reemplazarlo o completar uno que quedó sin archivo). Lanza si algo falla.
 */
export async function subirEvidenciaDeRequisito(
  caseId: string,
  itemId: string,
  archivo: File,
  onFase?: (fase: FaseDeSubida) => void,
): Promise<void> {
  const contentType = contentTypeDeArchivo(archivo);
  if (!contentType) throw new Error('Sólo se admiten PDF, JPEG o PNG.');
  onFase?.('preparando');
  const [ticket, sha256] = await Promise.all([
    b2bService.checklistEvidenceUploadUrl(caseId, itemId, { contentType, sizeBytes: archivo.size }),
    sha256DeArchivo(archivo),
  ]);
  onFase?.('subiendo');
  await uploadWithTicket(ticket, archivo);
  onFase?.('registrando');
  await b2bService.attachChecklistEvidence(caseId, itemId, { storageKey: ticket.storageKey, sha256, contentType, sizeBytes: archivo.size });
}
