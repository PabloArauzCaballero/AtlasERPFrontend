import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface BaseFieldProps {
  label: string;
  name: string;
  hint?: string | undefined;
  required?: boolean | undefined;
  /** Muestra el asterisco de obligatorio SIN poner `required` nativo (para campos en pestañas
   *  ocultas, donde el `required` del navegador lanzaría «not focusable» y bloquearía el envío). */
  softRequired?: boolean | undefined;
  className?: string | undefined;
}

interface InputFieldProps extends BaseFieldProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'className'> {
  kind?: 'input';
}

interface SelectFieldProps extends BaseFieldProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, 'name' | 'className'> {
  kind: 'select';
  options: Array<{ label: string; value: string }>;
}

interface TextareaFieldProps extends BaseFieldProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'name' | 'className'> {
  kind: 'textarea';
}

type FormFieldProps = InputFieldProps | SelectFieldProps | TextareaFieldProps;

const controlClass = 'h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-[#006a61] focus:ring-2 focus:ring-[#006a61]/20 disabled:bg-slate-100';

export function FormField(props: FormFieldProps) {
  const requiredMark = (props.required || props.softRequired) ? <span className="ml-1 text-red-600">*</span> : null;

  if (props.kind === 'select') {
    const { label, name, hint, required, softRequired: _sr, className, options, kind: _kind, ...selectProps } = props;
    const isEmpty = options.length === 0;
    return (
      <label className={cn('block min-w-0', className)}>
        <span className="mb-1.5 block text-xs font-bold text-slate-700">{label}{requiredMark}</span>
        <select {...selectProps} name={name} required={required} disabled={isEmpty || selectProps.disabled} className={controlClass}>
          {isEmpty
            ? <option value="">— No hay datos registrados —</option>
            : options.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
        </select>
        {hint ? <span className="mt-1 block text-[11px] text-slate-500">{hint}</span> : null}
      </label>
    );
  }

  if (props.kind === 'textarea') {
    const { label, name, hint, required, softRequired: _sr, className, kind: _kind, ...textareaProps } = props;
    return (
      <label className={cn('block min-w-0', className)}>
        <span className="mb-1.5 block text-xs font-bold text-slate-700">{label}{requiredMark}</span>
        <textarea {...textareaProps} name={name} required={required} className={`${controlClass} min-h-24 resize-y py-2`} />
        {hint ? <span className="mt-1 block text-[11px] text-slate-500">{hint}</span> : null}
      </label>
    );
  }

  const { label, name, hint, required, softRequired: _sr, className, kind: _kind, ...inputProps } = props;
  return (
    <label className={cn('block min-w-0', className)}>
      <span className="mb-1.5 block text-xs font-bold text-slate-700">{label}{requiredMark}</span>
      <input {...inputProps} name={name} required={required} className={controlClass} />
      {hint ? <span className="mt-1 block text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  );
}
