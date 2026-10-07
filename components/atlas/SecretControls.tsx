'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from '@/components/atlas/Icon';

type ControlProps = InputHTMLAttributes<HTMLInputElement>;

/** Los dígitos del código que ATLAS manda al correo. */
export const PIN_LENGTH = 6;

/**
 * El campo del código de verificación: seis casillas, ni una más.
 *
 * Era una caja de texto a todo el ancho, igual que la del correo: prometía espacio para una frase
 * cuando sólo caben seis dígitos, y dejaba escribir letras que el servidor iba a rechazar. Sigue
 * siendo UN `<input>` y no seis: así el autocompletado del código, pegar desde el correo y el
 * lector de pantalla funcionan sin trucos.
 */
export function PinControl({ className: _className, onChange, maxLength: _maxLength, placeholder: _placeholder, ...props }: ControlProps) {
  return (
    <input
      {...props}
      type="text"
      inputMode="numeric"
      pattern="\d*"
      placeholder={'•'.repeat(PIN_LENGTH)}
      onChange={(event) => {
        // El tope lo pone este recorte y no `maxLength`: el navegador corta lo pegado ANTES de
        // limpiarlo, y un código copiado del correo con espacios («481 516») llegaba incompleto.
        event.target.value = event.target.value.replace(/\D/g, '').slice(0, PIN_LENGTH);
        onChange?.(event);
      }}
      // Clase propia y completa: `cn` del ERP sólo concatena, así que mezclarla con la del control
      // normal dejaría dos altos y dos anchos peleando. 6 dígitos + 6 separaciones de 0,5em.
      className="block h-11 w-[calc(9ch+2.25rem)] max-w-full rounded-md border border-slate-300 bg-white pl-[calc(1.125rem+0.25em)] pr-[1.125rem] font-mono text-xl tracking-[0.5em] text-slate-900 outline-none placeholder:text-slate-300 focus:border-[#006a61] focus:ring-2 focus:ring-[#006a61]/20 disabled:bg-slate-100"
    />
  );
}

/**
 * Un campo de contraseña con el ojito para verla.
 *
 * Quien se equivoca al teclear no tiene cómo saberlo con los puntos. El botón queda fuera del
 * orden de tabulación (`tabIndex={-1}`): Tab sigue yendo del campo al botón de enviar.
 */
export function PasswordControl({ className, type: _type, ...props }: ControlProps) {
  const [visible, setVisible] = useState(false);
  // «clave» y no «contraseña»: el nombre del botón no debe contener la etiqueta del campo, o
  // `getByLabel('Contraseña')` —y un lector de pantalla— encuentran dos cosas.
  const label = visible ? 'Ocultar la clave' : 'Ver la clave';
  return (
    <div className="relative">
      <input {...props} type={visible ? 'text' : 'password'} className={cn(className, 'pr-10')} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((current) => !current)}
        aria-label={label}
        aria-pressed={visible}
        title={label}
        disabled={props.disabled}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006a61]/40 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Icon name={visible ? 'visibility_off' : 'visibility'} className="text-[18px]" />
      </button>
    </div>
  );
}
