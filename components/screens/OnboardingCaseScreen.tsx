'use client';

import { useCallback, useEffect, useState } from 'react';
import { b2bService } from '@/services/b2bService';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { useOptions } from '@/hooks/useOptions';
import type { Option } from '@/services/optionLoaders';
import { loadB2BAccounts, loadChecklistItems, loadInternalUsers, loadOnboardingCases } from '@/services/optionLoaders';
import type { JsonObject } from '@/services/types';

interface ChecklistDraft { id: string; itemType: string; description: string }
const newChecklistItem = (id: string): ChecklistDraft => ({ id, itemType: 'LEGAL', description: '' });

export function OnboardingCaseScreen() {
  const [items, setItems] = useState<ChecklistDraft[]>([newChecklistItem('item-0')]);
  const [caseId, setCaseId] = useState('');
  /*
   * Todo lo que aqui se elige esta catalogado, asi que se ELIGE, no se teclea. Antes eran cuatro
   * campos de texto pidiendo uuids: un ejecutivo comercial no los conoce, y un uuid mal copiado
   * solo produce un 500 o un caso colgado de una cuenta que no era.
   */
  const accounts = useOptions(loadB2BAccounts);
  const owners = useOptions(loadInternalUsers);
  const [cases, setCases] = useState<Option[]>([]);
  const [checklistItems, setChecklistItems] = useState<Option[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');

  const refreshCases = useCallback(() => { loadOnboardingCases().then(setCases).catch(() => setCases([])); }, []);
  useEffect(refreshCases, [refreshCases]);

  /* Los requisitos dependen del caso elegido: sin caso no hay item que completar. */
  useEffect(() => {
    let cancelled = false;
    loadChecklistItems(selectedCaseId)
      .then((result) => { if (!cancelled) setChecklistItems(result); })
      .catch(() => { if (!cancelled) setChecklistItems([]); });
    return () => { cancelled = true; };
  }, [selectedCaseId]);

  /* Al crear un caso queda elegido en el panel de la derecha, que es el siguiente paso natural. */
  useEffect(() => { if (caseId) { setSelectedCaseId(caseId); refreshCases(); } }, [caseId, refreshCases]);
  const createMutation = useAtlasMutation(useCallback((payload: JsonObject) => b2bService.createOnboardingCase(payload), []));
  const checklistMutation = useAtlasMutation(useCallback(({ id, body }: { id: string; body: JsonObject }) => b2bService.updateChecklist(id, body), []));

  function updateItem(id: string, key: 'itemType' | 'description', value: string) { setItems((current) => current.map((item) => item.id === id ? { ...item, [key]: value } : item)); }

  async function createCase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const result = await createMutation.execute({ accountId: String(form.get('accountId') ?? ''), ownerUserId: String(form.get('ownerUserId') ?? ''), checklistItems: items.map(({ itemType, description }) => ({ itemType, description })) });
      if (result.id) setCaseId(String(result.id));
    } catch { /* controlled */ }
  }

  async function updateChecklist(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try { await checklistMutation.execute({ id: String(form.get('caseId') ?? ''), body: { checklistItemId: String(form.get('checklistItemId') ?? ''), status: String(form.get('status') ?? 'COMPLETED') } }); } catch { /* controlled */ }
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader breadcrumbs={[{ label: 'CRM' }, { label: 'Onboarding' }]} title="Casos de onboarding" description="Coordine requisitos legales, operativos y técnicos antes de activar un comercio en ATLAS." actions={<><AtlasButton variant="secondary" icon="share">Exportar caso</AtlasButton><AtlasButton icon="send" type="submit" form="create-onboarding-form" loading={createMutation.isLoading}>Enviar revisión</AtlasButton></>} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Caso actual" value={caseId ? 'CREADO' : 'BORRADOR'} detail={caseId ? caseId.slice(0, 18) : 'Aún no persistido'} icon="fact_check" /><MetricCard label="Requisitos" value={items.length} detail="Configurados en el borrador" icon="checklist" tone="teal" /><MetricCard label="Legal" value={items.filter((item) => item.itemType === 'LEGAL').length} detail="Documentación y cumplimiento" icon="gavel" tone="purple" /><MetricCard label="Bloqueos" value="0" detail="Sujeto a validación backend" icon="block" tone="amber" /></div>
      {(createMutation.error || checklistMutation.error) ? <InlineNotice tone="danger">{createMutation.error ?? checklistMutation.error}</InlineNotice> : null}
      {(createMutation.status === 'success' || checklistMutation.status === 'success') ? <InlineNotice tone="success">La operación de onboarding fue registrada correctamente.</InlineNotice> : null}

      <div className="grid items-start gap-4 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1.5fr)_340px]">
        <div className="space-y-4">
          <Panel data-tutorial-id="onboarding-checklist" title="Resumen de la cuenta" icon="domain"><form id="create-onboarding-form" onSubmit={createCase} className="grid gap-3 md:grid-cols-2"><FormField kind="select" label="Comercio" name="accountId" required options={[{ label: '— Elija el comercio —', value: '' }, ...accounts]} hint="Cuentas B2B registradas en el directorio." /><FormField kind="select" label="Ejecutivo responsable" name="ownerUserId" required options={[{ label: '— Elija responsable —', value: '' }, ...owners]} hint="Quien responde por el alta ante Legal y Operaciones." /></form></Panel>
          <Panel title="Requirement Checklist" description="Defina al menos un requisito verificable." icon="fact_check" action={<AtlasButton variant="secondary" icon="add" onClick={() => setItems((current) => [...current, newChecklistItem(crypto.randomUUID())])}>Agregar requisito</AtlasButton>}>
            <div className="space-y-2">{items.map((item, index) => <div key={item.id} className="grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[160px_minmax(0,1fr)_36px]"><select className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs" value={item.itemType} onChange={(event) => updateItem(item.id, 'itemType', event.target.value)}><option>LEGAL</option><option>OPERATIONS</option><option>TECHNICAL</option><option>FINANCE</option></select><input className="h-9 rounded-md border border-slate-300 bg-white px-3 text-xs" value={item.description} required placeholder={`Descripción del requisito ${index + 1}`} onChange={(event) => updateItem(item.id, 'description', event.target.value)} /><button type="button" disabled={items.length === 1} className="grid h-9 place-items-center rounded text-red-600 hover:bg-red-50 disabled:opacity-30" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}><Icon name="delete" className="text-[18px]" /></button></div>)}</div>
          </Panel>
          <div className="flex justify-end"><AtlasButton icon="send" type="submit" form="create-onboarding-form" loading={createMutation.isLoading}>Crear caso de onboarding</AtlasButton></div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <Panel title="Checklist Update" description="Complete o bloquee un requisito existente." icon="task_alt"><form onSubmit={updateChecklist} className="space-y-3"><FormField kind="select" label="Caso" name="caseId" required value={selectedCaseId} onChange={(event) => setSelectedCaseId(event.target.value)} options={[{ label: '— Elija el caso —', value: '' }, ...cases]} hint="El estado y los pendientes salen del propio caso." /><FormField kind="select" label="Requisito" name="checklistItemId" required options={[{ label: selectedCaseId ? '— Elija el requisito —' : '— Elija primero un caso —', value: '' }, ...checklistItems]} /><FormField kind="select" label="Estado" name="status" options={[{ label: 'Completado', value: 'COMPLETED' }, { label: 'Eximido', value: 'WAIVED' }, { label: 'Bloqueado', value: 'BLOCKED' }, { label: 'Pendiente', value: 'PENDING' }]} /><AtlasButton className="w-full" type="submit" icon="check" loading={checklistMutation.isLoading}>Actualizar requisito</AtlasButton></form></Panel>
          <Panel title="Registro de auditoría" icon="history_edu"><div className="space-y-4 text-xs"><AuditRow icon="edit" title="Caso preparado" detail="Los requisitos se validan antes de persistir." /><AuditRow icon="policy" title="Separación de funciones" detail="Legal y Operaciones comparten el flujo." /><AuditRow icon="verified" title="Activación separada" detail="La activación se ejecuta en la vista dedicada." /></div></Panel>
          <StatusPill tone={caseId ? 'warning' : 'neutral'}>{caseId ? 'IN_PROGRESS' : 'DRAFT'}</StatusPill>
        </aside>
      </div>
    </div>
  );
}

function AuditRow({ icon, title, detail }: { icon: string; title: string; detail: string }) { return <div className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-100"><Icon name={icon} className="text-[15px]" /></span><div><b>{title}</b><p className="mt-0.5 text-[11px] leading-4 text-slate-500">{detail}</p></div></div>; }
