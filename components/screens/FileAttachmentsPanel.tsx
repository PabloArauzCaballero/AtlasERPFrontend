'use client';

import { useCallback, useState } from 'react';
import { filesService, subirArchivoDelErp, TAMANO_MAXIMO_EVIDENCIA, TIPOS_DE_EVIDENCIA } from '@/services/filesService';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FileDropField } from '@/components/atlas/FileDropField';
import { StoredFilePreview, iconoDeArchivo, tipoDeVista } from '@/components/atlas/FilePreview';
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

/** Sólo imágenes y PDF tienen vista previa; lo demás se abre o se descarga. */
function conVistaPrevia(file: ResourceRow): boolean {
  return tipoDeVista(file.mimeType ? String(file.mimeType) : undefined, String(file.fileName ?? '')) !== 'otro';
}

export function FileAttachmentsPanel({ ownerType, ownerId, title = 'Documentos adjuntos', description }: FileAttachmentsPanelProps) {
  const load = useCallback(() => filesService.listFiles(ownerType, ownerId), [ownerType, ownerId]);
  const resource = useAsyncResource(load, Boolean(ownerId));
  const files = (resource.data ?? []) as ResourceRow[];
  /** Lo que se está subiendo ahora: se enseña con su vista previa mientras tanto. */
  const [subiendo, setSubiendo] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** El adjunto cuya vista previa está abierta. Una a la vez: cada una es un blob en memoria. */
  const [viendo, setViendo] = useState<string | null>(null);

  /*
   * Se sube en cuanto se suelta o se elige: el panel vive en un registro que ya existe, así que no
   * hay un «Guardar» que esperar. Varios archivos van de uno en uno —cada subida es permiso,
   * almacén y registro— para que, si uno falla, se sepa cuál y los demás queden guardados.
   */
  async function subir(elegidos: File[]) {
    if (!elegidos.length || !ownerId) return;
    setSubiendo(elegidos);
    setError(null);
    const fallidos: string[] = [];
    for (const file of elegidos) {
      try {
        // Permiso firmado de AtlasBackend → subida directa al almacén → registro tras verificar el objeto.
        await subirArchivoDelErp(ownerType, ownerId, file);
      } catch (err) {
        fallidos.push(`«${file.name}»: ${err instanceof Error ? err.message : 'no se pudo subir.'}`);
      }
    }
    if (fallidos.length) setError(fallidos.join(' '));
    setSubiendo([]);
    await resource.reload();
  }

  /** Abre el archivo desde un blob con sesión: los adjuntos ya no tienen URL pública. */
  async function abrir(id: unknown) {
    if (!id) return;
    setError(null);
    try {
      const url = await filesService.contentUrl(String(id));
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el archivo.');
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
    <Panel
      title={title}
      description={description ?? 'PDF, JPEG o PNG hasta 15 MB. Se guardan en el almacén de evidencia de Atlas y se abren con tu sesión.'}
      icon="attach_file"
    >
      <FileDropField
        label="Subir documento"
        tooltip="Suelta aquí la factura, el recibo o el contrato escaneado; se sube al momento y queda en la lista de abajo."
        accept={TIPOS_DE_EVIDENCIA}
        maxBytes={TAMANO_MAXIMO_EVIDENCIA}
        multiple
        files={subiendo}
        onFilesChange={(elegidos) => void subir(elegidos)}
        status={subiendo.length ? 'Subiendo…' : undefined}
        disabled={!ownerId}
        className="mb-3"
        data-testid="adjuntos-subir"
      />
      <div className="mb-3 flex justify-end">
        <AtlasButton variant="secondary" icon="refresh" loading={resource.status === 'loading'} onClick={resource.reload}>Actualizar</AtlasButton>
      </div>

      {error ? <InlineNotice tone="danger" title="Error con el archivo">{error}</InlineNotice> : null}
      {resource.error && !files.length ? <InlineNotice tone="warning" title="No se pudieron cargar los adjuntos">{resource.error}</InlineNotice> : null}

      {files.length ? (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {files.map((file) => (
            <li key={String(file.id)}>
              <div className="flex items-center gap-3 px-3 py-2">
                <Icon name={iconoDeArchivo(String(file.mimeType ?? ''), String(file.fileName ?? ''))} className="text-[18px] text-slate-500" />
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => abrir(file.id)} className="block max-w-full truncate text-left text-xs font-semibold text-[#006a61] hover:underline">
                    {String(file.fileName ?? 'archivo')}
                  </button>
                  <span className="text-[10px] text-slate-500">{String(file.mimeType ?? '—')} · {formatBytes(file.byteSize)}</span>
                </div>
                {conVistaPrevia(file) ? (
                  <button
                    type="button"
                    onClick={() => setViendo((actual) => (actual === String(file.id) ? null : String(file.id)))}
                    className="grid h-8 w-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100"
                    aria-label={viendo === String(file.id) ? 'Ocultar vista previa' : 'Ver vista previa'}
                    aria-expanded={viendo === String(file.id)}
                    title={viendo === String(file.id) ? 'Ocultar vista previa' : 'Ver vista previa'}
                  >
                    <Icon name={viendo === String(file.id) ? 'visibility_off' : 'visibility'} className="text-[18px]" />
                  </button>
                ) : null}
                <button type="button" onClick={() => handleDelete(file.id)} className="grid h-8 w-8 place-items-center rounded-md text-red-600 hover:bg-red-50" aria-label="Eliminar archivo">
                  <Icon name="delete" className="text-[18px]" />
                </button>
              </div>
              {viendo === String(file.id) ? (
                <div className="border-t border-slate-100">
                  <StoredFilePreview
                    cargar={() => filesService.contentUrl(String(file.id))}
                    mimeType={file.mimeType ? String(file.mimeType) : undefined}
                    nombre={String(file.fileName ?? file.id)}
                    alto="alto"
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : !resource.error ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
          <Icon name="cloud_upload" className="text-[30px] text-slate-400" />
          <p className="mt-2 text-xs font-bold text-slate-700">Sin documentos adjuntos</p>
          <p className="mt-1 text-[11px] text-slate-500">Suba el primer respaldo arrastrándolo a la zona de arriba.</p>
        </div>
      ) : null}
    </Panel>
  );
}
