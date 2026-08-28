'use client';

import { ChipsField } from '@/components/atlas/ChipsField';
import { FormField } from '@/components/atlas/FormField';
import type { PayloadFieldDefinition } from '@/lib/formPayload';
import type { ActionField } from './StructuredActionForm';

/**
 * Un campo declarativo, pintado igual en las cuatro superficies que los usan.
 *
 * `InlineActionForm`, `StructuredActionForm`, el modal de `CrudDirectory` y `MultiActionWorkspace`
 * repetían la misma cadena de `if (field.type === ...)`. Cuatro copias significaban que un tipo
 * nuevo —el selector de fecha y hora, sin ir más lejos— aparecía en unas pantallas y en otras no.
 */
export function controlType(field: ActionField): string {
  if (field.type === 'datetime') return 'datetime-local';
  return field.type ?? 'text';
}

/**
 * Definiciones para `formDataToPayload`.
 *
 * El tipo del control ya dice cómo hay que convertir el valor: un `datetime-local` entrega un texto
 * sin zona horaria que hay que pasar a ISO. Deducirlo aquí evita tener que repetir
 * `valueKind: 'datetime'` en cada pantalla y olvidarlo en una.
 */
export function payloadDefinitions(fields: ActionField[]): PayloadFieldDefinition[] {
  return fields.map((field) => ({
    name: field.name,
    valueKind: field.valueKind ?? (field.type === 'datetime' ? 'datetime' : undefined),
    optional: field.optional,
  }));
}

interface ActionFieldControlProps {
  field: ActionField;
  className: string;
  /** Opciones cargadas del backend, por nombre de campo. */
  dynamicOptions: Record<string, Array<{ label: string; value: string }>>;
  /** Valor inicial ya resuelto (edición de una fila); si falta, manda el del propio campo. */
  defaultValue?: string | number | undefined;
  /** Obligatorio para el navegador. Se apaga en formularios con pestañas ocultas. */
  nativeRequired?: boolean | undefined;
  /** Sólo el asterisco, sin `required` nativo. */
  softRequired?: boolean | undefined;
}

/**
 * Valor inicial de un `datetime-local`.
 *
 * El control sólo acepta «AAAA-MM-DDTHH:mm» en hora LOCAL; si se le da el ISO en UTC que devuelve
 * el backend lo muestra vacío, sin decir por qué.
 */
function toDatetimeLocal(value: string | number | undefined): string | number | undefined {
  if (typeof value !== 'string' || !value) return value;
  const fecha = new Date(value);
  if (Number.isNaN(fecha.getTime())) return value;
  const desfase = fecha.getTimezoneOffset() * 60_000;
  return new Date(fecha.getTime() - desfase).toISOString().slice(0, 16);
}

export function ActionFieldControl(props: ActionFieldControlProps) {
  const { field, className, dynamicOptions } = props;
  const bruto = props.defaultValue !== undefined ? props.defaultValue : field.defaultValue;
  const defaultValue = field.type === 'datetime' ? toDatetimeLocal(bruto) : bruto;
  const required = props.nativeRequired !== undefined ? props.nativeRequired : field.required;

  if (field.type === 'chips') {
    return (
      <ChipsField
        name={field.name}
        label={field.label}
        required={field.required}
        defaultValue={typeof defaultValue === 'string' ? defaultValue : undefined}
        placeholder={field.placeholder}
        hint={field.hint}
        className={className}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <FormField
        kind="select"
        name={field.name}
        label={field.label}
        required={required}
        softRequired={props.softRequired}
        defaultValue={defaultValue}
        hint={field.hint}
        options={field.options ?? dynamicOptions[field.name] ?? []}
        className={className}
      />
    );
  }

  if (field.type === 'textarea') {
    return (
      <FormField
        kind="textarea"
        name={field.name}
        label={field.label}
        required={required}
        softRequired={props.softRequired}
        defaultValue={defaultValue}
        placeholder={field.placeholder}
        hint={field.hint}
        className={className}
      />
    );
  }

  return (
    <FormField
      name={field.name}
      label={field.label}
      required={required}
      softRequired={props.softRequired}
      type={controlType(field)}
      defaultValue={defaultValue}
      placeholder={field.placeholder}
      hint={field.hint}
      className={className}
    />
  );
}
