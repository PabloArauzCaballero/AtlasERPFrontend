'use client';

import { useEffect, useRef, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Modal } from '@/components/atlas/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingIndicator';
import { b2bService } from '@/services/b2bService';
import { contentTypeDeArchivo, sha256DeArchivo, uploadWithTicket } from '@/services/filesService';
import type { ResourceRow } from '@/services/types';

interface Requisito {
  id: string;
  itemType: string;
  description: string;
  status: string;
  requiresEvidence?: boolean;
  hasEvidence?: boolean;
  evidenceUploadedAt?: string | null;
}

const TAMANO_MAXIMO = 15 * 1024 * 1024;

/** Las tres etapas de la subida, para que el usuario vea que algo pasa aunque el archivo pese. */
type Fase = 'preparando' | 'subiendo' | 'registrando';
const TEXTO_FASE: Record<Fase, string> = {
  preparando: 'Preparando el archivo…',
  subiendo: 'Subiendo el archivo al almacén…',
  registrando: 'Comprobando y registrando el archivo…',
};

function etiquetaDeEstado(item: Requisito): string {
  const estado = item.status === 'COMPLETED' ? 'completado' : item.status === 'WAIVED' ? 'eximido' : item.status === 'BLOCKED' ? 'bloqueado' : 'pendiente';
  if (item.hasEvidence) return `${estado}, con archivo`;
  if (item.requiresEvidence) return `${estado}, falta el archivo`;
  return estado;
}

function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * El archivo que respalda un requisito del caso de onboarding.
 *
 * Hasta el 2026-09-14 la pantalla prometía «requisitos legales» y los resolvía con un desplegable:
 * «NIT vigente» pasaba a COMPLETED sin que existiera ningún documento. Ahora el archivo va al
 * almacén de evidencia de Atlas (permiso firmado que emite AtlasBackend → subida directa desde el
 * navegador → registro tras verificar el objeto) y no se puede completar un requisito documental
 * sin él. Se abre desde la fila del caso, que es donde ya se sabe de qué comercio se habla.
 *
 * Mientras sube, el modal no se cierra ni se cambia nada: cerrar a medias dejaba un archivo en el
 * almacén sin registrar y un «Listo» que nunca llegaba. El `<input type="file">` nativo se pinta
 * con un selector propio: el del navegador sale en su idioma («Choose File») y sin tamaño.
 */
export function OnboardingChecklistEvidenceModal({
  caso,
  onClose,
  onDone,
}: Readonly<{ caso: ResourceRow | null; onClose: () => void; onDone: () => void }>) {
  const requisitos = (Array.isArray(caso?.checklistItems) ? caso!.checklistItems : []) as Requisito[];
  const entrada = useRef<HTMLInputElement>(null);
  const [itemId, setItemId] = useState<string>('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [fase, setFase] = useState<Fase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  useEffect(() => {
    setItemId(requisitos.find((item) => item.requiresEvidence && !item.hasEvidence)?.id ?? requisitos[0]?.id ?? '');
    setArchivo(null);
    setFase(null);
    setError(null);
    setHecho(null);
  }, [caso?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const elegido = requisitos.find((item) => item.id === itemId) ?? null;
  const ocupado = fase !== null;

  function elegirArchivo(file: File | null) {
    setError(null);
    setHecho(null);
    if (!file) { setArchivo(null); return; }
    if (!contentTypeDeArchivo(file)) { setArchivo(null); setError('Sólo se admiten PDF, JPEG o PNG.'); return; }
    if (file.size > TAMANO_MAXIMO) { setArchivo(null); setError(`El archivo pesa ${tamanoLegible(file.size)}; el máximo es 15 MB.`); return; }
    setArchivo(file);
  }

  async function subir(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caso?.id || !itemId || !archivo || ocupado) return;
    const contentType = contentTypeDeArchivo(archivo);
    if (!contentType) return;
    setError(null);
    setHecho(null);
    try {
      const caseId = String(caso.id);
      setFase('preparando');
      const [ticket, sha256] = await Promise.all([
        b2bService.checklistEvidenceUploadUrl(caseId, itemId, { contentType, sizeBytes: archivo.size }),
        sha256DeArchivo(archivo),
      ]);
      setFase('subiendo');
      await uploadWithTicket(ticket, archivo);
      setFase('registrando');
      await b2bService.attachChecklistEvidence(caseId, itemId, { storageKey: ticket.storageKey, sha256, contentType, sizeBytes: archivo.size });
      setHecho(`«${archivo.name}» quedó registrado para «${elegido?.description ?? 'el requisito'}». Ya puede marcarlo completado desde la fila.`);
      setArchivo(null);
      if (entrada.current) entrada.current.value = '';
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo adjuntar el archivo.');
    } finally {
      setFase(null);
    }
  }

  async function ver() {
    if (!caso?.id || !itemId) return;
    setError(null);
    try {
      const url = await b2bService.checklistEvidenceUrl(String(caso.id), itemId);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir el archivo.');
    }
  }

  return (
    <Modal
      open={Boolean(caso)}
      onClose={onClose}
      busy={ocupado}
      width="md"
      icon="upload_file"
      title={`Evidencia de requisitos · ${String(caso?.tradeName ?? 'comercio')}`}
      description="Cada requisito documental (NIT, poderes, contratos) se cierra con su archivo. Elija el requisito, adjunte el PDF o la imagen y después márquelo completado desde la fila del caso."
    >
      <form className="space-y-3" onSubmit={subir} data-testid="form-evidencia-requisito" aria-busy={ocupado}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ol className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600" aria-label="Pasos">
            <li><span className="font-bold text-slate-800">1.</span> Elija el requisito</li>
            <li><span className="font-bold text-slate-800">2.</span> Adjunte el archivo (PDF, JPEG o PNG hasta 15 MB)</li>
            <li><span className="font-bold text-slate-800">3.</span> Marque el requisito completado en la fila</li>
          </ol>
                  </div>
        <FormField tooltip="Requisito del checklist de alta sobre el que se actúa."
          kind="select"
          label="Requisito"
          name="checklistItemId"
          required
          disabled={ocupado}
          value={itemId}
          onChange={(event) => setItemId(event.target.value)}
          options={requisitos.map((item) => ({ value: item.id, label: `${item.description} (${item.itemType}) · ${etiquetaDeEstado(item)}` }))}
        />
        <div>
          <span className="mb-1.5 block text-xs font-bold text-slate-700">Archivo</span>
          <input
            ref={entrada}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            className="sr-only"
            data-testid="campo-evidencia"
            disabled={ocupado}
            onChange={(event) => elegirArchivo(event.target.files?.[0] ?? null)}
          />
          <div className={`flex min-h-[52px] items-center gap-3 rounded-md border px-3 py-2 ${archivo ? 'border-slate-300 bg-white' : 'border-dashed border-slate-300 bg-slate-50'}`} data-testid="selector-evidencia">
            <Icon name={archivo ? (archivo.type === 'application/pdf' ? 'picture_as_pdf' : 'image') : 'attach_file'} className={`text-[22px] ${archivo ? 'text-slate-700' : 'text-slate-400'}`} />
            <div className="min-w-0 flex-1">
              {archivo ? (
                <>
                  <p className="truncate text-xs font-bold text-slate-800" title={archivo.name}>{archivo.name}</p>
                  <p className="text-[11px] text-slate-500">{tamanoLegible(archivo.size)}{ocupado && fase ? ` · ${TEXTO_FASE[fase]}` : ''}</p>
                </>
              ) : (
                <p className="text-xs text-slate-500">Ningún archivo elegido todavía.</p>
              )}
            </div>
            {ocupado ? (
              <LoadingSpinner label={fase ? TEXTO_FASE[fase] : 'Procesando'} className="text-slate-600" />
            ) : (
              <AtlasButton variant="secondary" icon={archivo ? 'swap_horiz' : 'folder_open'} onClick={() => entrada.current?.click()} data-testid="btn-elegir-evidencia">
                {archivo ? 'Cambiar' : 'Elegir archivo'}
              </AtlasButton>
            )}
          </div>
          {elegido?.requiresEvidence ? (
            <span className="mt-1 block text-[11px] text-slate-500">Este requisito es documental: no se puede dar por completado sin su archivo.</span>
          ) : null}
        </div>
        {ocupado && fase ? (
          <div className="space-y-1" role="status" aria-live="polite">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-slate-800 transition-all duration-500" style={{ width: fase === 'preparando' ? '20%' : fase === 'subiendo' ? '60%' : '90%' }} />
            </div>
            <p className="text-[11px] text-slate-600">{TEXTO_FASE[fase]} No cierre esta ventana.</p>
          </div>
        ) : null}
        {error ? <InlineNotice tone="danger" title="No se pudo adjuntar">{error}</InlineNotice> : null}
        {hecho ? <InlineNotice tone="success" title="Listo">{hecho}</InlineNotice> : null}
        <div className="flex flex-wrap justify-end gap-2">
          {elegido?.hasEvidence ? (
            <AtlasButton variant="secondary" icon="visibility" onClick={ver} disabled={ocupado}>
              Ver archivo actual
            </AtlasButton>
          ) : null}
          <AtlasButton type="submit" icon="upload" loading={ocupado} disabled={!itemId || !archivo} data-testid="btn-adjuntar-evidencia">
            {ocupado ? 'Adjuntando…' : 'Adjuntar archivo'}
          </AtlasButton>
        </div>
      </form>
    </Modal>
  );
}
