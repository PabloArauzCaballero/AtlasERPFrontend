'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/atlas/Icon';

export interface SelectOption {
  value: string;
  label: string;
  /** Qué significa la opción y cuándo elegirla. Se ve en la fila y bajo el campo al elegirla. */
  description?: string | undefined;
  disabled?: boolean | undefined;
}

interface OptionSelectProps {
  /** Nombre del control oculto que lleva el valor al formulario. */
  name: string;
  /** `id` del botón, para el `htmlFor` de la etiqueta. */
  id?: string | undefined;
  options: SelectOption[];
  value?: string | undefined;
  defaultValue?: string | undefined;
  onChange?: ((value: string) => void) | undefined;
  onFocus?: (() => void) | undefined;
  onBlur?: (() => void) | undefined;
  required?: boolean | undefined;
  disabled?: boolean | undefined;
  placeholder?: string | undefined;
  /** Texto cuando no hay opciones. */
  emptyLabel?: string | undefined;
  describedById?: string | undefined;
  /** Nombre accesible cuando no hay `FieldLabel` (selects dentro de una tabla o de una barra). */
  ariaLabel?: string | undefined;
  /** `data-testid` del botón; por defecto `select-<name>`. */
  testId?: string | undefined;
  className?: string | undefined;
  /** Reducido para las barras de filtros. */
  compact?: boolean | undefined;
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const SEARCH_FROM = 8;

/**
 * Un select con explicación por opción.
 *
 * Un `<option>` nativo no admite tooltip propio: `title=` no se pinta en Safari/macOS ni en el
 * móvil y no lo lee el lector de pantalla, así que una lista de estados o tipos era una lista de
 * palabras a adivinar. Aquí cada fila lleva su `description` a la vista, y la elegida la repite
 * bajo el control. Es un combobox ARIA (botón + listbox) con teclado completo: flechas, Inicio/
 * Fin, escribir para saltar, Enter para elegir, Escape para cerrar. Con más de ocho opciones
 * aparece un buscador que filtra por etiqueta y por descripción, sin tildes.
 *
 * El valor viaja en un input visualmente oculto pero NO `type="hidden"`: el navegador no valida
 * `required` en un oculto. Al elegir se dispara `input`/`change` nativos en ese control para que
 * el `onChange` del `<form>` (el que recarga campos dependientes) se entere igual que antes.
 */
export function OptionSelect(props: OptionSelectProps) {
  const controlled = props.value !== undefined;
  const [internal, setInternal] = useState(props.defaultValue ?? '');
  const value = controlled ? (props.value as string) : internal;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const generatedId = useId();
  const id = props.id ?? generatedId;
  const listId = `${id}-lista`;

  const selected = props.options.find((option) => option.value === value);
  const isEmpty = props.options.length === 0;
  const searchable = props.options.length > SEARCH_FROM;

  const visible = useMemo(() => {
    const term = normalize(search.trim());
    if (!term) return props.options;
    return props.options.filter((option) => normalize(`${option.label} ${option.description ?? ''}`).includes(term));
  }, [props.options, search]);

  const commit = useCallback(
    (next: string) => {
      if (!controlled) setInternal(next);
      const hidden = hiddenRef.current;
      if (hidden && hidden.value !== next) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        setter?.call(hidden, next);
        hidden.dispatchEvent(new Event('input', { bubbles: true }));
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
      }
      props.onChange?.(next);
    },
    [controlled, props],
  );

  const place = useCallback(() => {
    const anchor = buttonRef.current?.getBoundingClientRect();
    if (!anchor) return;
    const height = Math.min(320, listRef.current?.offsetHeight ?? 320);
    const below = window.innerHeight - anchor.bottom;
    const up = below < height + 8 && anchor.top > below;
    setRect({ top: up ? anchor.top - 4 : anchor.bottom + 4, left: anchor.left, width: anchor.width, up });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place, visible.length]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    if (searchable) searchRef.current?.focus();
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open, searchable]);

  useEffect(() => {
    if (!open) return;
    const index = visible.findIndex((option) => option.value === value);
    setActive(index >= 0 ? index : 0);
  }, [open, visible, value]);

  useEffect(() => {
    if (!open) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const close = (refocus = true) => {
    setOpen(false);
    setSearch('');
    if (refocus) buttonRef.current?.focus();
  };

  const choose = (option: SelectOption | undefined) => {
    if (!option || option.disabled) return;
    commit(option.value);
    close();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (props.disabled || isEmpty) return;
    const { key } = event;
    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, visible.length - 1));
    } else if (key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (key === 'End') {
      event.preventDefault();
      setActive(visible.length - 1);
    } else if (key === 'Enter') {
      event.preventDefault();
      choose(visible[active]);
    } else if (key === ' ' && !searchable) {
      event.preventDefault();
      choose(visible[active]);
    } else if (key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (key === 'Tab') {
      close(false);
    } else if (!searchable && key.length === 1 && /\S/.test(key)) {
      // Escribir salta a la primera opción que empieza por lo tecleado (como un select nativo).
      const now = Date.now();
      typed.current = { text: now - typed.current.at < 800 ? typed.current.text + key : key, at: now };
      const term = normalize(typed.current.text);
      const index = visible.findIndex((option) => normalize(option.label).startsWith(term));
      if (index >= 0) setActive(index);
    }
  };

  const activeId = open && visible[active] ? `${listId}-${active}` : undefined;
  const buttonClass = cn(
    'flex w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white text-left text-slate-900 outline-none focus:border-[#006a61] focus:ring-2 focus:ring-[#006a61]/20 disabled:bg-slate-100 disabled:text-slate-500',
    props.compact ? 'h-9 px-3 text-xs font-semibold text-slate-700' : 'h-9 px-3 text-sm',
    props.className,
  );

  return (
    <div className="relative min-w-0">
      <input
        ref={hiddenRef}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        name={props.name}
        value={value}
        required={props.required}
        disabled={props.disabled}
        onChange={() => {}}
        onInvalid={(event) => event.currentTarget.setCustomValidity('Elige una opción de la lista.')}
        onInput={(event) => event.currentTarget.setCustomValidity('')}
      />
      <button
        ref={buttonRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={activeId}
        aria-describedby={props.describedById}
        aria-label={props.ariaLabel}
        aria-required={props.required}
        data-testid={props.testId ?? `select-${props.name}`}
        data-value={value}
        disabled={props.disabled || isEmpty}
        className={buttonClass}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onKeyDown}
        onFocus={props.onFocus}
        onBlur={props.onBlur}
      >
        <span className={cn('truncate', !selected && 'text-slate-500')}>
          {isEmpty ? (props.emptyLabel ?? '— No hay datos registrados —') : (selected?.label ?? props.placeholder ?? 'Elige una opción')}
        </span>
        <Icon name={open ? 'expand_less' : 'expand_more'} className="shrink-0 text-[18px] text-slate-500" />
      </button>
      {selected?.description && !props.compact ? (
        <span className="mt-1 block text-[11px] text-slate-500" data-testid={`select-${props.name}-descripcion`}>
          {selected.description}
        </span>
      ) : null}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              style={{
                position: 'fixed',
                left: rect?.left ?? -9999,
                width: rect?.width ?? 240,
                ...(rect?.up ? { bottom: window.innerHeight - (rect.top ?? 0) } : { top: rect?.top ?? -9999 }),
              }}
              className="z-[130] min-w-56 overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl"
              onKeyDown={onKeyDown}
            >
              {searchable ? (
                <div className="border-b border-slate-100 p-2">
                  <input
                    ref={searchRef}
                    role="searchbox"
                    aria-label="Buscar una opción"
                    aria-controls={listId}
                    aria-activedescendant={activeId}
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setActive(0);
                    }}
                    placeholder="Escribe para filtrar…"
                    className="h-8 w-full rounded border border-slate-300 px-2 text-sm outline-none focus:border-[#006a61]"
                  />
                </div>
              ) : null}
              <ul ref={listRef} id={listId} role="listbox" aria-labelledby={id} className="max-h-72 overflow-y-auto py-1" tabIndex={-1}>
                {visible.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-slate-500">Ninguna opción coincide.</li>
                ) : (
                  visible.map((option, index) => {
                    const isSelected = option.value === value;
                    const isActive = index === active;
                    return (
                      <li
                        key={option.value || `vacio-${index}`}
                        id={`${listId}-${index}`}
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={option.disabled}
                        data-index={index}
                        data-testid={`select-${props.name}-option-${option.value}`}
                        title={option.description}
                        className={cn(
                          'cursor-pointer px-3 py-2',
                          isActive && 'bg-[#006a61]/10',
                          isSelected && 'font-semibold text-[#006a61]',
                          option.disabled && 'cursor-not-allowed opacity-50',
                        )}
                        onMouseEnter={() => setActive(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => choose(option)}
                      >
                        <span className="block text-sm leading-tight">{option.label || ' '}</span>
                        {option.description ? <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-slate-500">{option.description}</span> : null}
                      </li>
                    );
                  })
                )}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
