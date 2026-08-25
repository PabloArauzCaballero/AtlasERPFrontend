'use client';

import { useCallback, useEffect, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { formDataToPayload } from '@/lib/formPayload';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import type { JsonObject, ResourceRow } from '@/services/types';
import type { ActionField } from './StructuredActionForm';

export interface WorkspaceAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  submitLabel: string;
  submitIcon?: string;
  fields: ActionField[];
  onSubmit: (payload: JsonObject) => Promise<ResourceRow>;
}

interface MultiActionWorkspaceProps {
  moduleLabel: string;
  title: string;
  description: string;
  actions: WorkspaceAction[];
  sideTitle?: string;
  sideItems?: Array<{ label: string; detail: string; icon: string }>;
}

export function MultiActionWorkspace(props: MultiActionWorkspaceProps) {
  return (
    <div className="space-y-5">
      <WorkspaceHeader breadcrumbs={[{ label: props.moduleLabel }, { label: props.title }]} title={props.title} description={props.description} />
      <div className="grid items-start gap-4 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_300px]">
        <div data-tutorial-id="workspace-action-cards" className="grid gap-4 lg:grid-cols-2">
          {props.actions.map((action) => <ActionCard key={action.id} action={action} />)}
        </div>
        <aside data-tutorial-id="workspace-sequence" className="space-y-4 xl:sticky xl:top-20">
          <Panel title={props.sideTitle ?? 'Secuencia recomendada'} icon="account_tree">
            <ol className="space-y-4">
              {(props.sideItems ?? props.actions.map((action) => ({ label: action.title, detail: action.description, icon: action.icon }))).map((item, index) => (
                <li className="flex gap-3" key={item.label}>
                  <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#006a61] text-[10px] font-bold text-white">{index + 1}</span>
                  <div><p className="text-xs font-bold text-slate-800">{item.label}</p><p className="mt-0.5 text-[11px] leading-4 text-slate-500">{item.detail}</p></div>
                </li>
              ))}
            </ol>
          </Panel>
          {/* Ya no se teclean identificadores: todo lo relacionado se elige de su catálogo. El aviso
              pedía «utilice UUID existentes», que era la instrucción de cuando había que copiarlos a mano. */}
          <InlineNotice tone="info" title="Integridad referencial">Lo que se relaciona con otra entidad se elige de su lista. El backend vuelve a validar la referencia y revierte la operación si no es válida.</InlineNotice>
        </aside>
      </div>
    </div>
  );
}

function ActionCard({ action }: { action: WorkspaceAction }) {
  const [showResult, setShowResult] = useState(false);
  const mutationFunction = useCallback((payload: JsonObject) => action.onSubmit(payload), [action]);
  const mutation = useAtlasMutation(mutationFunction);
  const definitions = action.fields.map((field) => ({ name: field.name, valueKind: field.valueKind, optional: field.optional }));

  const [dynamicOptions, setDynamicOptions] = useState<Record<string, Array<{ label: string; value: string }>>>({});
  useEffect(() => {
    let cancelled = false;
    action.fields.filter((field) => field.optionsLoader).forEach((field) => {
      field.optionsLoader!()
        .then((options) => { if (!cancelled) setDynamicOptions((current) => ({ ...current, [field.name]: options })); })
        .catch(() => { /* select queda vacío si falla */ });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowResult(false);
    try {
      await mutation.execute(formDataToPayload(new FormData(event.currentTarget), definitions));
      setShowResult(true);
      event.currentTarget.reset();
    } catch { /* controlled by mutation state */ }
  }

  return (
    <Panel title={action.title} description={action.description} icon={action.icon} className="h-fit">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          {action.fields.map((field) => {
            const span = field.span === 2 || field.span === 3 ? 'sm:col-span-2' : '';
            if (field.type === 'select') return <FormField key={field.name} kind="select" name={field.name} label={field.label} required={field.required} defaultValue={field.defaultValue} hint={field.hint} options={field.options ?? dynamicOptions[field.name] ?? []} className={span} />;
            if (field.type === 'textarea') return <FormField key={field.name} kind="textarea" name={field.name} label={field.label} required={field.required} defaultValue={field.defaultValue} placeholder={field.placeholder} hint={field.hint} className={span} />;
            return <FormField key={field.name} name={field.name} label={field.label} required={field.required} type={field.type ?? 'text'} defaultValue={field.defaultValue} placeholder={field.placeholder} hint={field.hint} className={span} />;
          })}
        </div>
        {mutation.error ? <InlineNotice tone="danger">{mutation.error}</InlineNotice> : null}
        {showResult ? <InlineNotice tone="success">Registro creado correctamente.</InlineNotice> : null}
        <div className="flex justify-end border-t border-slate-100 pt-3"><AtlasButton type="submit" icon={action.submitIcon ?? 'save'} loading={mutation.isLoading}>{action.submitLabel}</AtlasButton></div>
      </form>
    </Panel>
  );
}
