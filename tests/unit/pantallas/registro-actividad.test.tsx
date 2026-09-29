import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import BusinessActionLogPage from '@/app/operaciones/auditoria/business-actions/page';

const mocks = vi.hoisted(() => ({ listBusinessActions: vi.fn(), loadInternalUsers: vi.fn() }));

vi.mock('next/navigation', () => ({ usePathname: () => '/operaciones/auditoria/business-actions', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/services/auditService', () => ({ auditService: { listBusinessActions: mocks.listBusinessActions } }));
vi.mock('@/services/optionLoaders', () => ({ loadInternalUsers: mocks.loadInternalUsers }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadInternalUsers.mockResolvedValue([{ value: 'u1', label: 'Ana (ADMIN)' }]);
  mocks.listBusinessActions.mockResolvedValue({
    items: [{ id: 'a1', createdAt: '2026-09-29T14:35:00.000Z', moduleCode: 'ACCOUNTING', actionCode: 'CLOSE_ACCOUNTING_PERIOD', status: 'SUCCESS' }],
    total: 40,
  });
});
afterEach(cleanup);

it('no hay caja de búsqueda que no filtre, y el registro afectado viaja al servidor como aggregateId', async () => {
  render(<BusinessActionLogPage />);
  await screen.findByText('Contabilidad');
  expect(screen.queryByTestId('directorio-buscar')).toBeNull();

  await userEvent.type(screen.getByTestId('filtro-aggregateId'), 'p-123');
  await waitFor(() => expect(mocks.listBusinessActions).toHaveBeenLastCalledWith(expect.objectContaining({ aggregateId: 'p-123', page: 1 })));
});

it('las fechas viajan como desde/hasta y la columna enseña la hora', async () => {
  render(<BusinessActionLogPage />);
  await screen.findByText('Contabilidad');
  await userEvent.type(screen.getByTestId('filtro-from'), '2026-09-01');
  await waitFor(() => expect(mocks.listBusinessActions).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-09-01' })));
  // `kind: 'datetime'`: la fila lleva hora, no sólo el día.
  expect(screen.getByRole('table').textContent).toMatch(/\d{1,2}:\d{2}/);
});

it('«Salieron bien» y «Fallaron» dicen que cuentan sólo la página', async () => {
  render(<BusinessActionLogPage />);
  await screen.findByText('Contabilidad');
  expect(screen.getAllByText('en esta página')).toHaveLength(2);
  expect(screen.getAllByText('40').length).toBeGreaterThan(0);
});
