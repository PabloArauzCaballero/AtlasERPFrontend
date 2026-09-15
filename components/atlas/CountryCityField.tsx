'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/atlas/Icon';
import { FieldLabel } from '@/components/atlas/FieldLabel';
import { useFieldHelp } from '@/components/atlas/FieldTooltip';
import { findGeoCountry, flagEmoji, geoCountries } from '@/lib/geo';

interface CountryCityFieldProps {
  label: string;
  /** Nombre del control que lleva el código ISO del país (dos letras). */
  name: string;
  /** Nombre del control que lleva la ciudad (texto). */
  cityName: string;
  hint?: string | undefined;
  tooltip?: string | undefined;
  required?: boolean | undefined;
  softRequired?: boolean | undefined;
  className?: string | undefined;
  defaultCountryCode?: string | undefined;
  defaultCity?: string | undefined;
}

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * País y ciudad en un solo selector en árbol.
 *
 * Un `<select>` nativo no puede pintar banderas ni anidar ciudades bajo cada país, y tener dos
 * listas sueltas permitía elegir «Bolivia» y «Madrid». Aquí el país es la rama y las ciudades sus
 * hojas: al elegir una hoja quedan fijados los dos valores a la vez, y siempre son coherentes.
 *
 * La bandera se deriva del código ISO (ver `flagEmoji`), así que no hay imágenes que cargar.
 * Se entrega al formulario con dos inputs ocultos (`name` y `cityName`) para que el envío no
 * cambie respecto de los dos selects que había antes.
 */
export function CountryCityField(props: CountryCityFieldProps) {
  const [countryCode, setCountryCode] = useState(() => findGeoCountry(props.defaultCountryCode)?.code ?? props.defaultCountryCode?.toUpperCase() ?? '');
  const [city, setCity] = useState(props.defaultCity ?? '');
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(countryCode || null);
  const [customCity, setCustomCity] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey, true);
    searchRef.current?.focus();
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('keydown', onKey, true); };
  }, [open]);

  const selected = findGeoCountry(countryCode);

  // Con búsqueda, se filtran países por nombre y también ciudades: «cocha» abre Bolivia con
  // Cochabamba como única hoja. Sin búsqueda, el árbol entero con las ramas cerradas.
  const tree = useMemo(() => {
    const term = normalize(search.trim());
    if (!term) return geoCountries.map((country) => ({ country, cities: country.cities, forced: false }));
    return geoCountries
      .map((country) => {
        const countryHit = normalize(country.name).includes(term) || country.code.toLowerCase() === term;
        const cities = countryHit ? country.cities : country.cities.filter((name) => normalize(name).includes(term));
        return { country, cities, forced: !countryHit && cities.length > 0 };
      })
      .filter((row) => normalize(row.country.name).includes(term) || row.country.code.toLowerCase() === term || row.cities.length > 0);
  }, [search]);

  const choose = (code: string, cityName: string) => {
    setCountryCode(code);
    setCity(cityName);
    setExpanded(code);
    setCustomCity('');
    setSearch('');
    setOpen(false);
  };

  const id = useId();
  const help = useFieldHelp(props.tooltip);
  const summary = selected
    ? `${flagEmoji(selected.code)} ${selected.name}${city ? ` · ${city}` : ''}`
    : countryCode ? `${flagEmoji(countryCode)} ${countryCode}${city ? ` · ${city}` : ''}` : '— Elegir país y ciudad —';

  return (
    <div ref={rootRef} className={cn('relative block min-w-0', props.className)}>
      <FieldLabel htmlFor={id} label={props.label} required={props.required || props.softRequired} tooltip={props.tooltip} describedById={help.describedById} controlFocused={help.focused} />
      <button
        type="button"
        id={id}
        aria-describedby={help.describedById}
        onFocus={help.onFocus}
        onBlur={help.onBlur}
        aria-haspopup="tree"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 text-left text-sm text-slate-900 outline-none focus:border-[#006a61] focus:ring-2 focus:ring-[#006a61]/20"
      >
        <span className={cn('truncate', !countryCode && 'text-slate-500')}>{summary}</span>
        <Icon name={open ? 'expand_less' : 'expand_more'} className="shrink-0 text-[18px] text-slate-500" />
      </button>
      <input type="hidden" name={props.name} value={countryCode} required={props.required} />
      <input type="hidden" name={props.cityName} value={city} />
      {props.hint ? <span className="mt-1 block text-[11px] text-slate-500">{props.hint}</span> : null}

      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-200 p-2">
            <div className="flex h-8 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 focus-within:border-[#006a61] focus-within:ring-2 focus-within:ring-[#006a61]/20">
              <Icon name="search" className="text-[16px] text-slate-400" />
              <input
                ref={searchRef}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar país o ciudad..."
                className="h-full w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-500"
              />
            </div>
          </div>
          <ul role="tree" className="max-h-72 overflow-y-auto py-1 text-sm">
            {tree.length === 0 ? <li className="px-3 py-2 text-xs text-slate-500">Sin coincidencias.</li> : null}
            {tree.map(({ country, cities, forced }) => {
              const isOpen = forced || expanded === country.code;
              const isSelectedCountry = country.code === countryCode;
              return (
                <li key={country.code} role="treeitem" aria-expanded={isOpen} aria-selected={isSelectedCountry}>
                  <div className={cn('flex items-center gap-1 px-2', isSelectedCountry && 'bg-primary-wash/60')}>
                    <button
                      type="button"
                      aria-label={isOpen ? `Contraer ${country.name}` : `Desplegar ${country.name}`}
                      onClick={() => setExpanded((current) => (current === country.code ? null : country.code))}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded text-slate-500 hover:bg-slate-100"
                    >
                      <Icon name={isOpen ? 'expand_more' : 'chevron_right'} className="text-[18px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => choose(country.code, '')}
                      title="Elegir el país sin ciudad"
                      className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded px-1 text-left hover:bg-slate-50"
                    >
                      <span className="text-base leading-none">{flagEmoji(country.code)}</span>
                      <span className={cn('truncate', isSelectedCountry ? 'font-bold text-primary' : 'font-semibold text-slate-800')}>{country.name}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-slate-400">{country.code}</span>
                    </button>
                  </div>
                  {isOpen ? (
                    <ul role="group" className="mb-1 ml-9 border-l border-slate-200">
                      {cities.map((name) => {
                        const isSelectedCity = isSelectedCountry && name === city;
                        return (
                          <li key={name} role="treeitem" aria-selected={isSelectedCity}>
                            <button
                              type="button"
                              onClick={() => choose(country.code, name)}
                              className={cn('flex h-7 w-full items-center gap-2 px-3 text-left hover:bg-slate-50', isSelectedCity ? 'font-bold text-primary' : 'text-slate-700')}
                            >
                              <Icon name={isSelectedCity ? 'location_on' : 'fiber_manual_record'} className={cn(isSelectedCity ? 'text-[15px]' : 'text-[7px] text-slate-300')} />
                              <span className="truncate">{name}</span>
                            </button>
                          </li>
                        );
                      })}
                      <li className="px-3 py-1">
                        {/* Sin <form> anidado (es HTML inválido dentro del formulario padre): Enter se captura a mano. */}
                        <div className="flex items-center gap-1">
                          <input
                            value={expanded === country.code ? customCity : ''}
                            onFocus={() => setExpanded(country.code)}
                            onChange={(event) => setCustomCity(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key !== 'Enter') return;
                              event.preventDefault();
                              event.stopPropagation();
                              if (customCity.trim()) choose(country.code, customCity.trim());
                            }}
                            placeholder="Otra ciudad..."
                            className="h-7 min-w-0 flex-1 rounded border border-dashed border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#006a61]"
                          />
                          <button
                            type="button"
                            aria-label="Usar esta ciudad"
                            onClick={() => { if (customCity.trim()) choose(country.code, customCity.trim()); }}
                            className="grid h-7 w-7 place-items-center rounded text-primary hover:bg-primary-wash"
                          >
                            <Icon name="check" className="text-[16px]" />
                          </button>
                        </div>
                      </li>
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
