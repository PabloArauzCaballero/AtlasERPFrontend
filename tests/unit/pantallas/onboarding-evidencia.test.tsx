import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OnboardingChecklistEvidenceModal } from '@/components/screens/OnboardingChecklistEvidenceModal';

const mocks = vi.hoisted(() => ({ getOnboardingCase: vi.fn() }));
vi.mock('@/services/b2bService', () => ({ b2bService: { getOnboardingCase: mocks.getOnboardingCase } }));

const CASO = '11111111-1111-4111-8111-111111111111';
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it('cola de un servidor anterior (sin hasEvidence): pide el caso y avisa del archivo existente antes de dejar adjuntar', async () => {
  let responder: (value: unknown) => void = () => undefined;
  mocks.getOnboardingCase.mockReturnValue(new Promise((resolve) => { responder = resolve; }));
  const fila = { id: CASO, tradeName: 'Tienda', checklistItems: [{ id: 'i1', itemType: 'LEGAL', description: 'NIT vigente', status: 'PENDING' }] };
  render(<OnboardingChecklistEvidenceModal caso={fila} onClose={() => undefined} onDone={() => undefined} />);

  expect(await screen.findByTestId('evidencia-cargando')).toBeTruthy();
  expect((screen.getByTestId('btn-adjuntar-evidencia') as HTMLButtonElement).disabled).toBe(true);
  expect(mocks.getOnboardingCase).toHaveBeenCalledWith(CASO);

  responder({ ...fila, checklistItems: [{ ...fila.checklistItems[0], requiresEvidence: true, hasEvidence: true, evidenceUploadedAt: '2026-09-28T12:00:00Z' }] });
  expect(await screen.findByText('Este requisito ya tiene un archivo')).toBeTruthy();
  expect(screen.getByTestId('btn-adjuntar-evidencia').textContent).toContain('Reemplazar archivo');
  await waitFor(() => expect(screen.queryByTestId('evidencia-cargando')).toBeNull());
});

it('cola nueva (con hasEvidence): no hace una petición de más', async () => {
  const fila = { id: CASO, tradeName: 'Tienda', checklistItems: [{ id: 'i1', itemType: 'LEGAL', description: 'NIT vigente', status: 'PENDING', requiresEvidence: true, hasEvidence: false }] };
  render(<OnboardingChecklistEvidenceModal caso={fila} onClose={() => undefined} onDone={() => undefined} />);
  expect(await screen.findByTestId('btn-adjuntar-evidencia')).toBeTruthy();
  expect(mocks.getOnboardingCase).not.toHaveBeenCalled();
  expect(screen.queryByText('Este requisito ya tiene un archivo')).toBeNull();
});

it('si no se puede saber qué requisitos tienen archivo, no deja adjuntar y lo dice', async () => {
  mocks.getOnboardingCase.mockRejectedValue(new Error('sin red'));
  const fila = { id: CASO, tradeName: 'Tienda', checklistItems: [{ id: 'i1', itemType: 'LEGAL', description: 'NIT', status: 'PENDING' }] };
  render(<OnboardingChecklistEvidenceModal caso={fila} onClose={() => undefined} onDone={() => undefined} />);
  expect(await screen.findByText(/No se pudo saber qué requisitos ya tienen archivo/)).toBeTruthy();
  expect((screen.getByTestId('btn-adjuntar-evidencia') as HTMLButtonElement).disabled).toBe(true);
});
