'use client';

import { useCallback, useState } from 'react';
import { b2bService } from '@/services/b2bService';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { useOptions } from '@/hooks/useOptions';
import { loadB2BAccounts, loadInternalUsers } from '@/services/optionLoaders';
import type { JsonObject } from '@/services/types';

interface ChecklistDraft { id: string; itemType: string; description: string }
const newChecklistItem = (id: string): ChecklistDraft => ({ id, itemType: 'LEGAL', description: '' });

interface OnboardingCaseScreenProps {
  /** Dentro de una pestaña: sin cabecera de pantalla, que la pone la vista que lo contiene. */
  embedded?: boolean | undefined;
  /** Se llama tras crear el caso: la vista que lo contiene recarga la cola y vuelve a ella. */
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
export function OnboardingCaseScreen({ embedded = false, onDone }: OnboardingCaseScreenProps = {}) {
  const [items, setItems] = useState<ChecklistDraft[]>([newChecklistItem('item-0')]);
  const accounts = useOptions(loadB2BAccounts);
  const owners = useOptions(loadInternalUsers);
  const createMutation = useAtlasMutation(useCallback((payload: JsonObject) => b2bService.createOnboardingCase(payload), []));

  function updateItem(id: string, key: 'itemType' | 'description', value: string) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  }

  async function createCase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await createMutation.execute({
        accountId: String(data.get('accountId') ?? ''),
        ownerUserId: String(data.get('ownerUserId') ?? ''),
        checklistItems: items.map(({ itemType, description }) => ({ itemType, description })),
      });
      form.reset();
      setItems([newChecklistItem('item-0')]);
      await onDone?.();
    } catch { /* controlled */ }
  }

  return (
    <div className="space-y-5">
      {embedded ? (
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-900">Nuevo caso de onboarding</h2>
          <p className="mt-0.5 text-xs text-slate-500">El comercio, quién responde por el alta, y los requisitos que habrá que cerrar antes de activarlo.</p>
        </div>
      ) : (
        <WorkspaceHeader breadcrumbs={[{ label: 'CRM' }, { label: 'Onboarding' }]} title="Nuevo caso de onboarding" description="El comercio, quién responde por el alta, y los requisitos que habrá que cerrar antes de activarlo." />
      )}
      {createMutation.error ? <InlineNotice tone="danger">{createMutation.error}</InlineNotice> : null}

      <form id="create-onboarding-form" onSubmit={createCase} className="space-y-4">
        <Panel data-tutorial-id="onboarding-checklist" title="El comercio y su responsable" icon="domain">
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            <FormField kind="select" label="Comercio" name="accountId" required options={[{ label: '— Elija el comercio —', value: '' }, ...accounts]} hint="Cuentas B2B registradas en el directorio." />
            <FormField kind="select" label="Ejecutivo responsable" name="ownerUserId" required options={[{ label: '— Elija responsable —', value: '' }, ...owners]} hint="Quien responde por el alta ante Legal y Operaciones." />
          </div>
        </Panel>
        <Panel
          title="Requisitos del expediente"
          description="Al menos uno, verificable. Mientras quede uno pendiente, el comercio no se activa."
          icon="fact_check"
          action={<AtlasButton variant="secondary" icon="add" onClick={() => setItems((current) => [...current, newChecklistItem(crypto.randomUUID())])}>Agregar requisito</AtlasButton>}
        >
          <div className="space-y-2">
            {items.map((item, index) => (
              <div key={item.id} className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 grid-cols-1 md:grid-cols-[160px_minmax(0,1fr)_36px]">
                <select className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs" value={item.itemType} onChange={(event) => updateItem(item.id, 'itemType', event.target.value)}>
                  <option>LEGAL</option><option>OPERATIONS</option><option>TECHNICAL</option><option>FINANCE</option>
                </select>
                <input className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs" value={item.description} required placeholder={`Descripción del requisito ${index + 1}`} onChange={(event) => updateItem(item.id, 'description', event.target.value)} />
                <button type="button" disabled={items.length === 1} className="grid h-9 place-items-center rounded text-red-600 hover:bg-red-50 disabled:opacity-30" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} aria-label="Quitar requisito">
                  <Icon name="delete" className="text-[18px]" />
                </button>
              </div>
            ))}
          </div>
        </Panel>
        <div className="flex justify-end">
          <AtlasButton icon="send" type="submit" loading={createMutation.isLoading}>Abrir caso de onboarding</AtlasButton>
        </div>
      </form>
    </div>
  );
}
