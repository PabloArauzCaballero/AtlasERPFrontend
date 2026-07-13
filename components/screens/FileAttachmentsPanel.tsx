'use client';

import { useCallback, useRef, useState } from 'react';
import { filesService, uploadToCloudinary } from '@/services/filesService';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import type { ResourceRow } from '@/services/types';

interface FileAttachmentsPanelProps {
  ownerType: string;
  ownerId: string;
  title?: string;
  description?: string;
}

function formatBytes(size: unknown): string {
  const bytes = Number(size ?? 0);
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileAttachmentsPanel({ ownerType, ownerId, title = 'Documentos adjuntos', description }: FileAttachmentsPanelProps) {
  const load = useCallback(() => filesService.listFiles(ownerType, ownerId), [ownerType, ownerId]);
  const resource = useAsyncResource(load, Boolean(ownerId));
  const files = (resource.data ?? []) as ResourceRow[];
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const signature = await filesService.uploadSignature(ownerType, ownerId);
      const uploaded = await uploadToCloudinary(signature, file);
      await filesService.registerFile({
        ownerType,
        ownerId,
        fileName: file.name,
        storagePublicId: uploaded.public_id,
        secureUrl: uploaded.secure_url,
        ...(file.type ? { mimeType: file.type } : {}),
        ...(typeof uploaded.bytes === 'number' ? { byteSize: uploaded.bytes } : {}),
        ...(uploaded.resource_type ? { resourceType: uploaded.resource_type } : {}),
      });
      await resource.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo subir el archivo.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete(id: unknown) {
    if (!id) return;
    setError(null);
    try {
      await filesService.deleteFile(String(id));
      await resource.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar el archivo.');
    }
  }

  return (
    <Panel title={title} description={description ?? 'Suba comprobantes o documentos de respaldo (se almacenan en Cloudinary).'} icon="attach_file">
      <div className="mb-3 flex items-center gap-2">
        <input ref={inputRef} type="file" className="hidden" onChange={handleFileSelected} />
        <AtlasButton icon="upload" loading={uploading} disabled={!ownerId} onClick={() => inputRef.current?.click()}>
          Subir documento
        </AtlasButton>
        <AtlasButton variant="secondary" icon="refresh" loading={resource.status === 'loading'} onClick={resource.reload}>Actualizar</AtlasButton>
      </div>

      {error ? <InlineNotice tone="danger" title="Error con el archivo">{error}</InlineNotice> : null}
      {resource.error && !files.length ? <InlineNotice tone="warning" title="No se pudieron cargar los adjuntos">{resource.error}</InlineNotice> : null}

      {files.length ? (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {files.map((file) => (
            <li key={String(file.id)} className="flex items-center gap-3 px-3 py-2">
              <Icon name="description" className="text-[18px] text-slate-400" />
              <div className="min-w-0 flex-1">
                <a href={String(file.secureUrl)} target="_blank" rel="noreferrer" className="block truncate text-xs font-semibold text-[#031636] hover:underline">{String(file.fileName ?? 'archivo')}</a>
                <span className="text-[10px] text-slate-500">{String(file.mimeType ?? '—')} · {formatBytes(file.byteSize)}</span>
              </div>
              <button type="button" onClick={() => handleDelete(file.id)} className="grid h-8 w-8 place-items-center rounded-md text-red-600 hover:bg-red-50" aria-label="Eliminar archivo">
                <Icon name="delete" className="text-[18px]" />
              </button>
            </li>
          ))}
        </ul>
      ) : !resource.error ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
          <Icon name="cloud_upload" className="text-[30px] text-slate-300" />
          <p className="mt-2 text-xs font-bold text-slate-700">Sin documentos adjuntos</p>
          <p className="mt-1 text-[11px] text-slate-500">Suba el primer respaldo con el botón «Subir documento».</p>
        </div>
      ) : null}
    </Panel>
  );
}
