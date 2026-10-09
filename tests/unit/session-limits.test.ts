import { afterEach, describe, expect, it } from 'vitest';
import {
  ACTIVITY_EVENTS,
  CLAVE_ULTIMA_ACTIVIDAD,
  IDLE_LIMIT_MS,
  WARNING_BEFORE_MS,
  actividadCompartida,
  apuntarActividadCompartida,
  faseDeSesion,
  msHastaElCierre,
} from '@/lib/sessionLimits';

afterEach(() => window.localStorage.clear());

describe('límites de sesión (ERP-06: cierre por inactividad)', () => {
  it('15 minutos de inactividad con aviso 1 minuto antes', () => {
    expect(IDLE_LIMIT_MS).toBe(15 * 60_000);
    expect(WARNING_BEFORE_MS).toBe(60_000);
  });

  it('mover el ratón o desplazarse no cuenta como actividad', () => {
    expect(ACTIVITY_EVENTS).not.toContain('mousemove');
    expect(ACTIVITY_EVENTS).not.toContain('scroll');
    expect(ACTIVITY_EVENTS).toContain('keydown');
  });

  it('pasa de activa a aviso y de aviso a cerrar', () => {
    const t0 = 1_000_000;
    expect(faseDeSesion(t0, t0)).toEqual({ fase: 'activa' });
    expect(faseDeSesion(t0, t0 + IDLE_LIMIT_MS - WARNING_BEFORE_MS - 1)).toEqual({ fase: 'activa' });
    expect(faseDeSesion(t0, t0 + IDLE_LIMIT_MS - WARNING_BEFORE_MS)).toEqual({ fase: 'aviso', segundos: 60 });
    expect(faseDeSesion(t0, t0 + IDLE_LIMIT_MS - 1_500)).toEqual({ fase: 'aviso', segundos: 2 });
    expect(faseDeSesion(t0, t0 + IDLE_LIMIT_MS)).toEqual({ fase: 'cerrar' });
    expect(faseDeSesion(t0, t0 + IDLE_LIMIT_MS * 10)).toEqual({ fase: 'cerrar' });
  });

  it('el tiempo restante nunca es negativo', () => {
    expect(msHastaElCierre(0, IDLE_LIMIT_MS * 2)).toBe(0);
    expect(msHastaElCierre(100, 100)).toBe(IDLE_LIMIT_MS);
  });

  it('la actividad se comparte entre pestañas por localStorage', () => {
    expect(actividadCompartida()).toBe(0);
    apuntarActividadCompartida(123_456);
    expect(window.localStorage.getItem(CLAVE_ULTIMA_ACTIVIDAD)).toBe('123456');
    expect(actividadCompartida()).toBe(123_456);
  });

  it('un valor basura en localStorage cuenta como «sin actividad»', () => {
    window.localStorage.setItem(CLAVE_ULTIMA_ACTIVIDAD, 'mañana');
    expect(actividadCompartida()).toBe(0);
    window.localStorage.setItem(CLAVE_ULTIMA_ACTIVIDAD, '-5');
    expect(actividadCompartida()).toBe(0);
  });
});
