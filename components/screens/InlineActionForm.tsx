'use client';

import { useEffect, useRef, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { fieldSpanClasses } from '@/lib/formLayout';
import { formDataToPayload } from '@/lib/formPayload';
import { toast } from '@/lib/toast';
import { ActionFieldControl, payloadDefinitions } from './ActionFieldControl';
import type { ActionField } from './StructuredActionForm';
import type { JsonObject } from '@/services/types';

interface InlineActionFormProps {
  title: string;
  description?: string | undefined;
  icon?: string | undefined;
  fields: ActionField[];
  submitLabel: string;
  submitIcon?: string | undefined;
  onSubmit: (payload: JsonObject) => Promise<unknown>;
  /** Se llama tras un envío correcto: sirve para recargar la tabla de la misma pantalla. */
  onDone?: (() => void | Promise<void>) | undefined;
  successMessage?: string | undefined;
}

/**
 * Formulario declarativo dentro de un panel, sin cabecera de pantalla propia.
 *
 * `StructuredActionForm` y `MultiActionWorkspace` pintan cada uno su `WorkspaceHeader`, así que no
 * se pueden meter en una pestaña sin repetir el título de la vista. Este es el mismo formulario sin
 * esa parte, para las acciones que acompañan a una tabla.
 */
export function InlineActionForm(props: InlineActionFormProps) {
  const { fields } = props;
  const formRef = useRef<HTMLFormElement>(null);
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, Array<{ label: string; value: string }>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const spanClasses = fieldSpanClasses(fields.map((field) => field.span));

  useEffect(() => {
    let cancelled = false;
    fields.filter((field) => field.optionsLoader).forEach((field) => {
      field.optionsLoader!()
        .then((options) => { if (!cancelled) setDynamicOptions((current) => ({ ...current, [field.name]: options })); })
        .catch(() => { /* el select queda vacío; el error real aparece al enviar */ });
    });
    return () => { cancelled = true; };
  }, [fields]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const definitions = payloadDefinitions(fields);
    setSaving(true);
    setError('');
    try {
      await props.onSubmit(formDataToPayload(new FormData(event.currentTarget), definitions) as JsonObject);
      formRef.current?.reset();
      toast.success('Operación registrada', props.successMessage ?? `${props.title} se completó correctamente.`);
      await props.onDone?.();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo completar. Revisa los datos.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title={props.title} description={props.description} icon={props.icon}>
      <form ref={formRef} className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {fields.map((field, index) => (
            <ActionFieldControl key={field.name} field={field} className={spanClasses[index] ?? ''} dynamicOptions={dynamicOptions} />
          ))}
        </div>
        {error ? <InlineNotice tone="danger" title="No se pudo completar">{error}</InlineNotice> : null}
        <div className="flex justify-end border-t border-slate-100 pt-3">
          <AtlasButton type="submit" icon={props.submitIcon ?? 'save'} loading={saving}>{props.submitLabel}</AtlasButton>
        </div>
      </form>
    </Panel>
  );
}
