'use client';

import { useId, useRef, useState } from 'react';
import { FieldLabel } from '@/components/atlas/FieldLabel';
import { useFieldHelp } from '@/components/atlas/FieldTooltip';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/atlas/Icon';
import { Modal } from '@/components/atlas/Modal';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { findGeoCountry } from '@/lib/geo';

interface AddressMapFieldProps {
  label: string;
  name: string;
  hint?: string | undefined;
  tooltip?: string | undefined;
  required?: boolean | undefined;
  softRequired?: boolean | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
  defaultValue?: string | undefined;
  /** Nombres de los controles de ciudad y país del MISMO formulario, para situar el mapa. */
  cityFieldName?: string | undefined;
  countryFieldName?: string | undefined;
}

/**
 * Dirección con mapa.
 *
 * El texto se escribe como siempre; el botón del pin (o Enter en el campo) abre un modal con
 * Google Maps centrado en lo escrito. La consulta lleva también la ciudad y el país que tenga el
 * formulario en ese momento, porque «Av. Banzer 1500» sola cae en cualquier parte del mundo.
 *
 * Se usa el embed público de Google Maps (`output=embed`), que no requiere clave de API y admite
 * texto libre. Desde el modal también se puede abrir en Google Maps en otra pestaña.
 */
export function AddressMapField(props: AddressMapFieldProps) {
  const [value, setValue] = useState(props.defaultValue ?? '');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const id = useId();
  const help = useFieldHelp(props.tooltip);

  const openMap = () => {
    const form = inputRef.current?.form;
    const read = (fieldName: string | undefined) => (fieldName && form ? String(new FormData(form).get(fieldName) ?? '').trim() : '');
    const city = read(props.cityFieldName);
    const countryCode = read(props.countryFieldName);
    const country = findGeoCountry(countryCode)?.name ?? countryCode;
    const parts = [value.trim(), city, country].filter(Boolean);
    setQuery(parts.join(', '));
    setOpen(true);
  };

  const encoded = encodeURIComponent(query);
  const embedUrl = `https://www.google.com/maps?q=${encoded}&z=16&output=embed`;
  const externalUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`;

  return (
    <div className={cn('block min-w-0', props.className)}>
      <div>
        <FieldLabel htmlFor={id} label={props.label} required={props.required || props.softRequired} tooltip={props.tooltip} describedById={help.describedById} controlFocused={help.focused} />
        <div className="flex h-9 w-full items-center rounded-md border border-slate-300 bg-white focus-within:border-[#006a61] focus-within:ring-2 focus-within:ring-[#006a61]/20">
          <input
            ref={inputRef}
            id={id}
            aria-describedby={help.describedById}
            onFocus={help.onFocus}
            onBlur={help.onBlur}
            name={props.name}
            value={value}
            required={props.required}
            placeholder={props.placeholder ?? 'Calle, número, zona...'}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); openMap(); } }}
            className="h-full min-w-0 flex-1 rounded-md bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-500"
          />
          <button
            type="button"
            onClick={openMap}
            title="Ver en el mapa"
            aria-label="Ver la dirección en Google Maps"
            className="mr-1 inline-flex h-7 shrink-0 items-center gap-1 rounded px-2 text-xs font-bold text-primary hover:bg-primary-wash"
          >
            <Icon name="location_on" className="text-[18px]" />
            <span className="hidden sm:inline">Mapa</span>
          </button>
        </div>
      </div>
      {props.hint ? <span className="mt-1 block text-[11px] text-slate-500">{props.hint}</span> : null}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        icon="location_on"
        title={props.label}
        description={query || 'Escribe una dirección para situarla en el mapa.'}
        width="lg"
        footer={(
          <>
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Icon name="open_in_new" className="text-[16px]" />
              Abrir en Google Maps
            </a>
            <AtlasButton type="button" onClick={() => setOpen(false)}>Listo</AtlasButton>
          </>
        )}
      >
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {query ? (
            <iframe
              key={embedUrl}
              title={`Mapa de ${query}`}
              src={embedUrl}
              className="block h-[60vh] min-h-80 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          ) : (
            <div className="grid h-60 place-items-center text-sm text-slate-500">Sin dirección que mostrar.</div>
          )}
        </div>
      </Modal>
    </div>
  );
}
