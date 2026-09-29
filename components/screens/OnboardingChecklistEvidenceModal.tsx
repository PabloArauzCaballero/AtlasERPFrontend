'use client';

import { useEffect, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FileDropField } from '@/components/atlas/FileDropField';
import { StoredFilePreview } from '@/components/atlas/FilePreview';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Modal } from '@/components/atlas/Modal';
import { b2bService } from '@/services/b2bService';
import { contentTypeDeArchivo, sha256DeArchivo, TIPOS_DE_EVIDENCIA, uploadWithTicket } from '@/services/filesService';
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

function requisitosDe(caso: ResourceRow | null | undefined): Requisito[] {
  return (Array.isArray(caso?.checklistItems) ? caso!.checklistItems : []) as Requisito[];
}

/** El requisito trae si tiene archivo y si lo exige: sin eso no se puede avisar de un reemplazo. */
function sabeSiTieneArchivo(item: Requisito): boolean {
  return typeof item.hasEvidence === 'boolean' && typeof item.requiresEvidence === 'boolean';
}

/** El primero documental sin archivo, o el primero. */
function preseleccion(items: Requisito[]): string {
  return items.find((item) => item.requiresEvidence && !item.hasEvidence)?.id ?? items[0]?.id ?? '';
}

function fechaLegible(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
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
 * almacén sin registrar y un «Listo» que nunca llegaba. El archivo se elige con `FileDropField`
 * (se arrastra o se elige, y se ve antes de adjuntarlo): el selector del navegador sale en su
 * idioma («Choose File»), sin tamaño y sin vista previa.
 *
 * Un requisito guarda UN archivo: el backend pisa el anterior al registrar otro. Por eso, si ya
 * tiene uno, se dice antes de elegir y el botón pasa a «Reemplazar archivo». Los requisitos se leen
 * del caso que devuelve el propio registro, no de la fila con la que se abrió el modal: esa fila es
 * de antes de subir, y con ella el requisito recién respaldado seguía diciendo «falta el archivo» y
 * el segundo archivo reemplazaba al primero sin aviso (Pablo, 2026-09-28).
 */
export function OnboardingChecklistEvidenceModal({
  caso,
  onClose,
  onDone,
}: Readonly<{ caso: ResourceRow | null; onClose: () => void; onDone: () => void }>) {
  /* El caso tal como lo devolvió el servidor (detalle o último registro); `null` = el de la fila. */
  const [casoActual, setCasoActual] = useState<ResourceRow | null>(null);
  const vigente = casoActual ?? caso;
  const requisitos = requisitosDe(vigente);
  const [itemId, setItemId] = useState<string>('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [fase, setFase] = useState<Fase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [viendoActual, setViendoActual] = useState(false);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  /*
   * La cola de onboarding de un servidor anterior al 2026-09-29 no dice si cada requisito ya tiene
   * archivo. Con esa fila el modal preseleccionaba el primero y dejaba «Adjuntar» un segundo archivo
   * que pisaba al primero sin aviso. Si falta el dato, se pide el caso completo antes de elegir.
   */
  useEffect(() => {
    setArchivo(null);
    setFase(null);
    setError(null);
    setHecho(null);
    setViendoActual(false);
    setCasoActual(null);
    const items = requisitosDe(caso);
    if (!caso?.id || items.every(sabeSiTieneArchivo)) {
      setCargandoDetalle(false);
      setItemId(preseleccion(items));
      return;
    }
    let vigenteAun = true;
    setItemId('');
    setCargandoDetalle(true);
    b2bService
      .getOnboardingCase(String(caso.id))
      .then((detalle) => {
        if (!vigenteAun) return;
        setCasoActual(detalle);
        setItemId(preseleccion(requisitosDe(detalle)));
      })
      .catch((err: unknown) => {
        if (vigenteAun) setError(err instanceof Error ? `No se pudo saber qué requisitos ya tienen archivo: ${err.message}` : 'No se pudo saber qué requisitos ya tienen archivo.');
      })
      .finally(() => {
        if (vigenteAun) setCargandoDetalle(false);
      });
    return () => {
      vigenteAun = false;
    };
  }, [caso]);

  const elegido = requisitos.find((item) => item.id === itemId) ?? null;
  const ocupado = fase !== null;
  const reemplaza = Boolean(elegido?.hasEvidence);
  /* Sin saber si ya hay archivo no se adjunta: podría reemplazar uno sin avisar. */
  const archivoConocido = Boolean(elegido && sabeSiTieneArchivo(elegido));

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
    if (!caso?.id || !itemId || !archivo || ocupado || !archivoConocido) return;
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
      const actualizado = await b2bService.attachChecklistEvidence(caseId, itemId, { storageKey: ticket.storageKey, sha256, contentType, sizeBytes: archivo.size });
      if (Array.isArray(actualizado?.checklistItems)) setCasoActual(actualizado);
      setHecho(
        reemplaza
          ? `«${archivo.name}» reemplazó al archivo anterior de «${elegido?.description ?? 'el requisito'}».`
          : `«${archivo.name}» quedó registrado para «${elegido?.description ?? 'el requisito'}». Ya puede marcarlo completado desde la fila.`,
      );
      setArchivo(null);
      // La vista del archivo «actual» enseñaría el anterior: se cierra y se vuelve a pedir al abrirla.
      setViendoActual(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo adjuntar el archivo.');
    } finally {
      setFase(null);
    }
  }

  /*
   * El archivo actual se ve AQUÍ, debajo del selector, en vez de sólo en otra pestaña: al decidir
   * si hay que reemplazarlo lo que importa es compararlo con el que se va a subir.
   */
  async function abrirEnPestana() {
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
        {cargandoDetalle ? (
          <p role="status" className="text-[11px] text-slate-600" data-testid="evidencia-cargando">Consultando qué requisitos ya tienen archivo…</p>
        ) : null}
        <FormField tooltip="Requisito del checklist de alta sobre el que se actúa."
          kind="select"
          label="Requisito"
          name="checklistItemId"
          required
          disabled={ocupado || cargandoDetalle}
          value={itemId}
          onChange={(event) => { setItemId(event.target.value); setHecho(null); setViendoActual(false); }}
          options={requisitos.map((item) => ({ value: item.id, label: `${item.description} (${item.itemType}) · ${etiquetaDeEstado(item)}` }))}
        />
        {reemplaza ? (
          <InlineNotice tone="warning" title="Este requisito ya tiene un archivo">
            {`Se subió${fechaLegible(elegido?.evidenceUploadedAt) ? ` el ${fechaLegible(elegido?.evidenceUploadedAt)}` : ''}. Cada requisito guarda un solo archivo: si adjunta otro, reemplazará al anterior. Use «Ver archivo actual» para compararlos antes.`}
          </InlineNotice>
        ) : null}
        <FileDropField
          label="Archivo"
          tooltip="El documento que prueba el requisito elegido: el NIT, el poder o el contrato escaneado."
          accept={TIPOS_DE_EVIDENCIA}
          maxBytes={TAMANO_MAXIMO}
          files={archivo ? [archivo] : []}
          onFilesChange={(files) => elegirArchivo(files[0] ?? null)}
          status={ocupado && fase ? TEXTO_FASE[fase] : undefined}
          disabled={ocupado}
          hint={elegido?.requiresEvidence ? 'Este requisito es documental: no se puede dar por completado sin su archivo.' : undefined}
          data-testid="campo-evidencia"
        />
        {elegido?.hasEvidence && viendoActual ? (
          <div className="overflow-hidden rounded-lg border border-slate-200" data-testid="vista-evidencia-actual">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
              <span className="text-[11px] font-bold text-slate-700">Archivo actual del requisito</span>
              <button type="button" onClick={abrirEnPestana} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#006a61] hover:underline">
                <Icon name="open_in_new" className="text-[14px]" />
                Abrir en otra pestaña
              </button>
            </div>
            <StoredFilePreview cargar={() => b2bService.checklistEvidenceUrl(String(caso?.id ?? ''), itemId)} nombre={`evidencia-${itemId}`} />
          </div>
        ) : null}
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
            <AtlasButton variant="secondary" icon={viendoActual ? 'visibility_off' : 'visibility'} onClick={() => setViendoActual((actual) => !actual)} disabled={ocupado} aria-expanded={viendoActual}>
              {viendoActual ? 'Ocultar archivo actual' : 'Ver archivo actual'}
            </AtlasButton>
          ) : null}
          <AtlasButton type="submit" icon={reemplaza ? 'swap_horiz' : 'upload'} loading={ocupado} disabled={!itemId || !archivo || cargandoDetalle || !archivoConocido} data-testid="btn-adjuntar-evidencia">
            {ocupado ? (reemplaza ? 'Reemplazando…' : 'Adjuntando…') : reemplaza ? 'Reemplazar archivo' : 'Adjuntar archivo'}
          </AtlasButton>
        </div>
      </form>
    </Modal>
  );
}
