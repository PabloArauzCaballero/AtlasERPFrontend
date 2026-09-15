'use client';

import { useId, useState } from 'react';
import { FieldLabel } from '@/components/atlas/FieldLabel';
import { useFieldHelp } from '@/components/atlas/FieldTooltip';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/atlas/Icon';

interface ChipsFieldProps {
  label: string;
  name: string;
  hint?: string | undefined;
  tooltip?: string | undefined;
  required?: boolean | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
  /** Valor inicial: lista separada por comas (mismo formato que consume `formDataToPayload`). */
  defaultValue?: string | undefined;
}

/**
 * Entrada multivalor con «chips». Se escribe y se pulsa Enter o coma para fijar cada etiqueta.
 *
 * El campo de texto va ARRIBA, siempre a todo el ancho, y las pastillas van DEBAJO en una sola
 * fila que se desplaza en horizontal. Antes las pastillas convivían dentro del propio input y lo
 * iban aplastando: con tres etiquetas ya no quedaba sitio para escribir y no se veía nada.
 *
 * Mantiene un input oculto con los valores unidos por comas para que el pipeline de formulario
 * existente (`valueKind: 'stringList'`) los reciba igual que antes, sin tocar el envío.
 */
export function ChipsField(props: ChipsFieldProps) {
  const seed = (props.defaultValue ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const [chips, setChips] = useState<string[]>([...new Set(seed)]);
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const value = raw.trim().replace(/,+$/, '').trim();
    if (!value) return;
    setChips((current) => (current.some((chip) => chip.toLowerCase() === value.toLowerCase()) ? current : [...current, value]));
    setDraft('');
  };

  const id = useId();
  const help = useFieldHelp(props.tooltip);
  const removeAt = (index: number) => setChips((current) => current.filter((_, position) => position !== index));

  return (
    <div className={cn('block min-w-0', props.className)}>
      <div>
        <FieldLabel htmlFor={id} label={props.label} required={props.required} tooltip={props.tooltip} describedById={help.describedById} controlFocused={help.focused} />
        <input
          id={id}
          aria-describedby={help.describedById}
          onFocus={help.onFocus}
          className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-[#006a61] focus:ring-2 focus:ring-[#006a61]/20"
          value={draft}
          placeholder={props.placeholder ?? 'Escribe y pulsa Enter...'}
          onChange={(event) => {
            const text = event.target.value;
            if (text.includes(',')) { add(text); return; }
            setDraft(text);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); add(draft); }
            else if (event.key === 'Backspace' && !draft && chips.length) { removeAt(chips.length - 1); }
          }}
          onBlur={() => { help.onBlur(); add(draft); }}
        />
      </div>
      {chips.length ? (
        /* Una sola fila, sin salto de línea: si hay más pastillas que ancho, se desplaza en horizontal. */
        <div
          role="list"
          aria-label={`${props.label}: etiquetas añadidas`}
          className="mt-2 flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]"
        >
          {chips.map((chip, index) => (
            <span
              role="listitem"
              key={`${chip}-${index}`}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-primary-wash px-2.5 py-1 text-xs font-semibold text-primary"
            >
              {chip}
              <button type="button" aria-label={`Quitar ${chip}`} className="grid h-4 w-4 place-items-center rounded-full text-primary/70 hover:bg-primary/10 hover:text-primary" onClick={() => removeAt(index)}>
                <Icon name="close" className="text-[13px]" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {/* Input oculto: el formulario lo lee como lista separada por comas (valueKind stringList). */}
      <input type="hidden" name={props.name} value={chips.join(',')} />
      {props.hint ? <span className="mt-1 block text-[11px] text-slate-500">{props.hint}</span> : null}
    </div>
  );
}
