'use client';

import { useId } from 'react';
import { FieldTooltip } from '@/components/atlas/FieldTooltip';
import { OptionSelect } from '@/components/atlas/OptionSelect';

export interface DirectoryFilter {
  key: string;
  label: string;
  /** `date`: día (AAAA-MM-DD), el formato que esperan los filtros «desde» / «hasta». */
  kind?: 'select' | 'text' | 'date';
  placeholder?: string;
  options?: Array<{ label: string; value: string; description?: string | undefined }>;
  /**
   * Qué dice la opción de «sin filtrar» cuando «Todo: <etiqueta>» no se lee bien.
   *
   * La plantilla genérica sirve para un criterio con valores («Todo: Categoría»), pero no para uno
   * que es un sí/no: el filtro de archivadas anunciaba «Todos: Archivadas» —que suena a que las está
   * mostrando— justo cuando las está ocultando.
   */
  allLabel?: string;
  /**
   * Qué filtra exactamente, en palabras de quien opera. Pinta el ⓘ junto al control. Para los
   * filtros cuyo comportamiento no es evidente: «el valor exacto», «el identificador del registro».
   */
  tooltip?: string;
}

/**
 * Un filtro de la barra de un directorio en vivo: el control y, si hace falta, su ⓘ.
 *
 * El envoltorio lleva `data-tutorial-id="directory-filter-<key>"` para que un recorrido pueda
 * señalar un filtro concreto (el del registro afectado, en el registro de actividad).
 */
export function DirectoryFilterControl({
  filter,
  value,
  onChange,
}: Readonly<{ filter: DirectoryFilter; value: string; onChange: (value: string) => void }>) {
  const ayudaId = useId();
  const describedBy = filter.tooltip ? ayudaId : undefined;
  const control = filter.kind === 'text' || filter.kind === 'date' ? (
    <input
      type={filter.kind === 'date' ? 'date' : 'text'}
      aria-label={filter.label}
      aria-describedby={describedBy}
      title={filter.kind === 'date' ? filter.label : undefined}
      placeholder={filter.placeholder ?? filter.label}
      data-testid={`filtro-${filter.key}`}
      className="h-9 min-w-36 rounded-md border border-slate-300 bg-white px-3 text-xs text-slate-700"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ) : (
    <OptionSelect
      name={`filtro-${filter.key}`}
      ariaLabel={filter.label}
      describedById={describedBy}
      compact
      className="min-w-44"
      value={value}
      onChange={onChange}
      options={[{ value: '', label: filter.allLabel ?? `Todo: ${filter.label}`, description: 'Sin filtrar por este criterio.' }, ...(filter.options ?? [])]}
    />
  );
  return (
    <div className="flex items-center" data-tutorial-id={`directory-filter-${filter.key}`}>
      {/* Un campo de fecha sólo enseña «dd/mm/aaaa»: sin su nombre, «Desde» y «Hasta» no se distinguen. */}
      {filter.kind === 'date' ? <span className="mr-1.5 text-[11px] font-bold text-slate-600" aria-hidden="true">{filter.label}</span> : null}
      {control}
      {filter.tooltip ? <FieldTooltip text={filter.tooltip} label={filter.label} describedById={ayudaId} /> : null}
    </div>
  );
}
