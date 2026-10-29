import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '@/app/login/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/components/atlas/AmbientBackground', () => ({ AmbientBackground: () => null }));

const { login } = vi.hoisted(() => ({ login: vi.fn() }));
vi.mock('@/lib/authContext', () => ({
  useAuth: () => ({ login, verifyLoginPin: vi.fn(), loginMerchant: vi.fn(), status: 'unauthenticated', isMerchant: false }),
}));

afterEach(cleanup);

describe('Acceso · paso del código de verificación', () => {
  it('dice qué hacer si el código no llega, sin prometer un reenvío que no existe', async () => {
    login.mockResolvedValueOnce({ pinChallengeRequired: true, challengeToken: 'token-de-prueba', expiresInMinutes: 10 });
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/correo corporativo/i), { target: { value: 'qa@example.test' } });
    fireEvent.change(screen.getByLabelText(/contraseña/i), { target: { value: 'clave-de-prueba' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar|ingresar|iniciar/i }));

    const ayuda = await screen.findByText(/correo no deseado/i);
    expect(ayuda.textContent).toMatch(/usar otra cuenta/i);
    expect(screen.queryByText(/reenviar/i)).toBeNull();
    expect(screen.getByText('Usar otra cuenta')).toBeTruthy();
  });
});
