import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionLimits } from '@/hooks/useSessionLimits';
import { CLAVE_ULTIMA_ACTIVIDAD, IDLE_LIMIT_MS, WARNING_BEFORE_MS } from '@/lib/sessionLimits';

beforeEach(() => {
  vi.useFakeTimers({ now: 1_000_000 });
  window.localStorage.clear();
});
afterEach(() => vi.useRealTimers());

describe('useSessionLimits (ERP-06)', () => {
  it('avisa un minuto antes y cierra a los 15 minutos sin actividad', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useSessionLimits({ active: true, onExpire }));
    act(() => vi.advanceTimersByTime(IDLE_LIMIT_MS - WARNING_BEFORE_MS - 1_000));
    expect(result.current.secondsLeft).toBeNull();
    act(() => vi.advanceTimersByTime(2_000));
    expect(result.current.secondsLeft).toBeGreaterThan(0);
    expect(onExpire).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(WARNING_BEFORE_MS));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('una tecla reinicia la cuenta; mover el ratón, no', () => {
    const onExpire = vi.fn();
    renderHook(() => useSessionLimits({ active: true, onExpire }));
    act(() => vi.advanceTimersByTime(IDLE_LIMIT_MS - 5_000));
    act(() => {
      window.dispatchEvent(new Event('mousemove'));
      window.dispatchEvent(new KeyboardEvent('keydown'));
    });
    act(() => vi.advanceTimersByTime(10_000));
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('«Seguir trabajando» quita el aviso y lo apunta para las demás pestañas', () => {
    const { result } = renderHook(() => useSessionLimits({ active: true, onExpire: vi.fn() }));
    act(() => vi.advanceTimersByTime(IDLE_LIMIT_MS - 30_000));
    expect(result.current.secondsLeft).not.toBeNull();
    act(() => result.current.keepAlive());
    expect(result.current.secondsLeft).toBeNull();
    expect(Number(window.localStorage.getItem(CLAVE_ULTIMA_ACTIVIDAD))).toBe(Date.now());
  });

  it('la actividad de otra pestaña mantiene viva ésta, pero un valor del futuro no', () => {
    const onExpire = vi.fn();
    renderHook(() => useSessionLimits({ active: true, onExpire }));
    act(() => vi.advanceTimersByTime(IDLE_LIMIT_MS - 5_000));
    window.localStorage.setItem(CLAVE_ULTIMA_ACTIVIDAD, String(Date.now()));
    act(() => vi.advanceTimersByTime(10_000));
    expect(onExpire).not.toHaveBeenCalled();

    window.localStorage.setItem(CLAVE_ULTIMA_ACTIVIDAD, String(Date.now() + IDLE_LIMIT_MS * 100));
    act(() => vi.advanceTimersByTime(IDLE_LIMIT_MS + 1_000));
    expect(onExpire).toHaveBeenCalled();
  });

  it('sin sesión no vigila nada', () => {
    const onExpire = vi.fn();
    renderHook(() => useSessionLimits({ active: false, onExpire }));
    act(() => vi.advanceTimersByTime(IDLE_LIMIT_MS * 2));
    expect(onExpire).not.toHaveBeenCalled();
  });
});
