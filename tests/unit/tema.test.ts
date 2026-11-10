import { afterEach, describe, expect, it } from 'vitest';
import {
  CLAVE_TEMA,
  PREFERENCIA_POR_DEFECTO,
  SCRIPT_DE_TEMA,
  aplicarTema,
  guardarPreferencia,
  leerPreferencia,
  temaEfectivo,
} from '@/lib/tema';

const raiz = () => document.documentElement;

afterEach(() => {
  window.localStorage.clear();
  raiz().removeAttribute('data-theme');
  raiz().removeAttribute('data-theme-pref');
});

describe('preferencia de tema', () => {
  it('sin nada guardado devuelve la preferencia por defecto', () => {
    expect(leerPreferencia()).toBe(PREFERENCIA_POR_DEFECTO);
  });

  it('ignora un valor guardado que no es una preferencia', () => {
    window.localStorage.setItem(CLAVE_TEMA, 'azul');
    expect(leerPreferencia()).toBe(PREFERENCIA_POR_DEFECTO);
  });

  it('«sistema» sigue al sistema operativo; claro y oscuro no', () => {
    expect(temaEfectivo('system', true)).toBe('dark');
    expect(temaEfectivo('system', false)).toBe('light');
    expect(temaEfectivo('dark', false)).toBe('dark');
    expect(temaEfectivo('light', true)).toBe('light');
  });

  it('aplicar escribe el tema en <html> sin guardar nada', () => {
    expect(aplicarTema('dark')).toBe('dark');
    expect(raiz().getAttribute('data-theme')).toBe('dark');
    expect(raiz().getAttribute('data-theme-pref')).toBe('dark');
    expect(window.localStorage.getItem(CLAVE_TEMA)).toBeNull();
  });

  it('guardar persiste la elección y la aplica', () => {
    expect(guardarPreferencia('dark')).toBe('dark');
    expect(window.localStorage.getItem(CLAVE_TEMA)).toBe('dark');
    expect(leerPreferencia()).toBe('dark');
    expect(raiz().getAttribute('data-theme')).toBe('dark');
  });
});

describe('script del primer pintado', () => {
  const ejecutar = () => new Function(SCRIPT_DE_TEMA)();

  it('aplica la preferencia guardada', () => {
    window.localStorage.setItem(CLAVE_TEMA, 'dark');
    ejecutar();
    expect(raiz().getAttribute('data-theme')).toBe('dark');
    expect(raiz().getAttribute('data-theme-pref')).toBe('dark');
  });

  it('sin preferencia hace lo mismo que la librería', () => {
    ejecutar();
    expect(raiz().getAttribute('data-theme')).toBe(temaEfectivo(PREFERENCIA_POR_DEFECTO));
    expect(raiz().getAttribute('data-theme-pref')).toBe(PREFERENCIA_POR_DEFECTO);
  });

  it('no depende de https: ni crypto ni cookies', () => {
    expect(SCRIPT_DE_TEMA).not.toMatch(/crypto|cookie/);
  });
});
