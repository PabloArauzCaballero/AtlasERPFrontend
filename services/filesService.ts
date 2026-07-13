import { apiRequest } from '@/lib/apiClient';
import type { JsonObject, ResourceRow } from './types';

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  uploadUrl: string;
}

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  resource_type?: string;
  bytes?: number;
  original_filename?: string;
}

export const filesService = {
  listFiles(ownerType: string, ownerId: string) {
    return apiRequest<ResourceRow[]>('/files', { query: { ownerType, ownerId } });
  },
  uploadSignature(ownerType: string, ownerId: string) {
    return apiRequest<UploadSignature>('/files/upload-signature', {
      method: 'POST',
      body: { ownerType, ownerId },
    });
  },
  registerFile(body: JsonObject) {
    return apiRequest<ResourceRow>('/files', { method: 'POST', body });
  },
  deleteFile(id: string) {
    return apiRequest<ResourceRow>(`/files/${id}`, { method: 'DELETE' });
  },
};

/** Sube el binario directo a Cloudinary con la firma emitida por el backend (no pasa por el ERP). */
export async function uploadToCloudinary(
  signature: UploadSignature,
  file: File,
): Promise<CloudinaryUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signature.apiKey);
  formData.append('timestamp', String(signature.timestamp));
  formData.append('signature', signature.signature);
  formData.append('folder', signature.folder);

  const response = await fetch(signature.uploadUrl, { method: 'POST', body: formData });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error?.message ?? 'No se pudo subir el archivo a Cloudinary.');
  }
  return (await response.json()) as CloudinaryUploadResult;
}
