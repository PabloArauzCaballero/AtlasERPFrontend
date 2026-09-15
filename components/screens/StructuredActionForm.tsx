'use client';

import { useCallback, useState } from 'react';
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
import type { OptionsSource } from '@/services/domains';
import { formChangeHandler, useFieldOptions } from '@/hooks/useFieldOptions';

export interface ActionField {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'number' | 'date' | 'datetime' | 'url' | 'textarea' | 'select' | 'multiselect' | 'chips' | 'countryCity' | 'address';
  valueKind?: FieldValueKind | undefined;
  required?: boolean | undefined;
  optional?: boolean | undefined;
  placeholder?: string | undefined;
  defaultValue?: string | number | undefined;
  hint?: string | undefined;
  options?: Array<{ label: string; value: string; description?: string | undefined }> | undefined;
  /**
   * De dónde salen los valores válidos, sin copiarlos en la pantalla: `domain:crm.riskTier` (lo
   * publica el backend en /catalog/domains) o `catalog:currency` (listas ISO de lib/catalogs.ts).
   * Un campo con fuente y sin `type` se pinta como select.
   */
  optionsSource?: OptionsSource | undefined;
  /** Etiqueta de la opción vacía de un select opcional. Por defecto «— Sin definir —». */
  emptyOption?: string | undefined;
  /** Otro campo del mismo formulario del que dependen las opciones (tipo de entidad → entidad). */
  dependsOn?: string | undefined;
  /** Carga las opciones a partir del valor de `dependsOn`; se vuelve a llamar cada vez que cambia. */
  optionsLoaderFor?: ((parentValue: string) => Promise<Array<{ label: string; value: string }>>) | undefined;
  /**
   * El valor lo asigna el backend (un correlativo): no se pide ni viaja en el envío. En un alta se
   * muestra «Se asigna al guardar»; en una edición, el valor asignado, de sólo lectura.
   */
  assignedByBackend?: boolean | undefined;
  /** Carga opciones de un select desde el backend (una sola vez, al montar). Para campos UUID normalizados. */
  optionsLoader?: (() => Promise<Array<{ label: string; value: string }>>) | undefined;
  span?: 1 | 2 | 3;
  /** `countryCity`: nombre del control de la ciudad (el del campo es el del país). `address`: control de ciudad para situar el mapa. */
  cityFieldName?: string | undefined;
  /** `address`: nombre del control del país del mismo formulario, para situar el mapa. */
  countryFieldName?: string | undefined;
  /** `countryCity`: ciudad inicial (edición). */
  defaultCity?: string | undefined;
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

  const allFields = props.sections.flatMap((section) => section.fields);
  const { dynamicOptions, onFieldChange } = useFieldOptions(allFields);
  // Las secciones se muestran como pestañas para no saturar la vista; TODAS quedan montadas
  // (solo se ocultan las inactivas) para que el envío capture sus campos igual.
  const [activeTab, setActiveTab] = useState(0);
  const tabbed = props.sections.length > 1;
  const requiredFields = props.sections.flatMap((section, sectionIndex) =>
    section.fields.filter((field) => field.required).map((field) => ({ name: field.name, label: field.label, sectionIndex })));

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
    <form data-tutorial-id="action-form" className="space-y-5" onSubmit={handleSubmit} onChange={formChangeHandler(onFieldChange)} noValidate={tabbed}>
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
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {(() => {
                const clases = fieldSpanClasses(section.fields.map((field) => field.span), { breakpoint: 'md' });
                return section.fields.map((field, fieldIndex) => (
                  <ActionFieldControl
                    key={field.name}
                    field={field}
                    className={clases[fieldIndex] ?? ''}
                    dynamicOptions={dynamicOptions}
                    // `false`, no `undefined`: con `undefined` el control cae al `required` del campo y el
                    // navegador bloquea el envío por un campo de una pestaña OCULTA («not focusable»), sin
                    // ningún aviso en pantalla. Era la causa de «no me deja crear la empresa».
                    nativeRequired={tabbed ? false : field.required}
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
