'use client';

import { useCallback, useEffect, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { Icon } from '@/components/atlas/Icon';
import { formDataToPayload, type FieldValueKind } from '@/lib/formPayload';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import type { JsonObject, ResourceRow } from '@/services/types';

export interface ActionField {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'number' | 'date' | 'url' | 'textarea' | 'select';
  valueKind?: FieldValueKind | undefined;
  required?: boolean | undefined;
  optional?: boolean | undefined;
  placeholder?: string | undefined;
  defaultValue?: string | number | undefined;
  hint?: string | undefined;
  options?: Array<{ label: string; value: string }> | undefined;
  /** Carga opciones de un select desde el backend (una sola vez, al montar). Para campos UUID normalizados. */
  optionsLoader?: (() => Promise<Array<{ label: string; value: string }>>) | undefined;
  span?: 1 | 2 | 3;
}

export interface FormSectionDefinition {
  title: string;
  description?: string | undefined;
  icon?: string | undefined;
  fields: ActionField[];
}

interface StructuredActionFormProps {
  moduleLabel: string;
  title: string;
  description: string;
  sections: FormSectionDefinition[];
  submitLabel: string;
  submitIcon?: string;
  onSubmit: (payload: JsonObject) => Promise<ResourceRow>;
  summaryTitle?: string;
  summaryItems?: Array<{ label: string; value: string; tone?: 'success' | 'warning' | 'neutral' }>;
  warning?: string;
}

export function StructuredActionForm(props: StructuredActionFormProps) {
  const submitAction = useCallback((payload: JsonObject) => props.onSubmit(payload), [props]);
  const mutation = useAtlasMutation(submitAction);
  const definitions = props.sections.flatMap((section) => section.fields.map((field) => ({ name: field.name, valueKind: field.valueKind, optional: field.optional })));

  const [dynamicOptions, setDynamicOptions] = useState<Record<string, Array<{ label: string; value: string }>>>({});
  useEffect(() => {
    let cancelled = false;
    props.sections
      .flatMap((section) => section.fields)
      .filter((field) => field.optionsLoader)
      .forEach((field) => {
        field
          .optionsLoader!()
          .then((options) => { if (!cancelled) setDynamicOptions((current) => ({ ...current, [field.name]: options })); })
          .catch(() => { /* si falla, el select queda vacío y el usuario ve el error al enviar */ });
      });
    return () => { cancelled = true; };
    // Los loaders se resuelven una sola vez al montar (las secciones no cambian en runtime).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = formDataToPayload(new FormData(event.currentTarget), definitions);
    try { await mutation.execute(payload); } catch { /* state already exposes the controlled error */ }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <WorkspaceHeader
        breadcrumbs={[{ label: props.moduleLabel }, { label: props.title }]}
        title={props.title}
        description={props.description}
        actions={<><AtlasButton variant="secondary" icon="close" type="reset" onClick={mutation.reset}>Descartar</AtlasButton><AtlasButton type="submit" icon={props.submitIcon ?? 'save'} loading={mutation.isLoading}>{props.submitLabel}</AtlasButton></>}
      />

      {props.warning ? <InlineNotice tone="warning" title="Validación requerida">{props.warning}</InlineNotice> : null}
      {mutation.status === 'success' ? <InlineNotice tone="success" title="Operación registrada">El backend aceptó el registro. Se conservaron los identificadores y la trazabilidad devuelta por la API.</InlineNotice> : null}
      {mutation.error ? <InlineNotice tone="danger" title="No se pudo completar la operación">{mutation.error}</InlineNotice> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          {props.sections.map((section) => (
            <Panel key={section.title} title={section.title} description={section.description} icon={section.icon}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {section.fields.map((field) => {
                  const fieldClass = field.span === 3 ? 'md:col-span-2 xl:col-span-3' : field.span === 2 ? 'md:col-span-2' : '';
                  if (field.type === 'select') return <FormField key={field.name} kind="select" name={field.name} label={field.label} required={field.required} defaultValue={field.defaultValue} hint={field.hint} options={field.options ?? dynamicOptions[field.name] ?? []} className={fieldClass} />;
                  if (field.type === 'textarea') return <FormField key={field.name} kind="textarea" name={field.name} label={field.label} required={field.required} defaultValue={field.defaultValue} placeholder={field.placeholder} hint={field.hint} className={fieldClass} />;
                  return <FormField key={field.name} name={field.name} label={field.label} required={field.required} type={field.type ?? 'text'} defaultValue={field.defaultValue} placeholder={field.placeholder} hint={field.hint} className={fieldClass} />;
                })}
              </div>
            </Panel>
          ))}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <Panel title={props.summaryTitle ?? 'Control de registro'} icon="fact_check">
            <div className="space-y-3">
              {(props.summaryItems ?? [
                { label: 'Validación de entrada', value: 'Zod backend', tone: 'success' as const },
                { label: 'Trazabilidad', value: 'Business Action Log', tone: 'success' as const },
                { label: 'Estado', value: 'Borrador', tone: 'warning' as const },
              ]).map((item) => (
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0" key={item.label}>
                  <span className="text-xs text-slate-500">{item.label}</span>
                  <StatusPill tone={item.tone ?? 'neutral'} dot={false}>{item.value}</StatusPill>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Actividad de la operación" icon="history_edu">
            <ol className="space-y-4 text-xs">
              <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-50 text-[#006a61]"><Icon name="edit" className="text-[14px]" /></span><div><b>Preparación</b><p className="mt-0.5 text-slate-500">Complete los campos obligatorios y confirme referencias.</p></div></li>
              <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700"><Icon name="rule" className="text-[14px]" /></span><div><b>Validación</b><p className="mt-0.5 text-slate-500">La API aplica esquema, permisos y reglas de negocio.</p></div></li>
              <li className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Icon name="verified" className="text-[14px]" /></span><div><b>Confirmación</b><p className="mt-0.5 text-slate-500">La operación queda registrada con correlación auditable.</p></div></li>
            </ol>
          </Panel>

        </aside>
      </div>
    </form>
  );
}
