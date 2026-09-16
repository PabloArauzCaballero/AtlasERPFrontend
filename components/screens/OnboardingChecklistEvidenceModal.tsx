'use client';

import { useEffect, useRef, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Modal } from '@/components/atlas/Modal';
import { b2bService } from '@/services/b2bService';
import { contentTypeDeArchivo, sha256DeArchivo, uploadWithTicket } from '@/services/filesService';
import type { ResourceRow } from '@/services/types';
import { BotonFormularioPapel } from '@/components/atlas/BotonFormularioPapel';
import { formularioEvidenciaRequisito } from '@/lib/formulariosPapel/operaciones';

interface Requisito {
  id: string;
  itemType: string;
  description: string;
  status: string;
  requiresEvidence?: boolean;
  hasEvidence?: boolean;
  evidenceUploadedAt?: string | null;
}

function etiquetaDeEstado(item: Requisito): string {
  const estado = item.status === 'COMPLETED' ? 'completado' : 'pendiente';
  if (item.hasEvidence) return `${estado}, con archivo`;
  if (item.requiresEvidence) return `${estado}, falta el archivo`;
  return estado;
}

/**
 * El archivo que respalda un requisito del caso de onboarding.
 *
 * Hasta el 2026-09-14 la pantalla prometía «requisitos legales» y los resolvía con un desplegable:
 * «NIT vigente» pasaba a COMPLETED sin que existiera ningún documento. Ahora el archivo va al
 * almacén de evidencia de Atlas (permiso firmado que emite AtlasBackend → subida directa desde el
 * navegador → registro tras verificar el objeto) y el backend no deja completar un requisito
 * documental sin él. Se abre desde la fila del caso, que es donde ya se sabe de qué comercio se habla.
 */
export function OnboardingChecklistEvidenceModal({
  caso,
  onClose,
  onDone,
}: Readonly<{ caso: ResourceRow | null; onClose: () => void; onDone: () => void }>) {
  const requisitos = (Array.isArray(caso?.checklistItems) ? caso!.checklistItems : []) as Requisito[];
  const archivo = useRef<HTMLInputElement>(null);
  const [itemId, setItemId] = useState<string>('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  useEffect(() => {
    setItemId(requisitos[0]?.id ?? '');
    setError(null);
    setHecho(null);
  }, [caso?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const elegido = requisitos.find((item) => item.id === itemId) ?? null;

  async function subir(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = archivo.current?.files?.[0];
    if (!caso?.id || !itemId || !file) return;
    const contentType = contentTypeDeArchivo(file);
    if (!contentType) {
      setError('Sólo se admiten PDF, JPEG o PNG.');
      return;
    }
    setOcupado(true);
    setError(null);
    setHecho(null);
    try {
      const caseId = String(caso.id);
      const [ticket, sha256] = await Promise.all([
        b2bService.checklistEvidenceUploadUrl(caseId, itemId, { contentType, sizeBytes: file.size }),
        sha256DeArchivo(file),
      ]);
      await uploadWithTicket(ticket, file);
      await b2bService.attachChecklistEvidence(caseId, itemId, { storageKey: ticket.storageKey, sha256, contentType, sizeBytes: file.size });
      setHecho(`Archivo registrado para «${elegido?.description ?? 'el requisito'}». Ya puedes marcarlo completado.`);
      if (archivo.current) archivo.current.value = '';
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo adjuntar el archivo.');
    } finally {
      setOcupado(false);
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
      width="md"
      icon="upload_file"
      title={`Evidencia de requisitos · ${String(caso?.tradeName ?? 'comercio')}`}
      description="Cada requisito documental (NIT, poderes, contratos) se cierra con su archivo. Elija el requisito, adjunte el PDF o la imagen y después márquelo completado desde la fila del caso."
    >
      <form className="space-y-3" onSubmit={subir} data-testid="form-evidencia-requisito">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ol className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600" aria-label="Pasos">
            <li><span className="font-bold text-slate-800">1.</span> Elija el requisito</li>
            <li><span className="font-bold text-slate-800">2.</span> Adjunte el archivo (PDF, JPEG o PNG hasta 15 MB)</li>
            <li><span className="font-bold text-slate-800">3.</span> Marque el requisito completado en la fila</li>
          </ol>
          <BotonFormularioPapel data-testid="papel-evidencia" formulario={formularioEvidenciaRequisito} />
        </div>
        <FormField tooltip="Requisito del checklist de alta sobre el que se actúa."
          kind="select"
          label="Requisito"
          name="checklistItemId"
          required
          value={itemId}
          onChange={(event) => setItemId(event.target.value)}
          options={requisitos.map((item) => ({
            value: item.id,
            label: `${item.description} (${item.itemType}) · ${etiquetaDeEstado(item)}`,
          }))}
        />
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-slate-700">Archivo</span>
          <input ref={archivo} type="file" accept="application/pdf,image/png,image/jpeg" className="text-xs" data-testid="campo-evidencia" required />
          {elegido?.requiresEvidence ? (
            <span className="mt-1 block text-[11px] text-slate-500">Este requisito es documental: no se puede dar por completado sin su archivo.</span>
          ) : null}
        </label>
        {error ? <InlineNotice tone="danger" title="No se pudo adjuntar">{error}</InlineNotice> : null}
        {hecho ? <InlineNotice tone="success" title="Listo">{hecho}</InlineNotice> : null}
        <div className="flex flex-wrap justify-end gap-2">
          {elegido?.hasEvidence ? (
            <AtlasButton variant="secondary" icon="visibility" onClick={ver} disabled={ocupado}>
              Ver archivo actual
            </AtlasButton>
          ) : null}
          <AtlasButton type="submit" icon="upload" loading={ocupado} disabled={!itemId} data-testid="btn-adjuntar-evidencia">
            Adjuntar archivo
          </AtlasButton>
        </div>
      </form>
    </Modal>
  );
}
