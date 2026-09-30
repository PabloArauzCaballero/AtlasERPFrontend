import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import { AtlasAssist } from '@/components/atlas/AtlasAssist';

const m = vi.hoisted(() => ({
  conversacion: vi.fn(),
  preguntar: vi.fn(),
  conversaciones: vi.fn(),
  abrir: vi.fn(),
  borrar: vi.fn(),
}));
vi.mock('next/navigation', () => ({ usePathname: () => '/operaciones/contabilidad/cierres' }));
vi.mock('@/services/assistService', () => ({ assistService: m }));

const ACTUAL = {
  conversationId: 'c-actual',
  turns: [{ turnId: 't1', prompt: '¿Dónde cierro el mes?', reply: 'En Contabilidad › Cierres.', suggestHandoff: false, createdAt: '2026-09-27T10:00:00.000Z' }],
};
const OTRA = {
  conversationId: 'c-otra',
  turns: [{ turnId: 'o1', prompt: '¿Cómo emito una factura?', reply: 'Abre Facturación.', suggestHandoff: false, createdAt: '2026-09-26T10:00:00.000Z' }],
};
const LISTA = [
  { conversationId: 'c-actual', title: 'Dónde cierro el mes', updatedAt: new Date(Date.now() - 5 * 60_000).toISOString(), turnCount: 1 },
  { conversationId: 'c-otra', title: 'Cómo emito una factura', updatedAt: new Date(Date.now() - 26 * 3_600_000).toISOString(), turnCount: 3 },
];

beforeEach(() => {
  vi.clearAllMocks();
  m.conversacion.mockResolvedValue(ACTUAL);
  m.conversaciones.mockResolvedValue(LISTA);
  m.abrir.mockResolvedValue(OTRA);
  m.borrar.mockResolvedValue({ deleted: 1 });
});
afterEach(cleanup);

async function abrirPanel() {
  render(<AtlasAssist surface="erp-staff" />);
  await userEvent.click(screen.getByRole('button', { name: 'Asistente de Atlas' }));
  await screen.findByText('En Contabilidad › Cierres.');
}
const verHistorial = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Historial' }));
  await screen.findByRole('heading', { name: 'Historial de conversaciones' });
};

it('Nueva conversación vacía el hilo sin llamar al servidor y la siguiente pregunta no lleva conversationId', async () => {
  m.preguntar.mockResolvedValue({ reply: 'Respuesta nueva', suggestHandoff: false, conversationId: 'c-nueva', turnId: 'n1' });
  await abrirPanel();
  await userEvent.click(screen.getByRole('button', { name: 'Nueva conversación' }));
  expect(screen.queryByText('En Contabilidad › Cierres.')).toBeNull();
  expect(m.conversaciones).not.toHaveBeenCalled();
  expect(m.preguntar).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText('Tu pregunta'), 'Hola{Enter}');
  await screen.findByText('Respuesta nueva');
  expect(m.preguntar.mock.calls[0]?.[0]).not.toHaveProperty('conversationId');
});

it('Nueva conversación está deshabilitada con el hilo vacío y lo explica', async () => {
  m.conversacion.mockResolvedValue({ conversationId: null, turns: [] });
  render(<AtlasAssist surface="erp-staff" />);
  await userEvent.click(screen.getByRole('button', { name: 'Asistente de Atlas' }));
  const boton = screen.getByRole('button', { name: 'Nueva conversación' }) as HTMLButtonElement;
  expect(boton.disabled).toBe(true);
  expect(boton.getAttribute('aria-describedby')).toBeTruthy();
  expect(screen.getByText('Ya estás en una conversación nueva.')).toBeTruthy();
});

it('Nueva conversación está deshabilitada mientras hay un envío en curso', async () => {
  m.preguntar.mockReturnValue(new Promise(() => {}));
  await abrirPanel();
  await userEvent.type(screen.getByLabelText('Tu pregunta'), 'Hola{Enter}');
  expect((screen.getByRole('button', { name: 'Nueva conversación' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/Espera a que el asistente/)).toBeTruthy();
});

it('el historial lista título, fecha relativa y mensajes, y marca la actual', async () => {
  await abrirPanel();
  await verHistorial();
  const filas = await screen.findAllByRole('listitem');
  expect(filas).toHaveLength(2);
  expect(within(filas[0]!).getByText('hace 5 min · 2 mensajes')).toBeTruthy();
  expect(within(filas[1]!).getByText('ayer · 6 mensajes')).toBeTruthy();
  expect(within(filas[0]!).getByRole('button', { name: /^Dónde cierro/ }).getAttribute('aria-current')).toBe('true');
});

it('abrir una conversación carga su hilo y la siguiente pregunta sigue en ella', async () => {
  m.preguntar.mockResolvedValue({ reply: 'Sigue', suggestHandoff: false, conversationId: 'c-otra', turnId: 'o2' });
  await abrirPanel();
  await verHistorial();
  await userEvent.click(await screen.findByRole('button', { name: /^Cómo emito/ }));
  await screen.findByText('Abre Facturación.');
  expect(m.abrir).toHaveBeenCalledWith('c-otra');
  expect(screen.queryByRole('heading', { name: 'Historial de conversaciones' })).toBeNull();
  await userEvent.type(screen.getByLabelText('Tu pregunta'), 'Y luego{Enter}');
  await screen.findByText('Sigue');
  expect(m.preguntar.mock.calls[0]?.[0]).toMatchObject({ conversationId: 'c-otra' });
});

it('borrar pide confirmación en la fila, sin diálogos del navegador', async () => {
  const confirmar = vi.spyOn(window, 'confirm');
  await abrirPanel();
  await verHistorial();
  const borrar = () => screen.getByRole('button', { name: 'Borrar la conversación «Cómo emito una factura»' });
  await userEvent.click(await screen.findByRole('button', { name: 'Borrar la conversación «Cómo emito una factura»' }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(m.borrar).not.toHaveBeenCalled();
  await userEvent.click(borrar());
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
  await waitFor(() => expect(m.borrar).toHaveBeenCalledWith('c-otra'));
  await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
  expect(confirmar).not.toHaveBeenCalled();
});

it('borrar la conversación abierta reinicia el hilo', async () => {
  await abrirPanel();
  await verHistorial();
  await userEvent.click(await screen.findByRole('button', { name: 'Borrar la conversación «Dónde cierro el mes»' }));
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
  await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1));
  await userEvent.click(screen.getByRole('button', { name: 'Volver al chat' }));
  expect(screen.queryByText('En Contabilidad › Cierres.')).toBeNull();
});

it('estado vacío', async () => {
  m.conversaciones.mockResolvedValue([]);
  await abrirPanel();
  await verHistorial();
  await screen.findByText(/Todavía no tienes conversaciones guardadas/);
});

it('si la lista falla lo dice, deja reintentar y el chat sigue funcionando', async () => {
  m.conversaciones.mockRejectedValueOnce(new ApiError('x', 500));
  await abrirPanel();
  await verHistorial();
  await screen.findByText(/No se pudo cargar el historial/);
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
  expect(await screen.findAllByRole('listitem')).toHaveLength(2);
  await userEvent.click(screen.getByRole('button', { name: 'Volver al chat' }));
  expect((screen.getByLabelText('Tu pregunta') as HTMLTextAreaElement).disabled).toBe(false);
});

it('404 al abrir avisa y quita la fila; otros fallos avisan y conservan la fila', async () => {
  m.abrir.mockRejectedValueOnce(new ApiError('no', 404));
  await abrirPanel();
  await verHistorial();
  await userEvent.click(await screen.findByRole('button', { name: /^Cómo emito/ }));
  await screen.findByText('Esa conversación ya no existe.');
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  m.borrar.mockRejectedValue(new Error('x'));
  await userEvent.click(screen.getByRole('button', { name: 'Borrar la conversación «Dónde cierro el mes»' }));
  await userEvent.click(screen.getByRole('button', { name: 'Sí, borrar' }));
  await screen.findByText(/No se pudo borrar la conversación/);
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
});
