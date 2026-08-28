'use client';

import { useEffect, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Modal } from '@/components/atlas/Modal';
import { fieldSpanClasses } from '@/lib/formLayout';
import { formDataToPayload } from '@/lib/formPayload';
import { ActionFieldControl, payloadDefinitions } from './ActionFieldControl';
import type { ActionField } from './StructuredActionForm';
import type { JsonObject, ResourceRow } from '@/services/types';

/** Valor de un campo del formulario a partir de la fila, soportando nombres anidados (`a.b`). */
function valueOf(row: ResourceRow, name: string): string {
  const segments = name.split('.');
  let current: unknown = row;
  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== 'object') return '';
    current = (current as Record<string, unknown>)[segment];
  }
  if (current === null || current === undefined) return '';
  if (Array.isArray(current)) return current.join(', ');
  if (typeof current === 'boolean') return current ? 'true' : 'false';
  // Las fechas llegan en ISO completo y un <input type="date"> sólo acepta AAAA-MM-DD.
  const text = String(current);
  return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text.slice(0, 10) : text;
}

export interface ActionFormModalProps {
  open: boolean;
  title: string;
  description?: string | undefined;
  icon: string;
  fields: ActionField[];
  /** Fila de partida: rellena los campos cuyo nombre coincide con una de sus columnas. */
  row?: ResourceRow | null | undefined;
  submitLabel: string;
  onClose: () => void;
  onSubmit: (payload: JsonObject) => Promise<void>;
}

/**
 * Formulario de alta, edición o acción sobre una fila, dentro de un modal.
 *
 * Es el gesto estándar del ERP: la tabla es la pantalla y el formulario se abre encima de ella,
 * sobre el registro que se estaba mirando. Antes cada operación —emitir, cobrar, postear— vivía en
 * una pestaña aparte que volvía a pedir en un desplegable el registro que el usuario ya tenía
 * delante.
 */
export function ActionFormModal(props: ActionFormModalProps) {
  const { open, fields } = props;
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, Array<{ label: string; value: string }>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const spanClasses = fieldSpanClasses(fields.map((field) => field.span), { maxColumns: 2 });

  // Los catálogos se piden al abrir, no al montar: si no se abre nunca, no se gasta la llamada.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fields.filter((field) => field.optionsLoader).forEach((field) => {
      field.optionsLoader!()
        .then((options) => { if (!cancelled) setDynamicOptions((current) => ({ ...current, [field.name]: options })); })
        .catch(() => { /* el select queda vacío y el error real se ve al enviar */ });
    });
    return () => { cancelled = true; };
  }, [open, fields]);

  useEffect(() => { if (open) setError(''); }, [open]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const definitions = payloadDefinitions(fields);
    setSaving(true);
    setError('');
    try {
      await props.onSubmit(formDataToPayload(new FormData(event.currentTarget), definitions) as JsonObject);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar. Revisa los datos.');
    } finally {
      setSaving(false);
    }
  }

  const row = props.row ?? null;
  // Remontar el formulario por fila hace que los `defaultValue` se apliquen al cambiar de registro.
  const formKey = row ? String(row.id ?? '') : 'nuevo';

  return (
    <Modal open={open} title={props.title} description={props.description} icon={props.icon} onClose={props.onClose}>
      <form key={formKey} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map((field, index) => {
            const preset = row ? valueOf(row, field.name) : undefined;
            return (
              <ActionFieldControl
                key={field.name}
                field={field}
                className={spanClasses[index] ?? ''}
                dynamicOptions={dynamicOptions}
                defaultValue={preset !== undefined && preset !== '' ? preset : field.defaultValue}
              />
            );
          })}
        </div>
        {error ? <InlineNotice tone="danger" title="No se pudo guardar">{error}</InlineNotice> : null}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <AtlasButton variant="secondary" type="button" onClick={props.onClose}>Cancelar</AtlasButton>
          <AtlasButton type="submit" icon="save" loading={saving}>{props.submitLabel}</AtlasButton>
        </div>
      </form>
    </Modal>
  );
}
