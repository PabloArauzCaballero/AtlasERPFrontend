import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { FormField } from '@/components/atlas/FormField';

// Sin jest-dom ni limpieza automática en este repo: se compara el DOM a mano.
afterEach(cleanup);

function Pin() {
  const [pin, setPin] = useState('');
  return (
    <FormField tooltip="Código de seis dígitos que te llegó al correo." label="Código de verificación" name="pin" autoComplete="one-time-code" maxLength={6} value={pin} onChange={(event) => setPin(event.target.value)} />
  );
}

describe('FormField · código de un solo uso', () => {
  it('sólo admite dígitos, corta en seis y limpia un código pegado con espacios', () => {
    render(<Pin />);
    const campo = screen.getByLabelText<HTMLInputElement>('Código de verificación');

    fireEvent.change(campo, { target: { value: ' 48a 15-16 99' } });

    expect(campo.value).toBe('481516');
    expect(campo.getAttribute('inputmode')).toBe('numeric');
    // Sin `maxLength`: el navegador cortaría lo pegado antes de limpiarlo.
    expect(campo.hasAttribute('maxlength')).toBe(false);
  });
});

describe('FormField · contraseña con ojito', () => {
  it('empieza oculta y el botón la enseña y la vuelve a ocultar', () => {
    render(<FormField tooltip="Tu contraseña del ERP." label="Contraseña" name="password" type="password" defaultValue="secreta" />);
    const campo = screen.getByLabelText<HTMLInputElement>('Contraseña');
    expect(campo.getAttribute('type')).toBe('password');

    fireEvent.click(screen.getByRole('button', { name: 'Ver la clave' }));
    expect(campo.getAttribute('type')).toBe('text');

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar la clave' }));
    expect(campo.getAttribute('type')).toBe('password');
  });

  it('el ojito no envía el formulario, no roba el Tab y no choca con la etiqueta del campo', () => {
    render(<FormField tooltip="Tu contraseña del ERP." label="Contraseña" name="password" type="password" />);
    const ojito = screen.getByRole('button', { name: 'Ver la clave' });

    expect(ojito.getAttribute('type')).toBe('button');
    expect(ojito.getAttribute('tabindex')).toBe('-1');
    expect(screen.getAllByLabelText(/contraseña/i)).toHaveLength(1);
  });

  it('un campo normal no gana ojito', () => {
    render(<FormField tooltip="El correo con el que te dieron de alta." label="Correo" name="email" type="email" />);
    expect(screen.queryByRole('button', { name: 'Ver la clave' })).toBeNull();
  });
});
