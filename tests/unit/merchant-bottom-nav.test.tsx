import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MerchantBottomNav } from '@/components/layout/MerchantBottomNav';
import { PORTAL_COMERCIO_NAV } from '@/components/layout/navigation';

afterEach(cleanup);

function renderBar(pathname = '/portal-comercio/gestion-pos') {
  render(<MerchantBottomNav pathname={pathname} />);
}

describe('MerchantBottomNav · los cuatro destinos del comercio', () => {
  it('lleva a las cuatro pantallas del portal, y sólo a ésas', () => {
    renderBar();

    const enlaces = screen.getAllByRole('link');
    expect(enlaces.map((enlace) => enlace.getAttribute('href'))).toEqual([
      '/portal-comercio/gestion-pos',
      '/portal-comercio/cartera',
      '/portal-comercio/expediente',
      '/portal-comercio/soporte',
    ]);
  });

  it('no inventa rutas: todas existen en PORTAL_COMERCIO_NAV, que es de donde lee el asistente', () => {
    renderBar();

    const conocidas = new Set(PORTAL_COMERCIO_NAV.map((item) => item.href));
    for (const enlace of screen.getAllByRole('link')) {
      expect(conocidas.has(enlace.getAttribute('href') ?? '')).toBe(true);
    }
  });

  it('marca con aria-current la pantalla actual, y sólo ella', () => {
    renderBar('/portal-comercio/soporte');

    expect(screen.getByRole('link', { name: 'Soporte' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'POS' }).hasAttribute('aria-current')).toBe(false);
  });

  it('una pantalla anidada deja activa su pestaña', () => {
    renderBar('/portal-comercio/expediente/sucursales');

    expect(screen.getByRole('link', { name: 'Mi empresa' }).getAttribute('aria-current')).toBe('page');
  });

  it('«Cartera» queda activa también en la pantalla de facturación', () => {
    renderBar('/portal-comercio/facturacion');

    expect(screen.getByRole('link', { name: 'Cartera' }).getAttribute('aria-current')).toBe('page');
  });

  it('fuera del portal ninguna pestaña está activa', () => {
    renderBar('/operaciones');

    for (const enlace of screen.getAllByRole('link')) {
      expect(enlace.hasAttribute('aria-current')).toBe(false);
    }
  });

  it('un prefijo parecido NO activa la pestaña (solo la ruta o sus hijos)', () => {
    renderBar('/portal-comercio/soporte-extra');

    expect(screen.getByRole('link', { name: 'Soporte' }).hasAttribute('aria-current')).toBe(false);
  });

  it('solo existe por debajo de lg: en escritorio manda el lateral', () => {
    renderBar();

    expect(screen.getByRole('navigation', { name: 'Accesos del portal' }).classList.contains('lg:hidden')).toBe(true);
  });
});
