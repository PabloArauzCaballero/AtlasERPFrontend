'use client';

import { AddressMapField } from '@/components/atlas/AddressMapField';
import { ChipsField } from '@/components/atlas/ChipsField';
import { CountryCityField } from '@/components/atlas/CountryCityField';
import { FormField } from '@/components/atlas/FormField';
import { MultiSelectField } from '@/components/atlas/MultiSelectField';
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

/** Un campo con fuente de opciones y sin `type` es un select: la fuente ya dice que el dominio es cerrado. */
export function isSelectField(field: ActionField): boolean {
  if (field.type === 'select') return true;
  return !field.type && Boolean(field.optionsSource || field.optionsLoader || field.optionsLoaderFor || field.options);
}

/**
 * Definiciones para `formDataToPayload`.
 *
 * El tipo del control ya dice cómo hay que convertir el valor: un `datetime-local` entrega un texto
 * sin zona horaria que hay que pasar a ISO. Deducirlo aquí evita tener que repetir
 * `valueKind: 'datetime'` en cada pantalla y olvidarlo en una.
 */
export function payloadDefinitions(fields: ActionField[]): PayloadFieldDefinition[] {
  return fields
    // Lo que asigna el backend no viaja: el control se pinta sólo para enseñarlo.
    .filter((field) => !field.assignedByBackend)
    .map((field) => ({
      name: field.name,
      valueKind:
        field.valueKind ??
        (field.type === 'datetime' ? 'datetime' : field.type === 'multiselect' ? 'codeList' : undefined),
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

  /*
   * Un número que asigna el sistema NO se pinta mientras no existe: al crear era una caja vacía con
   * un aviso de que ya se llenará, que sólo ocupa sitio y hace dudar de si falta rellenarla. Cuando
   * ya hay valor —al abrir o editar un registro— se enseña, sin explicaciones de quién lo puso.
   */
  if (field.assignedByBackend) {
    const assigned = defaultValue !== undefined && defaultValue !== null ? String(defaultValue) : '';
    if (!assigned) return null;
    return (
      <FormField
        name=""
        label={field.label}
        value={assigned}
        readOnly
        tabIndex={-1}
        {...(field.hint ? { hint: field.hint } : {})}
        tooltip={field.tooltip}
        className={className}
      />
    );
  }

  if (field.type === 'multiselect') {
    return (
      <MultiSelectField
        name={field.name}
        label={field.label}
        options={field.options ?? dynamicOptions[field.name] ?? []}
        defaultValue={defaultValue !== undefined ? String(defaultValue) : undefined}
        required={required}
        softRequired={props.softRequired}
        hint={field.hint}
        tooltip={field.tooltip}
        className={className}
      />
    );
  }

  if (field.type === 'chips') {
    return (
      <ChipsField
        name={field.name}
        label={field.label}
        required={field.required}
        defaultValue={typeof defaultValue === 'string' ? defaultValue : undefined}
        placeholder={field.placeholder}
        hint={field.hint}
        tooltip={field.tooltip}
        className={className}
      />
    );
  }

  if (field.type === 'countryCity') {
    return (
      <CountryCityField
        name={field.name}
        cityName={field.cityFieldName ?? 'city'}
        label={field.label}
        required={required}
        softRequired={props.softRequired}
        defaultCountryCode={typeof defaultValue === 'string' ? defaultValue : undefined}
        defaultCity={field.defaultCity}
        hint={field.hint}
        tooltip={field.tooltip}
        className={className}
      />
    );
  }

  if (field.type === 'address') {
    return (
      <AddressMapField
        name={field.name}
        label={field.label}
        required={required}
        softRequired={props.softRequired}
        defaultValue={typeof defaultValue === 'string' ? defaultValue : undefined}
        placeholder={field.placeholder}
        hint={field.hint}
        tooltip={field.tooltip}
        cityFieldName={field.cityFieldName}
        countryFieldName={field.countryFieldName}
        className={className}
      />
    );
  }

  if (isSelectField(field)) {
    const loaded = field.options ?? dynamicOptions[field.name] ?? [];
    const current = defaultValue !== undefined && defaultValue !== null ? String(defaultValue) : '';
    // Un valor guardado que ya no está en la lista (texto libre de antes) se conserva visible: sin
    // esto el select mostraría la primera opción y al guardar la fila cambiaría sin que nadie lo pida.
    const withCurrent =
      current && loaded.length && !loaded.some((option) => option.value === current)
        ? [...loaded, { value: current, label: `${current} (valor anterior)` }]
        : loaded;
    // Sólo un select declarado OPCIONAL (o con emptyOption) lleva opción vacía: si no, un campo que no
    // es obligatorio pero tampoco admite vacío (el estado de un segmento) mandaría '' y el backend lo rechazaría.
    const withEmpty =
      !field.required && (field.optional || field.emptyOption) && withCurrent.length && withCurrent[0]?.value !== ''
        ? [{ value: '', label: field.emptyOption ?? '— Sin definir —' }, ...withCurrent]
        : withCurrent;
    return (
      <FormField
        // Las opciones llegan después del primer render y un <select> no controlado sólo aplica su
        // defaultValue al montar: se remonta cuando cambian para que el valor de la fila se vea.
        key={`${field.name}:${withEmpty.length}:${withEmpty[0]?.value ?? ''}`}
        kind="select"
        name={field.name}
        label={field.label}
        required={required}
        softRequired={props.softRequired}
        defaultValue={defaultValue}
        hint={field.hint}
        tooltip={field.tooltip}
        options={withEmpty}
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
        tooltip={field.tooltip}
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
      {...decimalesPermitidos(field)}
      defaultValue={defaultValue}
      placeholder={field.placeholder}
      hint={field.hint}
      tooltip={field.tooltip}
      className={className}
    />
  );
}

/**
 * Un campo numérico acepta CÉNTIMOS.
 *
 * Sin `step`, el navegador aplica `step="1"` y rechaza cualquier decimal: el formulario
 * sencillamente no se envía y el único aviso es un globo del navegador. Medido el 2026-09-19
 * emitiendo una factura de 0,01: el botón respondía y no pasaba nada. Afectaba a TODO campo
 * `type: 'number'` declarado en un formulario del ERP —importes de factura, impuestos, montos de
 * recibo, tarifas, comisiones—, es decir, a casi todo lo que es dinero.
 *
 * `any` y no `0.01` porque por aquí pasan también cantidades y porcentajes con más decimales; el
 * número de decimales que admite cada importe lo valida el backend, que es quien lo sabe.
 */
function decimalesPermitidos(field: ActionField): { step?: string; inputMode?: 'decimal' } {
  return field.type === 'number' ? { step: 'any', inputMode: 'decimal' } : {};
}
