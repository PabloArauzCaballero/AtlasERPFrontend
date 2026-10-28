import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TabbedPanels } from '@/components/atlas/TabbedPanels';

const TABS = [
  { id: 'a', label: 'Solicitudes', content: <p>Contenido A</p> },
  { id: 'b', label: 'Comprobantes', content: <p>Contenido B</p> },
  { id: 'c', label: 'Historial', content: <p>Contenido C</p> },
];

/** jsdom no calcula layout: se fijan las medidas del carril para probar la lógica de «hay más». */
function medidas({ ancho, visible, scrollLeft = 0 }: { ancho: number; visible: number; scrollLeft?: number }) {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(ancho);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(visible);
  vi.spyOn(HTMLElement.prototype, 'scrollLeft', 'get').mockReturnValue(scrollLeft);
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('TabbedPanels · pista de que el carril tiene más pestañas', () => {
  it('si las pestañas no caben, marca que hay más a la derecha', () => {
    medidas({ ancho: 600, visible: 300 });
    render(<TabbedPanels tabs={TABS} />);

    const carril = screen.getByRole('tablist');
    expect(carril.getAttribute('data-mas-derecha')).toBe('true');
    expect(carril.getAttribute('data-mas-izquierda')).toBe('false');
  });

  it('si caben todas no marca nada: sin difuminado donde no hay nada oculto', () => {
    medidas({ ancho: 300, visible: 300 });
    render(<TabbedPanels tabs={TABS} />);

    const carril = screen.getByRole('tablist');
    expect(carril.getAttribute('data-mas-derecha')).toBe('false');
    expect(carril.getAttribute('data-mas-izquierda')).toBe('false');
  });

  it('al desplazarse hasta el final marca que hay más a la izquierda y ya no a la derecha', () => {
    medidas({ ancho: 600, visible: 300, scrollLeft: 300 });
    render(<TabbedPanels tabs={TABS} />);

    const carril = screen.getByRole('tablist');
    fireEvent.scroll(carril);
    expect(carril.getAttribute('data-mas-izquierda')).toBe('true');
    expect(carril.getAttribute('data-mas-derecha')).toBe('false');
  });

  it('elegir una pestaña sigue cambiando el panel (el carril no rompe la selección)', () => {
    medidas({ ancho: 600, visible: 300 });
    render(<TabbedPanels tabs={TABS} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Historial' }));
    expect(screen.getByText('Contenido C')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Historial' }).getAttribute('aria-selected')).toBe('true');
  });

  it('una sola pestaña no pinta carril: no hay nada que difuminar', () => {
    medidas({ ancho: 600, visible: 300 });
    render(<TabbedPanels tabs={[TABS[0]!]} />);

    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('sin ResizeObserver (navegadores antiguos) no falla', () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('ResizeObserver', undefined);
    medidas({ ancho: 600, visible: 300 });

    expect(() => render(<TabbedPanels tabs={TABS} />)).not.toThrow();
  });
});
