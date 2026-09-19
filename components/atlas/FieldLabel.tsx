import type { ReactNode } from 'react';
import { FieldTooltip } from '@/components/atlas/FieldTooltip';

interface FieldLabelProps {
  /** `id` del control al que nombra. Sin él pinta un `<span>` (para `fieldset`/`legend` propios). */
  htmlFor?: string | undefined;
  label: ReactNode;
  required?: boolean | undefined;
  /** Qué poner en el campo y por qué importa. Pinta el ⓘ. */
  tooltip?: string | undefined;
  /** `id` del texto oculto al que apunta el `aria-describedby` del control. */
  describedById?: string | undefined;
  /** El control tiene el foco: la burbuja se abre sin ratón. */
  controlFocused?: boolean | undefined;
  className?: string | undefined;
}

/**
 * La fila de etiqueta de todo campo: texto, asterisco y ⓘ.
 *
 * Antes cada átomo (`FormField`, `ChipsField`, `CountryCityField`, `AddressMapField`,
 * `MultiSelectField`) repetía el mismo `<span>` con el asterisco; al añadir el tooltip habría
 * habido cinco copias más. La etiqueta es un `<label htmlFor>` y el botón de ayuda va al lado,
 * FUERA de ella, para no cambiar el nombre accesible del control.
 */
export function FieldLabel(props: FieldLabelProps) {
  const text = (
    <>
      {props.label}
      {props.required ? <span className="ml-1 text-red-600">*</span> : null}
    </>
  );
  const labelText = typeof props.label === 'string' ? props.label : 'este campo';
  /*
   * `min-w-0` + `break-words`: una etiqueta que no cabe dobla, no se desborda.
   *
   * Sin esto el texto se sale de la caja del campo y aterriza ENCIMA de la etiqueta del campo de
   * al lado, que es como se veía la barra de filtros del directorio el 2026-09-19 («Buscar»
   * pisando a «Tipo»): dos etiquetas ilegibles y ninguna pista de a qué control pertenece cada
   * una. Dobla en vez de recortar a propósito: en el móvil los campos son estrechos y una
   * etiqueta como «Clientes solicitantes de crédito» tiene que caber entera, no con puntos
   * suspensivos.
   */
  return (
    <div className={`mb-1.5 flex min-w-0 items-center text-xs font-bold text-slate-700 ${props.className ?? ''}`}>
      {props.htmlFor ? <label className="min-w-0 break-words" htmlFor={props.htmlFor}>{text}</label> : <span className="min-w-0 break-words">{text}</span>}
      {props.tooltip && props.describedById ? (
        <FieldTooltip text={props.tooltip} label={labelText} describedById={props.describedById} forceOpen={props.controlFocused} />
      ) : null}
    </div>
  );
}
