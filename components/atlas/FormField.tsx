'use client';

import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { FieldLabel } from '@/components/atlas/FieldLabel';
import { useFieldHelp } from '@/components/atlas/FieldTooltip';
import { OptionSelect, type SelectOption } from '@/components/atlas/OptionSelect';

interface BaseFieldProps {
  label: string;
  name: string;
  /** Texto corto SIEMPRE visible bajo el control. */
  hint?: string | undefined;
  /** Qué poner y por qué importa: se abre al pasar por el ⓘ o al enfocar el control. */
  tooltip?: string | undefined;
  required?: boolean | undefined;
  /** Muestra el asterisco de obligatorio SIN poner `required` nativo (para campos en pestañas
   *  ocultas, donde el `required` del navegador lanzaría «not focusable» y bloquearía el envío). */
  softRequired?: boolean | undefined;
  className?: string | undefined;
}

interface InputFieldProps extends BaseFieldProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'className'> {
  kind?: 'input';
}

/** Evento mínimo que reciben los `onChange` de un select: `event.target.value` y `event.target.name`. */
export interface SelectChangeEvent {
  target: { value: string; name: string };
}

interface SelectFieldProps extends BaseFieldProps {
  kind: 'select';
  options: SelectOption[];
  value?: string | number | readonly string[] | undefined;
  defaultValue?: string | number | readonly string[] | undefined;
  onChange?: ((event: SelectChangeEvent) => void) | undefined;
  disabled?: boolean | undefined;
  placeholder?: string | undefined;
  /** Sin descripción bajo el control y letra menor: barras de filtros. */
  compact?: boolean | undefined;
  'data-testid'?: string | undefined;
}

interface TextareaFieldProps extends BaseFieldProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'name' | 'className'> {
  kind: 'textarea';
}

type FormFieldProps = InputFieldProps | SelectFieldProps | TextareaFieldProps;

const controlClass = 'h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-[#006a61] focus:ring-2 focus:ring-[#006a61]/20 disabled:bg-slate-100';

const asString = (value: string | number | readonly string[] | undefined): string | undefined =>
  value === undefined ? undefined : Array.isArray(value) ? String(value[0] ?? '') : String(value);

/**
 * El átomo de campo del ERP: etiqueta con ⓘ, control y ayuda corta.
 *
 * La etiqueta es un `<label htmlFor>` y no envuelve al control: así el botón de ayuda queda fuera
 * del nombre accesible y `getByLabel('Ciudad')` sigue encontrando el control. Un `kind="select"`
 * pinta `OptionSelect` (cada opción con su descripción); su `onChange` recibe `event.target.value`
 * como antes para que las pantallas no cambien.
 */
export function FormField(props: FormFieldProps) {
  const id = useId();
  const help = useFieldHelp(props.tooltip);
  const required = props.required || props.softRequired;
  const labelRow = (
    <FieldLabel htmlFor={id} label={props.label} required={required} tooltip={props.tooltip} describedById={help.describedById} controlFocused={help.focused} />
  );
  const hintRow = props.hint ? <span className="mt-1 block text-[11px] text-slate-500">{props.hint}</span> : null;

  if (props.kind === 'select') {
    const { name, className, options, onChange, value, defaultValue, disabled, placeholder, compact } = props;
    const testId = props['data-testid'];
    return (
      <div className={cn('block min-w-0', className)}>
        {labelRow}
        <OptionSelect
          id={id}
          name={name}
          options={options}
          value={asString(value)}
          defaultValue={asString(defaultValue)}
          onChange={onChange ? (next) => onChange({ target: { value: next, name } }) : undefined}
          required={props.required}
          disabled={disabled}
          placeholder={placeholder}
          compact={compact}
          testId={testId}
          describedById={help.describedById}
          onFocus={help.onFocus}
          onBlur={help.onBlur}
        />
        {hintRow}
      </div>
    );
  }

  if (props.kind === 'textarea') {
    const { label: _l, name, hint: _h, tooltip: _t, required: nativeRequired, softRequired: _sr, className, kind: _kind, onFocus, onBlur, ...textareaProps } = props;
    return (
      <div className={cn('block min-w-0', className)}>
        {labelRow}
        <textarea
          {...textareaProps}
          id={id}
          name={name}
          required={nativeRequired}
          aria-describedby={help.describedById}
          onFocus={(event) => { help.onFocus(); onFocus?.(event); }}
          onBlur={(event) => { help.onBlur(); onBlur?.(event); }}
          className={`${controlClass} min-h-24 resize-y py-2`}
        />
        {hintRow}
      </div>
    );
  }

  const { label: _l, name, hint: _h, tooltip: _t, required: nativeRequired, softRequired: _sr, className, kind: _kind, onFocus, onBlur, ...inputProps } = props;
  return (
    <div className={cn('block min-w-0', className)}>
      {labelRow}
      <input
        {...inputProps}
        id={id}
        name={name}
        required={nativeRequired}
        aria-describedby={help.describedById}
        onFocus={(event) => { help.onFocus(); onFocus?.(event); }}
        onBlur={(event) => { help.onBlur(); onBlur?.(event); }}
        className={controlClass}
      />
      {hintRow}
    </div>
  );
}
