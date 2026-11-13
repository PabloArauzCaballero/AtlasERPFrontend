import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { crearDetectorDeNuevos, crearSondeo } from '@/lib/sondeo';

function visibilidad(inicial = true) {
  let visible = inicial;
  let avisar: (() => void) | null = null;
  return {
    estaVisible: () => visible,
    alCambiarVisibilidad: (fn: () => void) => {
      avisar = fn;
      return () => {
        avisar = null;
      };
    },
    cambiar(valor: boolean) {
      visible = valor;
      avisar?.();
    },
    escuchando: () => avisar !== null,
  };
}

describe('crearSondeo', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('pregunta cada intervalo mientras la pantalla está a la vista', async () => {
    const consultar = vi.fn(async () => undefined);
    const vista = visibilidad();
    const sondeo = crearSondeo({ consultar, ...vista, intervaloMs: 5_000 });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(consultar).toHaveBeenCalledTimes(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(consultar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(consultar).toHaveBeenCalledTimes(2);
    sondeo.detener();
  });

  it('escondida no pregunta; al volver, pregunta enseguida', async () => {
    const consultar = vi.fn(async () => undefined);
    const vista = visibilidad();
    const sondeo = crearSondeo({ consultar, ...vista, intervaloMs: 5_000 });
    vista.cambiar(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(consultar).not.toHaveBeenCalled();
    vista.cambiar(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(consultar).toHaveBeenCalledTimes(1);
    sondeo.detener();
  });

  it('si falla espera el doble cada vez, con tope, y vuelve al ritmo normal al acertar', async () => {
    let fallar = true;
    const consultar = vi.fn(async () => {
      if (fallar) throw new Error('caído');
    });
    const sondeo = crearSondeo({ consultar, ...visibilidad(), intervaloMs: 5_000, maxIntervaloMs: 15_000 });
    await vi.advanceTimersByTimeAsync(5_000); // 1.ª, falla → espera 10 s
    await vi.advanceTimersByTimeAsync(9_999);
    expect(consultar).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); // 2.ª, falla → espera 15 s (tope)
    expect(consultar).toHaveBeenCalledTimes(2);
    fallar = false;
    await vi.advanceTimersByTimeAsync(15_000); // 3.ª, acierta → vuelve a 5 s
    expect(consultar).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(consultar).toHaveBeenCalledTimes(4);
    sondeo.detener();
  });

  it('detener apaga el reloj y deja de escuchar la visibilidad', async () => {
    const consultar = vi.fn(async () => undefined);
    const vista = visibilidad();
    const sondeo = crearSondeo({ consultar, ...vista, intervaloMs: 5_000 });
    sondeo.detener();
    expect(vista.escuchando()).toBe(false);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(consultar).not.toHaveBeenCalled();
  });

  it('nunca hay dos preguntas a la vez', async () => {
    let soltar: () => void = () => undefined;
    const consultar = vi.fn(() => new Promise<void>((resolver) => (soltar = resolver)));
    const vista = visibilidad();
    const sondeo = crearSondeo({ consultar, ...vista, intervaloMs: 5_000 });
    await vi.advanceTimersByTimeAsync(5_000);
    sondeo.ahora();
    vista.cambiar(true);
    expect(consultar).toHaveBeenCalledTimes(1);
    soltar();
    sondeo.detener();
  });
});

describe('crearDetectorDeNuevos', () => {
  it('la primera lectura no avisa; las siguientes devuelven sólo lo que no estaba', () => {
    const detectar = crearDetectorDeNuevos<{ id: string }>((item) => item.id);
    expect(detectar([{ id: 'a' }, { id: 'b' }])).toEqual([]);
    expect(detectar([{ id: 'a' }, { id: 'b' }, { id: 'c' }])).toEqual([{ id: 'c' }]);
    expect(detectar([{ id: 'c' }])).toEqual([]);
    expect(detectar([{ id: 'c' }, { id: 'a' }])).toEqual([{ id: 'a' }]);
  });
});
