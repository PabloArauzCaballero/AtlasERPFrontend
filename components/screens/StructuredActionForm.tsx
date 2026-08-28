'use client';

import { useCallback, useEffect, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { Icon } from '@/components/atlas/Icon';
import { formDataToPayload, type FieldValueKind } from '@/lib/formPayload';
import { fieldSpanClasses } from '@/lib/formLayout';
import { ActionFieldControl, payloadDefinitions } from './ActionFieldControl';
import { toast } from '@/lib/toast';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import type { JsonObject, ResourceRow } from '@/services/types';

export interface ActionField {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'number' | 'date' | 'datetime' | 'url' | 'textarea' | 'select' | 'chips';
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
  /** Dentro de una pestaña: sin cabecera de pantalla, con las acciones al pie. */
  embedded?: boolean | undefined;
  /** Se llama tras un envío correcto (para recargar la tabla que acompaña al formulario). */
  onDone?: (() => void | Promise<void>) | undefined;
}

export function StructuredActionForm(props: StructuredActionFormProps) {
  const submitAction = useCallback((payload: JsonObject) => props.onSubmit(payload), [props]);
  const mutation = useAtlasMutation(submitAction);
  const definitions = props.sections.flatMap((section) => payloadDefinitions(section.fields));

  const [dynamicOptions, setDynamicOptions] = useState<Record<string, Array<{ label: string; value: string }>>>({});
  // Las secciones se muestran como pestañas para no saturar la vista; TODAS quedan montadas
  // (solo se ocultan las inactivas) para que el envío capture sus campos igual.
  const [activeTab, setActiveTab] = useState(0);
  const tabbed = props.sections.length > 1;
  const requiredFields = props.sections.flatMap((section, sectionIndex) =>
    section.fields.filter((field) => field.required).map((field) => ({ name: field.name, label: field.label, sectionIndex })));
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
    const data = new FormData(event.currentTarget);
    // En modo pestañas el `required` nativo no valida campos ocultos: se comprueba a mano y, si
    // falta uno, se salta a su pestaña y se avisa con un toast (en vez de fallar en silencio).
    if (tabbed) {
      const missing = requiredFields.find((field) => !String(data.get(field.name) ?? '').trim());
      if (missing) {
        setActiveTab(missing.sectionIndex);
        toast.warning('Faltan datos obligatorios', `Completa «${missing.label}» antes de guardar.`);
        return;
      }
    }
    try {
      await mutation.execute(formDataToPayload(data, definitions));
      toast.success('Guardado', 'El registro se creó correctamente.');
      await props.onDone?.();
    } catch (error) {
      toast.error('No se pudo guardar', error instanceof Error ? error.message : 'Revisa los datos e intenta de nuevo.');
    }
  }

  const acciones = <><AtlasButton variant="secondary" icon="close" type="reset" onClick={mutation.reset}>Descartar</AtlasButton><AtlasButton type="submit" data-tutorial-id="action-submit" icon={props.submitIcon ?? 'save'} loading={mutation.isLoading}>{props.submitLabel}</AtlasButton></>;

  return (
    <form data-tutorial-id="action-form" className="space-y-5" onSubmit={handleSubmit}>
      {props.embedded ? null : (
        <WorkspaceHeader
          breadcrumbs={[{ label: props.moduleLabel }, { label: props.title }]}
          title={props.title}
          description={props.description}
          actions={acciones}
        />
      )}

      {props.warning ? <InlineNotice tone="warning" title="Validación requerida">{props.warning}</InlineNotice> : null}
      {mutation.error ? <InlineNotice tone="danger" title="No se pudo completar la operación">{mutation.error}</InlineNotice> : null}

      <Panel className="!p-0 overflow-hidden">
        {tabbed ? (
          <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50/70 px-2 pt-2">
            {props.sections.map((section, index) => (
              <button
                key={section.title}
                type="button"
                onClick={() => setActiveTab(index)}
                className={`inline-flex items-center gap-1.5 rounded-t-md px-3 py-2 text-xs font-bold transition ${index === activeTab ? 'bg-white text-primary shadow-[inset_0_-2px_0_0_#006a61]' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {section.icon ? <Icon name={section.icon} className="text-[16px]" /> : null}
                {section.title}
              </button>
            ))}
          </div>
        ) : null}
        {props.sections.map((section, index) => (
          <div key={section.title} className={`p-5 ${tabbed && index !== activeTab ? 'hidden' : ''}`}>
            {section.description ? <p className="mb-4 text-xs text-slate-500">{section.description}</p> : null}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(() => {
                const clases = fieldSpanClasses(section.fields.map((field) => field.span), { breakpoint: 'md' });
                return section.fields.map((field, fieldIndex) => (
                  <ActionFieldControl
                    key={field.name}
                    field={field}
                    className={clases[fieldIndex] ?? ''}
                    dynamicOptions={dynamicOptions}
                    nativeRequired={tabbed ? undefined : field.required}
                    softRequired={tabbed ? field.required : undefined}
                  />
                ));
              })()}
            </div>
          </div>
        ))}
      </Panel>
      {props.embedded ? <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">{acciones}</div> : null}
    </form>
  );
}
