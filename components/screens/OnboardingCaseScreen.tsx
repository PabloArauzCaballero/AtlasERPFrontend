'use client';

import { useCallback, useState } from 'react';
import { toast } from '@/lib/toast';
import { b2bService } from '@/services/b2bService';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { OptionSelect } from '@/components/atlas/OptionSelect';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { useOptions } from '@/hooks/useOptions';
import { domainLoader } from '@/services/domains';
import { loadAccountsReadyForOnboarding, loadInternalUsers } from '@/services/optionLoaders';
import type { JsonObject } from '@/services/types';
import { newUuid } from '@/lib/uuid';
import { subirEvidenciaDeRequisito } from '@/services/onboardingEvidence';
import { RequisitoArchivoCampo } from '@/components/screens/RequisitoArchivoCampo';

interface ChecklistDraft { id: string; itemType: string; description: string; fijo?: boolean; archivo?: File | null; errorArchivo?: string | null }
const newChecklistItem = (id: string): ChecklistDraft => ({ id, itemType: 'LEGAL', description: '' });
/**
 * El NIT va siempre y no se quita ni se reescribe: sin NIT vigente ningún comercio se activa, y
 * hasta el 2026-09-16 el formulario abría con una línea vacía que el ejecutivo tenía que inventar.
 * Lo demás (poderes, matrícula, visita técnica…) se agrega debajo como requisito adicional.
 */
const REQUISITO_NIT: ChecklistDraft = { id: 'nit', itemType: 'LEGAL', description: 'NIT vigente del comercio', fijo: true };
const requisitosIniciales = (): ChecklistDraft[] => [REQUISITO_NIT];

interface OnboardingCaseScreenProps {
  /** Se llama tras crear el caso: la página vuelve a la cola. */
  onDone?: (() => void | Promise<void>) | undefined;
}

/**
 * Abrir un caso de onboarding. Sólo eso.
 *
 * Esta pantalla tenía además un panel para mover requisitos de un caso ya existente —eligiendo el
 * caso otra vez en un desplegable— y cuatro tarjetas de «métricas» del borrador. Mover un
 * requisito es una operación SOBRE un caso, y ahora vive en su fila, donde ya se sabe de qué
 * comercio se habla. Aquí queda lo único que no tiene fila todavía: el alta.
 *
 * Todo lo que se elige está catalogado, así que se ELIGE, no se teclea: un ejecutivo comercial no
 * se sabe un uuid, y uno mal copiado sólo produce un 500 o un caso colgado de otra cuenta.
 */
export function OnboardingCaseScreen({ onDone }: OnboardingCaseScreenProps = {}) {
  const [items, setItems] = useState<ChecklistDraft[]>(requisitosIniciales);
  const accounts = useOptions(loadAccountsReadyForOnboarding);
  const owners = useOptions(loadInternalUsers);
  /* Tipos de requisito del backend: la lista copiada aquí no tenía COMPLIANCE. */
  const tiposDeRequisito = useOptions(domainLoader('domain:crm.checklistItemType'));
  const createMutation = useAtlasMutation(useCallback((payload: JsonObject) => b2bService.createOnboardingCase(payload), []));

  const [subiendo, setSubiendo] = useState(false);

  function updateItem(id: string, key: 'itemType' | 'description', value: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  }

  function elegirArchivo(id: string, archivo: File | null, errorArchivo: string | null) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, archivo, errorArchivo } : item)));
  }

  /**
   * Sube el archivo de cada requisito que lo trae, ya con el caso creado. Si uno falla NO se
   * revierte nada —el caso vale—, se dice cuál y que se reintenta desde la fila.
   */
  async function subirArchivos(caso: JsonObject, borradores: ChecklistDraft[]) {
    const creados = (Array.isArray(caso.checklistItems) ? caso.checklistItems : []) as Array<{ id?: string; itemType?: string; description?: string }>;
    const sinUsar = [...creados];
    const fallidos: string[] = [];
    for (const borrador of borradores) {
      const posicion = sinUsar.findIndex((c) => c.itemType === borrador.itemType && c.description === borrador.description);
      const creado = posicion >= 0 ? sinUsar.splice(posicion, 1)[0] : undefined;
      if (!borrador.archivo) continue;
      try {
        if (!creado?.id) throw new Error('El requisito no quedó registrado.');
        await subirEvidenciaDeRequisito(String(caso.id), creado.id, borrador.archivo);
      } catch {
        fallidos.push(borrador.description);
      }
    }
    if (fallidos.length) toast.warning('El caso se abrió, pero faltan archivos', `No se pudo subir: ${fallidos.join(', ')}. Súbalos desde la fila del caso, con «Adjuntar archivo de un requisito».`);
  }

  /**
   * El contrato del alta es el que ya firmó la oportunidad ganada: no se pacta aquí. Se cuelga
   * solo el vigente de la cuenta para que la comisión (MDR) tenga de dónde colgar. Si no hay,
   * o falla, el caso sigue: la activación vuelve a buscar el vigente por su cuenta.
   */
  async function colgarContratoVigente(caso: JsonObject) {
    try {
      const versiones = await b2bService.listCaseContractOptions(String(caso.id));
      const vigente = versiones.find((version) => version.vigente);
      if (vigente) await b2bService.assignCaseContract(String(caso.id), { contractVersionId: String(vigente.id) });
    } catch { /* la activación lo resuelve */ }
  }

  async function createCase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const creado = await createMutation.execute({
        accountId: String(data.get('accountId') ?? ''),
        ownerUserId: String(data.get('ownerUserId') ?? ''),
        checklistItems: items.map(({ itemType, description }) => ({ itemType, description })),
      });
      avisarCarpetaDelComercio(creado.carpetaDelComercio);
      setSubiendo(true);
      await colgarContratoVigente(creado);
      await subirArchivos(creado, items);
      form.reset();
      setItems(requisitosIniciales());
      await onDone?.();
    } catch { /* controlled */ } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader breadcrumbs={[{ label: 'CRM' }, { label: 'Onboarding', href: '/operaciones/crm/onboarding' }, { label: 'Nuevo caso' }]} title="Nuevo caso de onboarding" description="El comercio, quién responde por el alta, y los requisitos que habrá que cerrar antes de activarlo." />
      {createMutation.error ? <InlineNotice tone="danger">{createMutation.error}</InlineNotice> : null}

      <form id="create-onboarding-form" onSubmit={createCase} className="space-y-4">
        <Panel data-tutorial-id="onboarding-checklist" title="El comercio y su responsable" icon="domain">
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            <FormField tooltip="Cuenta B2B del comercio sobre la que se trabaja." kind="select" label="Comercio" name="accountId" required options={[{ label: '— Elija el comercio —', value: '' }, ...accounts]} hint="Sólo comercios con una oportunidad ganada y sin caso abierto: el resto aún tiene pasos previos por cerrar." />
            <FormField tooltip="Ejecutivo comercial que responde por esta cuenta; recibe las tareas y los avisos." kind="select" label="Ejecutivo responsable" name="ownerUserId" required options={[{ label: '— Elija responsable —', value: '' }, ...owners]} hint="Quien responde por el alta ante Legal y Operaciones." />
          </div>
        </Panel>
        <Panel
          title="Requisitos del expediente"
          description="El NIT vigente va siempre. Agregue lo demás que haga falta cerrar (poderes, matrícula, visita técnica…) y adjunte aquí mismo el archivo de cada uno. Mientras quede uno pendiente, el comercio no se activa."
          icon="fact_check"
          action={<AtlasButton variant="secondary" icon="add" onClick={() => setItems((current) => [...current, newChecklistItem(newUuid())])}>Agregar requisito adicional</AtlasButton>}
        >
          <div className="space-y-2">
            {items.map((item, index) => item.fijo ? (
              <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3" data-testid="requisito-nit">
                <Icon name="verified" className="text-[18px] text-emerald-700" />
                <span className="text-xs font-bold text-slate-800">{item.description}</span>
                <span className="rounded bg-white px-2 py-0.5 text-[11px] text-slate-600">Legal · obligatorio</span>
                <div className="basis-full">
                  <RequisitoArchivoCampo label="Archivo del NIT vigente" archivo={item.archivo ?? null} error={item.errorArchivo ?? null} disabled={subiendo} onChange={(file, error) => elegirArchivo(item.id, file, error)} />
                </div>
              </div>
            ) : (
              <div key={item.id} className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="grid gap-2 grid-cols-1 md:grid-cols-[160px_minmax(0,1fr)_36px]">
                {/* Mientras el dominio no llega, el valor de la línea se sigue ofreciendo: sin él el
                    select se vería vacío aunque el requisito ya lleve LEGAL. */}
                <OptionSelect
                  name={`itemType-${index + 1}`}
                  ariaLabel={`Tipo del requisito adicional ${index}`}
                  compact
                  value={item.itemType}
                  onChange={(value) => updateItem(item.id, 'itemType', value)}
                  options={tiposDeRequisito.some((option) => option.value === item.itemType) ? tiposDeRequisito : [...tiposDeRequisito, { value: item.itemType, label: item.itemType }]}
                />
                <input className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs" value={item.description} required placeholder={`Descripción del requisito adicional ${index}`} onChange={(event) => updateItem(item.id, 'description', event.target.value)} />
                <button type="button" className="grid h-9 place-items-center rounded text-red-600 hover:bg-red-50" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} aria-label="Quitar requisito">
                  <Icon name="delete" className="text-[18px]" />
                </button>
              </div>
              <RequisitoArchivoCampo label={`Archivo del requisito adicional ${index}`} archivo={item.archivo ?? null} error={item.errorArchivo ?? null} disabled={subiendo} onChange={(file, error) => elegirArchivo(item.id, file, error)} />
              </div>
            ))}
          </div>
        </Panel>
        <div className="flex justify-end">
          <AtlasButton icon="send" type="submit" loading={createMutation.isLoading || subiendo}>{subiendo ? 'Subiendo archivos…' : 'Abrir caso de onboarding'}</AtlasButton>
        </div>
      </form>
    </div>
  );
}

/**
 * Qué pasó con la carpeta del comercio en Archivos, que nace con el caso.
 *
 * El caso se abre aunque la carpeta no se pueda crear —casi siempre porque a la cuenta le falta el
 * NIT o un contacto con correo—, así que hay que decirlo: sin carpeta, el contrato firmado que se
 * suba después no aparece en Archivos.
 */
const MOTIVO_SIN_CARPETA: Record<string, string> = {
  SIN_CORREO_DE_CONTACTO: 'La cuenta no tiene ningún contacto con correo. Añade uno en la ficha de la cuenta.',
  DATOS_DE_LA_CUENTA_INVALIDOS: 'A la cuenta le falta el NIT (7 a 15 dígitos) o la razón social. Complétalos en la ficha de la cuenta.',
  CUENTA_ENLAZADA_A_OTRA_FICHA: 'El NIT de esta cuenta ya pertenece a la ficha de otra cuenta del ERP. Revisa si la cuenta está duplicada.',
  ATLAS_NO_RESPONDIO: 'Atlas no respondió. Se volverá a intentar al subir el primer documento del contrato.',
  CUENTA_NO_ENCONTRADA: 'No se encontró la cuenta.',
};

function avisarCarpetaDelComercio(carpeta: unknown): void {
  const resultado = (carpeta ?? null) as { expedienteId?: string | null; created?: boolean; reason?: string | null } | null;
  if (!resultado) return;
  if (resultado.expedienteId) {
    toast.success('Carpeta del comercio lista', resultado.created ? 'Se abrió su ficha y su carpeta en Archivos, con «documentos».' : 'Su carpeta en Archivos ya existía y queda enlazada.');
    return;
  }
  toast.warning('El caso se abrió, pero el comercio no tiene carpeta en Archivos', MOTIVO_SIN_CARPETA[resultado.reason ?? ''] ?? 'No se pudo crear la carpeta del comercio.');
}
