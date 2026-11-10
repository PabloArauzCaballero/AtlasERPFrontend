import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginScreen } from '@/components/auth/LoginScreen';

const { replace, login, loginMerchant } = vi.hoisted(() => ({ replace: vi.fn(), login: vi.fn(), loginMerchant: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/authContext', () => ({
  useAuth: () => ({ login, verifyLoginPin: vi.fn(), loginMerchant, status: 'unauthenticated', isMerchant: false }),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe('Acceso · una puerta por población', () => {
  it('el acceso del comercio no ofrece pestañas ni habla del panel interno', () => {
    render(<LoginScreen audience="merchant" />);

    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByLabelText(/correo del comercio/i)).toBeTruthy();
    expect(screen.queryByText(/panel administrativo interno/i)).toBeNull();
    expect(screen.getByRole('link', { name: /olvidaste tu contraseña/i }).getAttribute('href')).toBe(
      '/recuperar-acceso?canal=comercio',
    );
  });

  it('el acceso interno pide el correo corporativo y recupera por su canal', () => {
    render(<LoginScreen audience="internal" />);

    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.getByLabelText(/correo corporativo/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /olvidaste tu contraseña/i }).getAttribute('href')).toBe(
      '/recuperar-acceso?canal=interno',
    );
  });

  it('cada puerta enlaza a la otra, para quien llegó a la que no era suya', () => {
    render(<LoginScreen audience="merchant" />);
    expect(screen.getByRole('link', { name: /acceso interno/i }).getAttribute('href')).toBe('/login/interno');
    cleanup();

    render(<LoginScreen audience="internal" />);
    expect(screen.getByRole('link', { name: /portal del comercio/i }).getAttribute('href')).toBe('/login/comercios');
  });

  it('ya no explica cookies ni tokens a quien sólo viene a entrar', () => {
    render(<LoginScreen audience="merchant" />);

    expect(screen.queryByText(/token de refresco/i)).toBeNull();
    expect(screen.queryByText(/HttpOnly/i)).toBeNull();
  });

  it('el comercio entra por su canal, va a su portal y el navegador recuerda su puerta', async () => {
    loginMerchant.mockResolvedValueOnce(undefined);
    render(<LoginScreen audience="merchant" />);

    const email = 'caja@comercio.test';
    const password = ['clave', 'de', 'prueba'].join('-');
    fireEvent.change(screen.getByLabelText(/correo del comercio/i), { target: { value: email } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/portal-comercio/gestion-pos'));
    expect(loginMerchant).toHaveBeenCalledWith({ email, password });
    expect(login).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('atlas_last_audience')).toBe('merchant');
  });
});
