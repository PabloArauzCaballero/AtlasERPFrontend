import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import ReceiptsPage from '@/app/operaciones/contabilidad/recibos/page';
import PeriodClosingPage from '@/app/operaciones/contabilidad/cierres/page';
import { resumenDelCierre } from '@/lib/cierreContable';

const mocks = vi.hoisted(() => ({
  listReceipts: vi.fn(),
  deleteReceipt: vi.fn(),
  reverseDocument: vi.fn(),
  listAccountingPeriods: vi.fn(),
  listFiscalYears: vi.fn(),
  closePeriod: vi.fn(),
}));

vi.mock('next/navigation', () => ({ usePathname: () => '/operaciones/contabilidad/recibos', useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/services/accountingService', () => ({ accountingService: mocks }));
vi.mock('@/services/domains', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/domains')>()),
  domainLoader: () => async () => [],
  peekOptions: () => undefined,
}));

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(cleanup);

const CONTABILIZADO = { id: 'r1', receiptNo: 'REC-1', status: 'RECORDED', amount: 10, accountingDocumentId: 'd1' };
const BORRADOR = { id: 'r2', receiptNo: 'REC-2', status: 'DRAFT', amount: 5, accountingDocumentId: null };

it('un recibo contabilizado no ofrece borrar: la papelera dice por qué y se ofrece reversar su asiento', async () => {
  mocks.listReceipts.mockResolvedValue({ items: [CONTABILIZADO, BORRADOR], total: 2 });
  render(<ReceiptsPage />);

  const bloqueado = await screen.findByTestId('eliminar-bloqueado-r1');
  expect((bloqueado as HTMLButtonElement).disabled).toBe(true);
  expect(bloqueado.getAttribute('title')).toMatch(/Ya está contabilizado/);
  expect(screen.queryByTestId('eliminar-r1')).toBeNull();
  expect(screen.getByTestId('accion-reversar-r1')).toBeTruthy();

  expect(screen.getByTestId('eliminar-r2')).toBeTruthy();
  expect(screen.queryByTestId('accion-reversar-r2')).toBeNull();
});

it('si el sistema rechaza el borrado (409), el motivo se ve dentro del diálogo', async () => {
  mocks.listReceipts.mockResolvedValue({ items: [BORRADOR], total: 1 });
  mocks.deleteReceipt.mockRejectedValue(new ApiError('Un recibo contabilizado no se borra: se reversa su asiento.', 409, false, false, 'RECEIPT_HAS_ACCOUNTING_TRACE'));
  render(<ReceiptsPage />);

  await userEvent.click(await screen.findByTestId('eliminar-r2'));
  const dialogo = screen.getByRole('dialog');
  expect(within(dialogo).queryByText(/las facturas vuelven a quedar abiertas/)).toBeNull();
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Sí, eliminar' }));

  expect((await within(dialogo).findByTestId('confirm-error')).textContent).toContain('Un recibo contabilizado no se borra');
  expect(mocks.deleteReceipt).toHaveBeenCalledWith('r2');
});

it('reversar el asiento del recibo llama al reverso del DOCUMENTO contable, no al recibo', async () => {
  mocks.listReceipts.mockResolvedValue({ items: [CONTABILIZADO], total: 1 });
  mocks.reverseDocument.mockResolvedValue({});
  render(<ReceiptsPage />);

  await userEvent.click(await screen.findByTestId('accion-reversar-r1'));
  const dialogo = await screen.findByRole('dialog');
  expect(within(dialogo).getByText(/No cambia el estado del recibo ni devuelve a pendiente/)).toBeTruthy();
  await userEvent.type(within(dialogo).getByLabelText(/Fecha de reversión/), '2026-09-29');
  await userEvent.type(within(dialogo).getByLabelText(/^Motivo/), 'Cobro duplicado');
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Reversar' }));

  await waitFor(() => expect(mocks.reverseDocument).toHaveBeenCalledWith('d1', expect.objectContaining({ reversalDate: '2026-09-29', reason: 'Cobro duplicado' })));
});

it('cerrar un período no pregunta mensual/anual, dice qué no comprueba y manda MONTHLY', async () => {
  mocks.listAccountingPeriods.mockResolvedValue([{ id: 'p1', periodNo: '2026-09', isOpen: true, closeStatus: 'OPEN', fiscalYearId: 'fy1' }]);
  mocks.listFiscalYears.mockResolvedValue([{ id: 'fy1', legalEntityId: 'le1' }]);
  mocks.closePeriod.mockResolvedValue({ controlReportJson: { closeNumber: 1, controls: [{ code: 'PERIOD_HAS_DRAFT_DOCUMENTS', evaluation: 'ENFORCED', description: 'Documentos en borrador.' }] } });
  render(<PeriodClosingPage />);

  await userEvent.click(await screen.findByTestId('accion-cerrar-p1'));
  const dialogo = screen.getByRole('dialog');
  expect(dialogo.textContent).toMatch(/NO se comprueban/);
  expect(dialogo.textContent).not.toMatch(/IUE/);
  expect(screen.queryByTestId('select-closeType')).toBeNull();
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Sí, cerrar' }));

  await waitFor(() => expect(mocks.closePeriod).toHaveBeenCalledWith({ legalEntityId: 'le1', periodId: 'p1', closeType: 'MONTHLY' }));
});

it('el resumen del cierre dice qué control se comprobó y cuál no tiene fuente de datos', () => {
  const texto = resumenDelCierre({
    controlReportJson: {
      closeNumber: 2,
      controls: [
        { code: 'A', evaluation: 'ENFORCED', description: 'Documentos en borrador.' },
        { code: 'B', evaluation: 'NO_DATA_SOURCE', description: 'Extractos bancarios.' },
      ],
    },
  });
  expect(texto).toContain('Documentos en borrador. (comprobado)');
  expect(texto).toContain('Extractos bancarios. (sin fuente de datos, no se comprobó)');
  expect(texto).toContain('2.ª vez');
  // Un servidor anterior no manda `controls`: no se inventa ninguno.
  expect(resumenDelCierre({ controlReportJson: {} })).toMatch(/no se comprobaron/);
});
