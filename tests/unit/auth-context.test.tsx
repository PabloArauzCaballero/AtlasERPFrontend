import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/lib/authContext';

const mocks = vi.hoisted(() => ({
  bootstrapSession: vi.fn(), clearAccessToken: vi.fn(), finishPendingRefresh: vi.fn(),
  getSessionKind: vi.fn(), setAccessToken: vi.fn(),
  login: vi.fn(), loginPin: vi.fn(), me: vi.fn(), logout: vi.fn(),
  merchantLogin: vi.fn(), merchantMe: vi.fn(), merchantLogout: vi.fn(),
}));

vi.mock('@/lib/apiClient', () => ({
  bootstrapSession: mocks.bootstrapSession,
  clearAccessToken: mocks.clearAccessToken,
  finishPendingRefresh: mocks.finishPendingRefresh,
  getSessionKind: mocks.getSessionKind,
  setAccessToken: mocks.setAccessToken,
}));
vi.mock('@/services/authService', () => ({ authService: {
  login: mocks.login, loginPin: mocks.loginPin, me: mocks.me, logout: mocks.logout,
  merchantLogin: mocks.merchantLogin, merchantMe: mocks.merchantMe, merchantLogout: mocks.merchantLogout,
} }));

const internalUser = {
  id: 'u1', tenantId: 't1', email: 'qa@example.test', fullName: 'QA', name: 'QA', userCode: null,
  status: 'active', department: null, jobTitle: null, mustChangePassword: false, mfaEnabled: true,
  roles: ['admin'], legacyRoles: [], permissions: ['read:ledger'],
};
const merchantUser = {
  id: 'm1', email: 'merchant@example.test', fullName: 'Comercio', userCode: null, phone: null,
  role: 'merchant', status: 'active', mustChangePassword: false, lastLoginAt: null,
};

function Controls() {
  const auth = useAuth();
  return <>
    <output data-testid="status">{auth.status}</output>
    <output data-testid="kind">{auth.sessionKind}</output>
    <output data-testid="identity">{auth.user?.email ?? auth.merchant?.email ?? 'ninguna'}</output>
    <output data-testid="permission">{String(auth.hasPermission('read:ledger'))}</output>
    <button onClick={() => void auth.login({ email: 'qa@example.test', password: 'clave' })}>Entrar interno</button>
    <button onClick={() => void auth.loginMerchant({ email: 'merchant@example.test', password: 'clave' })}>Entrar comercio</button>
    <button onClick={() => void auth.logout()}>Salir</button>
  </>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.bootstrapSession.mockResolvedValue(false);
  mocks.finishPendingRefresh.mockResolvedValue(undefined);
  mocks.getSessionKind.mockReturnValue('internal');
  mocks.logout.mockResolvedValue({ loggedOut: true });
  mocks.merchantLogout.mockResolvedValue({ loggedOut: true });
});
afterEach(cleanup);

it('login interno adopta la sesión y logout la limpia', async () => {
  mocks.login.mockResolvedValue({ accessToken: 'jwt', user: internalUser });
  render(<AuthProvider><Controls /></AuthProvider>);
  await screen.findByText('unauthenticated');
  await userEvent.click(screen.getByRole('button', { name: 'Entrar interno' }));
  await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
  expect(screen.getByTestId('identity').textContent).toBe('qa@example.test');
  expect(screen.getByTestId('permission').textContent).toBe('true');
  expect(mocks.setAccessToken).toHaveBeenCalledWith('jwt', 'internal');
  await userEvent.click(screen.getByRole('button', { name: 'Salir' }));
  await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
  expect(mocks.logout).toHaveBeenCalledOnce();
  expect(mocks.clearAccessToken).toHaveBeenCalledOnce();
});

it('login de comercio no hereda permisos RBAC y usa su logout', async () => {
  mocks.merchantLogin.mockResolvedValue({ accessToken: 'jwt-merchant', user: merchantUser });
  render(<AuthProvider><Controls /></AuthProvider>);
  await screen.findByText('unauthenticated');
  await userEvent.click(screen.getByRole('button', { name: 'Entrar comercio' }));
  await waitFor(() => expect(screen.getByTestId('identity').textContent).toBe('merchant@example.test'));
  expect(screen.getByTestId('kind').textContent).toBe('merchant');
  expect(screen.getByTestId('permission').textContent).toBe('false');
  expect(mocks.setAccessToken).toHaveBeenCalledWith('jwt-merchant', 'merchant');
  mocks.getSessionKind.mockReturnValue('merchant');
  await userEvent.click(screen.getByRole('button', { name: 'Salir' }));
  await waitFor(() => expect(mocks.merchantLogout).toHaveBeenCalledOnce());
});

it('hidrata la sesión y atiende el logout forzado', async () => {
  mocks.bootstrapSession.mockResolvedValue(true);
  mocks.me.mockResolvedValue({ user: internalUser });
  render(<AuthProvider><Controls /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
  expect(mocks.me).toHaveBeenCalledOnce();
  window.dispatchEvent(new CustomEvent('atlas:auth:logout'));
  await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'));
  expect(screen.getByTestId('identity').textContent).toBe('ninguna');
});
