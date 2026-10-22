import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { armarHilo, CompositorDeChat, InicioDeChat } from '@/components/support/ChatSoporte';

type M = { messageId: string; createdAt: string; lado: 'mio' | 'suyo' | 'sistema' };
const m = (id: string, createdAt: string, lado: M['lado']): M => ({ messageId: id, createdAt, lado });

describe('chat de soporte del comercio', () => {
  it('separa por día y agrupa los mensajes seguidos del mismo lado', () => {
    const hilo = armarHilo(
      [m('1', '2026-10-21T10:00:00', 'mio'), m('2', '2026-10-22T09:00:00', 'suyo'), m('3', '2026-10-22T09:01:00', 'suyo'), m('4', '2026-10-22T09:02:00', 'mio')],
      (x) => x.lado,
      new Date('2026-10-22T15:00:00'),
    );
    expect(hilo.flatMap((e) => (e.tipo === 'dia' ? [e.etiqueta] : []))).toEqual(['Ayer', 'Hoy']);
    expect(hilo.flatMap((e) => (e.tipo === 'mensaje' ? [[e.clave, e.primeroDelGrupo, e.ultimoDelGrupo]] : []))).toEqual([
      ['1', true, true],
      ['2', true, false],
      ['3', false, true],
      ['4', true, true],
    ]);
  });

  it('Enter envía y Shift+Enter no', () => {
    const enviar = vi.fn();
    render(<CompositorDeChat texto="hola" onChange={() => undefined} onEnviar={enviar} />);
    const campo = screen.getByLabelText('Tu mensaje');
    fireEvent.keyDown(campo, { key: 'Enter', shiftKey: true });
    expect(enviar).not.toHaveBeenCalled();
    fireEvent.keyDown(campo, { key: 'Enter' });
    expect(enviar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeTruthy();
  });

  it('un tema frecuente escribe la primera frase', () => {
    const elegir = vi.fn();
    render(<InicioDeChat onElegir={elegir} />);
    fireEvent.click(screen.getByRole('button', { name: 'Empezar con: El QR de cobro no funciona' }));
    expect(elegir).toHaveBeenCalledWith('El QR de cobro no funciona');
  });
});
