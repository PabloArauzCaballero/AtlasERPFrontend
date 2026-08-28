'use client';

import { useCallback, useEffect, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { Icon } from '@/components/atlas/Icon';
import { fieldSpanClasses } from '@/lib/formLayout';
import { formDataToPayload } from '@/lib/formPayload';
import { ActionFieldControl, payloadDefinitions } from './ActionFieldControl';
import { toast } from '@/lib/toast';
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
  // Cada acción es un paso independiente; se muestran como pestañas para no amontonar varios
  // formularios en una sola vista. Cada tarjeta es su propio <form>, así que ocultar las
  // inactivas no afecta el envío de la activa.
  const [active, setActive] = useState(0);
  const multiple = props.actions.length > 1;
  return (
    <div className="space-y-5">
      <WorkspaceHeader breadcrumbs={[{ label: props.moduleLabel }, { label: props.title }]} title={props.title} description={props.description} />
      {multiple ? (
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {props.actions.map((action, index) => (
            <button
              key={action.id}
              type="button"
              onClick={() => setActive(index)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold transition ${index === active ? 'bg-primary-wash text-primary' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
            >
              <Icon name={action.icon} className="text-[16px]" />
              {action.title}
            </button>
          ))}
        </div>
      ) : null}
      <div data-tutorial-id="workspace-action-cards">
        {props.actions.map((action, index) => (
          <div key={action.id} className={multiple && index !== active ? 'hidden' : ''}>
            <ActionCard action={action} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionCard({ action }: { action: WorkspaceAction }) {
  const [showResult, setShowResult] = useState(false);
  const mutationFunction = useCallback((payload: JsonObject) => action.onSubmit(payload), [action]);
  const mutation = useAtlasMutation(mutationFunction);
  const definitions = payloadDefinitions(action.fields);
  const spanClasses = fieldSpanClasses(action.fields.map((field) => field.span), { maxColumns: 2 });

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
    const form = event.currentTarget;
    try {
      await mutation.execute(formDataToPayload(new FormData(form), definitions));
      setShowResult(true);
      form.reset();
      toast.success('Operación registrada', `${action.title} se completó correctamente.`);
    } catch (error) {
      toast.error('No se pudo completar', error instanceof Error ? error.message : 'Revisa los datos e intenta de nuevo.');
    }
  }

  return (
    <Panel title={action.title} description={action.description} icon={action.icon} className="h-fit">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          {action.fields.map((field, index) => (
            <ActionFieldControl key={field.name} field={field} className={spanClasses[index] ?? ''} dynamicOptions={dynamicOptions} />
          ))}
        </div>
        {mutation.error ? <InlineNotice tone="danger">{mutation.error}</InlineNotice> : null}
        {showResult ? <InlineNotice tone="success">Registro creado correctamente.</InlineNotice> : null}
        <div className="flex justify-end border-t border-slate-100 pt-3"><AtlasButton type="submit" icon={action.submitIcon ?? 'save'} loading={mutation.isLoading}>{action.submitLabel}</AtlasButton></div>
      </form>
    </Panel>
  );
}
