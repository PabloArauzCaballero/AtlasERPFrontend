'use client';

import { useId, useState } from 'react';
import { FieldLabel } from '@/components/atlas/FieldLabel';
import { useFieldHelp } from '@/components/atlas/FieldTooltip';
import { cn } from '@/lib/cn';

interface MultiSelectFieldProps {
  name: string;
  label: string;
  options: Array<{ label: string; value: string; description?: string | undefined }>;
  /** Códigos iniciales, separados por coma. */
  defaultValue?: string | undefined;
  required?: boolean | undefined;
  softRequired?: boolean | undefined;
  hint?: string | undefined;
  tooltip?: string | undefined;
  className?: string | undefined;
}

/**
 * Selección múltiple de un dominio cerrado.
 *
 * Donde había `chips` de texto libre para un vocabulario cerrado («IMAGE_BANNER, TEXT_CARD,
 * VIDEO…» escrito en la ayuda), el backend rechazaba cualquier palabra mal escrita. Aquí sólo se
 * marcan valores válidos. Viaja como un control oculto con los códigos separados por coma, que
 * `formDataToPayload` convierte en lista SIN pasar a minúsculas (`valueKind: 'codeList'`).
 */
export function MultiSelectField(props: MultiSelectFieldProps) {
  const [selected, setSelected] = useState<string[]>(() =>
    (props.defaultValue ?? '')
      .split(',')
      .map((code) => code.trim())
      .filter(Boolean),
  );
  const toggle = (code: string) =>
    setSelected((current) => (current.includes(code) ? current.filter((value) => value !== code) : [...current, code]));
  const id = useId();
  const help = useFieldHelp(props.tooltip);

  return (
    <fieldset className={cn('block min-w-0', props.className)}>
      <legend className="sr-only">{props.label}</legend>
      <FieldLabel label={props.label} required={props.required || props.softRequired} tooltip={props.tooltip} describedById={help.describedById} controlFocused={help.focused} />
      {/*
       * El valor viaja en un input visualmente oculto pero NO `type="hidden"`: el navegador no valida
       * `required` en un campo oculto, y el alta salía con la lista vacía hasta que el backend la
       * rechazaba. Así el formulario no se envía sin al menos una opción marcada.
       */}
      <input
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        name={props.name}
        value={selected.join(',')}
        required={props.required}
        onChange={() => {}}
        onInvalid={(event) => event.currentTarget.setCustomValidity('Elige al menos una opción.')}
        onInput={(event) => event.currentTarget.setCustomValidity('')}
      />
      <div id={id} className="flex flex-wrap gap-1.5" aria-describedby={help.describedById} onFocus={help.onFocus} onBlur={help.onBlur}>
        {props.options.length === 0 ? (
          <span className="text-xs text-slate-500">— No hay datos registrados —</span>
        ) : (
          props.options.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                title={option.description}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition',
                  checked ? 'border-[#006a61] bg-[#006a61]/10 text-[#006a61]' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400',
                )}
              >
                <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(option.value)} />
                {option.label}
              </label>
            );
          })
        )}
      </div>
      {props.required && selected.length === 0 ? (
        <span className="mt-1 block text-[11px] text-amber-700">Elige al menos una opción.</span>
      ) : props.hint ? (
        <span className="mt-1 block text-[11px] text-slate-500">{props.hint}</span>
      ) : null}
    </fieldset>
  );
}
