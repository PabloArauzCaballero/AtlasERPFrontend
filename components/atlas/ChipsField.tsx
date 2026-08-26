'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/atlas/Icon';

interface ChipsFieldProps {
  label: string;
  name: string;
  hint?: string | undefined;
  required?: boolean | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
  /** Valor inicial: lista separada por comas (mismo formato que consume `formDataToPayload`). */
  defaultValue?: string | undefined;
}

/**
 * Entrada multivalor con «chips». Se escribe y se pulsa Enter o coma para fijar cada etiqueta;
 * cada una aparece como pastilla con su ✕. Mantiene un input oculto con los valores unidos por
 * comas para que el pipeline de formulario existente (`valueKind: 'stringList'`) los reciba igual
 * que antes, sin tocar el envío.
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

  const removeAt = (index: number) => setChips((current) => current.filter((_, position) => position !== index));

  return (
    <label className={cn('block min-w-0', props.className)}>
      <span className="mb-1.5 block text-xs font-bold text-slate-700">{props.label}{props.required ? <span className="ml-1 text-red-600">*</span> : null}</span>
      <div className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1.5 focus-within:border-[#006a61] focus-within:ring-2 focus-within:ring-[#006a61]/20">
        {chips.map((chip, index) => (
          <span key={`${chip}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-primary-wash px-2 py-0.5 text-xs font-semibold text-primary">
            {chip}
            <button type="button" aria-label={`Quitar ${chip}`} className="grid h-4 w-4 place-items-center rounded-full text-primary/70 hover:bg-primary/10 hover:text-primary" onClick={() => removeAt(index)}>
              <Icon name="close" className="text-[13px]" />
            </button>
          </span>
        ))}
        <input
          className="h-6 min-w-24 flex-1 bg-transparent px-1 text-sm text-slate-900 outline-none placeholder:text-slate-500"
          value={draft}
          placeholder={chips.length ? '' : (props.placeholder ?? 'Escribe y pulsa Enter...')}
          onChange={(event) => {
            const text = event.target.value;
            if (text.includes(',')) { add(text); return; }
            setDraft(text);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') { event.preventDefault(); add(draft); }
            else if (event.key === 'Backspace' && !draft && chips.length) { removeAt(chips.length - 1); }
          }}
          onBlur={() => add(draft)}
        />
      </div>
      {/* Input oculto: el formulario lo lee como lista separada por comas (valueKind stringList). */}
      <input type="hidden" name={props.name} value={chips.join(',')} />
      {props.hint ? <span className="mt-1 block text-[11px] text-slate-500">{props.hint}</span> : null}
    </label>
  );
}
