import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import GlAccountsPage from '@/app/operaciones/contabilidad/cuentas-gl/page';
import FacturacionElectronicaPage from '@/app/operaciones/contabilidad/facturacion-electronica/page';
import { CommandCenterScreen } from '@/components/screens/CommandCenterScreen';
import { SecurityAdministrationScreen } from '@/components/screens/SecurityAdministrationScreen';
import { CrudDirectory } from '@/components/screens/CrudDirectory';

const mocks = vi.hoisted(() => ({
  q: '' as string,
  listGlAccounts: vi.fn(),
  status: vi.fn(),
  listUsers: vi.fn(),
  listRoles: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/operaciones',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(mocks.q ? `q=${encodeURIComponent(mocks.q)}` : ''),
}));
vi.mock('@/services/accountingService', () => ({ accountingService: { listGlAccounts: mocks.listGlAccounts } }));
vi.mock('@/services/domains', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/domains')>()),
  domainLoader: () => async () => [],
  peekOptions: () => undefined,
}));
vi.mock('@/services/fiscalService', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/fiscalService')>()),
  fiscalService: { status: mocks.status },
}));
/* Las cuatro secciones hablan con su propio servidor; aquí sólo importa el aviso del modo. */
vi.mock('@/components/screens/facturacion-electronica/DocumentosFiscalesPanel', () => ({ DocumentosFiscalesPanel: () => null }));
vi.mock('@/components/screens/facturacion-electronica/EmisoresPanel', () => ({ EmisoresPanel: () => null }));
vi.mock('@/components/screens/facturacion-electronica/CatalogosSinPanel', () => ({ CatalogosSinPanel: () => null }));
vi.mock('@/components/screens/facturacion-electronica/ContingenciasPanel', () => ({ ContingenciasPanel: () => null }));
vi.mock('@/services/authService', () => ({ authService: { listUsers: mocks.listUsers, listRoles: mocks.listRoles } }));
vi.mock('@/lib/authContext', () => ({ useAuth: () => ({ user: { id: 'yo' }, hasPermission: () => true }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.q = '';
  mocks.listRoles.mockResolvedValue({ items: [] });
});
afterEach(cleanup);

it('la búsqueda de la barra superior llega a la pantalla (?q=) y no ofrece pantallas ocultas', () => {
  mocks.q = 'campaña';
  render(<CommandCenterScreen />);
  expect((screen.getByLabelText(/Buscar una pantalla/) as HTMLInputElement).value).toBe('campaña');
  expect(screen.queryByText('Gestión de campañas')).toBeNull();
  expect(screen.queryByText('Campañas de notificación masiva')).toBeNull();
});

it('editar una cuenta GL no ofrece Tipo ni Naturaleza (el sistema no los guarda)', async () => {
  mocks.listGlAccounts.mockResolvedValue({ items: [{ id: 'g1', accountNo: '1101', name: 'Caja', accountType: 'ASSET', normalBalance: 'DEBIT' }], total: 1 });
  render(<GlAccountsPage />);
  await userEvent.click(await screen.findByTestId('editar-g1'));
  const dialogo = screen.getByRole('dialog');
  expect(within(dialogo).queryByText('Tipo')).toBeNull();
  expect(within(dialogo).queryByText('Naturaleza')).toBeNull();
  expect(within(dialogo).getByText(/el tipo y la naturaleza no se cambian/)).toBeTruthy();
});

it('facturación electrónica enseña el modo y avisa que no hay envío real (servidor anterior, sin nota)', async () => {
  mocks.status.mockResolvedValue({ mode: 'mock_server', activo: true });
  render(<FacturacionElectronicaPage />);
  expect(await screen.findByText(/Emulador del SIN \(pruebas\) · sin envío real a Impuestos/)).toBeTruthy();
  expect(screen.getByTestId('modo-fiscal').textContent).toMatch(/no hay envío real a Impuestos/);
});

it('facturación electrónica usa la nota del servidor cuando llega', async () => {
  mocks.status.mockResolvedValue({ mode: 'piloto', activo: true, transporteReal: false, nota: 'El envío al SIN (piloto) todavía no está implementado.' });
  render(<FacturacionElectronicaPage />);
  expect((await screen.findByTestId('modo-fiscal')).textContent).toBe('El envío al SIN (piloto) todavía no está implementado.');
});

it('usuarios internos: sin panel de tildes fijas ni «CONECTADO», y con 50 filas dice que son las primeras', async () => {
  mocks.listUsers.mockResolvedValue({ items: Array.from({ length: 50 }, (_, i) => ({ id: `u${i}`, fullName: `Persona ${i}`, email: `p${i}@atlas.bo`, roles: ['ADMIN'], status: 'active', mfaEnabled: false })) });
  render(<SecurityAdministrationScreen />);
  expect(await screen.findByText('se muestran las primeras 50')).toBeTruthy();
  expect(screen.queryByText('Seguridad global')).toBeNull();
  expect(screen.queryByText('CONECTADO')).toBeNull();
  expect(screen.queryByText('Total Users')).toBeNull();
});

it('una columna marcada `hideWhenEmpty` sólo aparece si alguna fila trae el dato (Banco de la cuenta bancaria)', async () => {
  const columnas = [
    { key: 'accountName', label: 'Cuenta' },
    { key: 'bankName', label: 'Banco', hideWhenEmpty: true },
  ];
  const { unmount } = render(<CrudDirectory moduleLabel="Contabilidad" title="Cuentas" description="d" load={async () => [{ id: 'b1', accountName: 'Operativa' }]} columns={columnas} />);
  await screen.findByText('Operativa');
  expect(screen.queryByRole('columnheader', { name: 'Banco' })).toBeNull();
  unmount();
  render(<CrudDirectory moduleLabel="Contabilidad" title="Cuentas" description="d" load={async () => [{ id: 'b1', accountName: 'Operativa', bankName: 'Banco Unión' }]} columns={columnas} />);
  expect(await screen.findByText('Banco Unión')).toBeTruthy();
  expect(screen.getByRole('columnheader', { name: 'Banco' })).toBeTruthy();
});

it('un listado con tope lo dice al llegar a él, y no antes', async () => {
  const filas = Array.from({ length: 3 }, (_, i) => ({ id: `f${i}`, n: `F-${i}` }));
  const { unmount } = render(<CrudDirectory moduleLabel="CRM" title="Facturas" description="d" load={async () => filas} columns={[{ key: 'n', label: 'N' }]} tope={{ max: 3, texto: 'las 3 facturas más recientes' }} />);
  expect((await screen.findByTestId('crud-tope')).textContent).toMatch(/Se muestran las 3 facturas más recientes/);
  unmount();
  render(<CrudDirectory moduleLabel="CRM" title="Facturas" description="d" load={async () => filas.slice(0, 2)} columns={[{ key: 'n', label: 'N' }]} tope={{ max: 3, texto: 'x' }} />);
  await screen.findByText('F-1');
  expect(screen.queryByTestId('crud-tope')).toBeNull();
});
