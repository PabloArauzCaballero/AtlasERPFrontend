import { apiBlobUrl, apiRequest } from '@/lib/apiClient';
import { subirAlAlmacen } from '@/lib/almacen';
import { sha256Hex } from '@/lib/sha256';
import { toast } from '@/lib/toast';
import type { JsonObject, ResourceRow } from './types';

/** El permiso de subida que emite AtlasBackend a través del ERP. */
export interface UploadTicket {
  storageKey: string;
  uploadUrl: string;
  method: 'PUT';
  requiredHeaders: Record<string, string>;
  expiresAt: string;
}

export type FileContentType = 'application/pdf' | 'image/jpeg' | 'image/png';

/**
 * El peso que las pantallas prometen para el almacén de evidencia («PDF, JPEG o PNG hasta 15 MB»).
 * Vive aquí para que el campo de archivo lo compruebe al elegir, en vez de que cada pantalla lo
 * repita a mano y lo descubra el almacén al rechazar la subida.
 */
export const TAMANO_MAXIMO_EVIDENCIA = 15 * 1024 * 1024;

/** Los tipos que admite el almacén de evidencia, con la sintaxis de `accept`. */
export const TIPOS_DE_EVIDENCIA = 'application/pdf,image/jpeg,image/png';

export const filesService = {
  listFiles(ownerType: string, ownerId: string) {
    return apiRequest<ResourceRow[]>('/files', { query: { ownerType, ownerId } });
  },
  uploadSignature(ownerType: string, ownerId: string, file: { contentType: FileContentType; sizeBytes: number }) {
    return apiRequest<UploadTicket>('/files/upload-signature', {
      method: 'POST',
      body: { ownerType, ownerId, contentType: file.contentType, sizeBytes: file.sizeBytes },
    });
  },
  registerFile(body: JsonObject) {
    return apiRequest<ResourceRow>('/files', { method: 'POST', body });
  },
  deleteFile(id: string) {
    return apiRequest<ResourceRow>(`/files/${id}`, { method: 'DELETE' });
  },
  /** Los bytes con la sesión, como un blob local: un `<a href>` a una URL pública era lo que se retiró. */
  contentUrl(id: string) {
    return apiBlobUrl(`/files/${encodeURIComponent(id)}/content`);
  },
};

/** El tipo que el almacén admite, o `null` si el archivo no es PDF/JPEG/PNG. */
export function contentTypeDeArchivo(file: File): FileContentType | null {
  if (file.type === 'application/pdf' || file.type === 'image/jpeg' || file.type === 'image/png') return file.type;
  return null;
}

/**
 * SHA-256 en hexadecimal del archivo, calculado en el navegador: AtlasBackend lo compara con el
 * objeto real. En HTTP plano no hay `crypto.subtle`; `sha256Hex` lo resuelve en JavaScript.
 */
export function sha256DeArchivo(file: File): Promise<string> {
  return file.arrayBuffer().then(sha256Hex);
}

/**
 * Sube el archivo al almacén con el permiso firmado, a través de este mismo origen: ver
 * `lib/almacen.ts` (el PUT directo al almacén lo bloqueaba el navegador por contenido mixto).
 */
export async function uploadWithTicket(ticket: UploadTicket, file: File): Promise<void> {
  await subirAlAlmacen(ticket, file);
}

/** Los tres pasos juntos: permiso, subida y registro verificado. Devuelve el archivo registrado. */
export async function subirArchivoDelErp(ownerType: string, ownerId: string, file: File): Promise<ResourceRow> {
  const contentType = contentTypeDeArchivo(file);
  if (!contentType) throw new Error('Sólo se admiten PDF, JPEG o PNG.');
  const [ticket, sha256] = await Promise.all([
    filesService.uploadSignature(ownerType, ownerId, { contentType, sizeBytes: file.size }),
    sha256DeArchivo(file),
  ]);
  await uploadWithTicket(ticket, file);
  return filesService.registerFile({
    ownerType,
    ownerId,
    fileName: file.name,
    storageKey: ticket.storageKey,
    sha256,
    contentType,
    byteSize: file.size,
  });
}

/**
 * Sube el archivo elegido en un formulario de alta, una vez que el registro ya existe.
 *
 * El dueño del archivo es el registro recién creado, así que no se puede subir antes. Si la subida
 * falla NO se lanza: el registro ya está guardado, y un error aquí haría que el usuario lo volviera
 * a crear. Se avisa de qué pasó y de dónde subirlo otra vez.
 */
export async function adjuntarAlCrear(
  ownerType: string,
  ownerId: unknown,
  archivo: unknown,
  queSeCreo: string,
): Promise<void> {
  if (!(archivo instanceof File) || !ownerId) return;
  try {
    await subirArchivoDelErp(ownerType, String(ownerId), archivo);
    toast.success('Documento guardado', `«${archivo.name}» quedó adjunto.`);
  } catch (error) {
    const motivo = error instanceof Error ? error.message : 'No se pudo subir el archivo.';
    toast.warning(`${queSeCreo} se guardó, pero el documento no`, `${motivo} Vuelve a subirlo desde la fila, con «Documentos».`);
  }
}
