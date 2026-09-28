import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import { AtlasAssist } from '@/components/atlas/AtlasAssist';

const mocks = vi.hoisted(() => ({ conversacion: vi.fn(), preguntar: vi.fn(), pathname: '/portal-comercio/cartera' }));

vi.mock('next/navigation', () => ({ usePathname: () => mocks.pathname }));
vi.mock('@/services/assistService', () => ({
  assistService: { conversacion: mocks.conversacion, preguntar: mocks.preguntar },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pathname = '/portal-comercio/cartera';
  mocks.conversacion.mockResolvedValue({ conversationId: null, turns: [] });
});
afterEach(cleanup);

it('el botón está siempre y abre el panel con el aviso de datos', async () => {
  render(<AtlasAssist surface="merchant-portal" />);
  await userEvent.click(screen.getByRole('button', { name: 'Asistente de Atlas' }));

  const panel = await screen.findByRole('dialog', { name: 'Asistente de Atlas' });
  expect(panel).toBeTruthy();
  expect(screen.getByText('No escribas contraseñas, códigos ni datos personales.')).toBeTruthy();
  expect(mocks.conversacion).toHaveBeenCalledTimes(1);
});

it('apagado: el botón sigue, el panel lo dice y el campo queda deshabilitado', async () => {
  mocks.conversacion.mockRejectedValue(new ApiError('Apagado', 404, false, false, 'ASSIST_DISABLED'));
  render(<AtlasAssist surface="erp-staff" />);
  await userEvent.click(screen.getByRole('button', { name: 'Asistente de Atlas' }));

  expect(await screen.findByText('El asistente todavía no está encendido en este ambiente.')).toBeTruthy();
  expect((screen.getByLabelText('Tu pregunta') as HTMLTextAreaElement).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Asistente de Atlas' })).toBeTruthy();
});

it('Enter envía con la sección actual y, si sugiere ayuda, ofrece «Hablar con soporte»', async () => {
  mocks.preguntar.mockResolvedValue({
    reply: 'Eso lo ve soporte.', suggestHandoff: true, conversationId: 'c1', turnId: 't1', mode: 'sin-ia',
  });
  render(<AtlasAssist surface="merchant-portal" />);
  await userEvent.click(screen.getByRole('button', { name: 'Asistente de Atlas' }));
  const campo = await screen.findByLabelText('Tu pregunta');
  await waitFor(() => expect((campo as HTMLTextAreaElement).disabled).toBe(false));

  await userEvent.type(campo, '¿Por qué no veo un pago?{Enter}');

  expect(await screen.findByText('Eso lo ve soporte.')).toBeTruthy();
  expect(mocks.preguntar).toHaveBeenCalledWith(expect.objectContaining({ prompt: '¿Por qué no veo un pago?', screen: 'Mi cartera' }));
  const id = mocks.preguntar.mock.calls[0]?.[0].clientMessageId as string;
  expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(screen.getByRole('link', { name: /Hablar con soporte/ }).getAttribute('href')).toBe('/portal-comercio/soporte');
  expect(screen.getByText('Respuesta sin IA: texto de la guía.')).toBeTruthy();
  expect((campo as HTMLTextAreaElement).value).toBe('');
});

it('en el ERP del personal no hay enlace a soporte de comercio', async () => {
  mocks.pathname = '/operaciones/contabilidad/cierres';
  mocks.preguntar.mockResolvedValue({ reply: 'Pregúntale a tu responsable.', suggestHandoff: true, conversationId: 'c1', turnId: 't1' });
  render(<AtlasAssist surface="erp-staff" />);
  await userEvent.click(screen.getByRole('button', { name: 'Asistente de Atlas' }));
  const campo = await screen.findByLabelText('Tu pregunta');
  await waitFor(() => expect((campo as HTMLTextAreaElement).disabled).toBe(false));
  await userEvent.type(campo, 'hola{Enter}');

  expect(await screen.findByText('Pregúntale a tu responsable.')).toBeTruthy();
  expect(mocks.preguntar).toHaveBeenCalledWith(expect.objectContaining({ screen: 'Contabilidad › Cierres' }));
  expect(screen.queryByRole('link', { name: /Hablar con soporte/ })).toBeNull();
});

it('si falla, la pregunta se queda en el campo y al reenviarla sale con la misma llave', async () => {
  mocks.preguntar
    .mockRejectedValueOnce(new ApiError('Caído', 503, false, false, 'ASSIST_UNAVAILABLE'))
    .mockResolvedValueOnce({ reply: 'Listo.', suggestHandoff: false, conversationId: 'c1', turnId: 't1' });
  render(<AtlasAssist surface="merchant-portal" />);
  await userEvent.click(screen.getByRole('button', { name: 'Asistente de Atlas' }));
  const campo = (await screen.findByLabelText('Tu pregunta')) as HTMLTextAreaElement;
  await waitFor(() => expect(campo.disabled).toBe(false));
  await userEvent.type(campo, 'hola{Enter}');

  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(campo.value).toBe('hola');
  await userEvent.type(campo, '{Enter}');
  expect(await screen.findByText('Listo.')).toBeTruthy();
  const [primera, segunda] = mocks.preguntar.mock.calls.map((llamada) => llamada[0].clientMessageId);
  expect(segunda).toBe(primera);
});

it('Escape cierra el panel y devuelve el foco al botón', async () => {
  render(<AtlasAssist surface="erp-staff" />);
  const boton = screen.getByRole('button', { name: 'Asistente de Atlas' });
  await userEvent.click(boton);
  await screen.findByRole('dialog');
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(boton);
});
