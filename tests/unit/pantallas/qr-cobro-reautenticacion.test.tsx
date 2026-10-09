import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/apiClient';

/**
 * ERP-03 — cambiar el QR de cobro pide la contraseña OTRA VEZ.
 *
 * El login del comercio no lleva segundo factor; con una sesión robada se podía cambiar la cuenta a
 * la que le pagan sus clientes. La pantalla pide la contraseña antes de subir nada, manda la prueba
 * en `x-reauth-token` y, si el backend la rechaza por vencida (`REAUTH_REQUIRED`), vuelve a pedirla
 * y reintenta SÓLO el registro. La contraseña nunca sale del diálogo ni queda guardada.
 */
const mocks = vi.hoisted(() => ({
  listQrCodes: vi.fn(),
  createQrUploadUrl: vi.fn(),
  registerQr: vi.fn(),
  uploadQrFile: vi.fn(),
  merchantReauthenticate: vi.fn(),
  sessionKind: { value: 'merchant' as 'merchant' | 'internal' },
}));

vi.mock('@/services/partnerOnboardingService', () => ({
  partnerOnboardingService: {
    listQrCodes: mocks.listQrCodes,
    createQrUploadUrl: mocks.createQrUploadUrl,
    registerQr: mocks.registerQr,
    qrImageUrl: vi.fn(async () => 'blob:qr'),
  },
  uploadQrFile: mocks.uploadQrFile,
}));
vi.mock('@/services/authService', () => ({ authService: { merchantReauthenticate: mocks.merchantReauthenticate } }));
vi.mock('@/lib/qrImagen', () => ({ imagenTieneQr: vi.fn(async () => 'con-codigo'), AVISO_SIN_QR: 'sin qr' }));
vi.mock('@/hooks/useOptions', () => ({
  useOptions: () => [{ value: 'BNB', label: 'BNB', description: 'Banco Nacional de Bolivia' }],
}));
vi.mock('@/lib/apiClient', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/apiClient')>();
  return { ...original, getSessionKind: () => mocks.sessionKind.value };
});

import { MerchantPaymentQrScreen } from '@/components/screens/MerchantPaymentQrScreen';
import { motivoDeRechazo } from '@/components/atlas/ReautenticacionDialog';

const TICKET = { storageKey: '1/partner-7/qr-bank/x.png', uploadUrl: 'u', method: 'PUT', requiredHeaders: {}, expiresAt: '' };
const QR = { qrId: '9', qrKind: 'bank', status: 'active', fingerprint: 'f', bankInstitutionCode: 'BNB', accountNumberMasked: '****7890', createdAt: '2026-10-09T10:00:00Z' };

beforeEach(() => {
  // jsdom no implementa `scrollIntoView`, que el desplegable usa al abrirse.
  Element.prototype.scrollIntoView = vi.fn();
  // Ni `createObjectURL`, con el que el campo de archivo enseña la vista previa.
  URL.createObjectURL = vi.fn(() => 'blob:vista');
  URL.revokeObjectURL = vi.fn();
  mocks.sessionKind.value = 'merchant';
  mocks.listQrCodes.mockResolvedValue([]);
  mocks.createQrUploadUrl.mockResolvedValue(TICKET);
  mocks.uploadQrFile.mockResolvedValue(undefined);
  mocks.registerQr.mockResolvedValue(QR);
  mocks.merchantReauthenticate.mockResolvedValue({ reauthToken: 'prueba-1', expiresInSeconds: 300, expiresAt: '' });
});
afterEach(cleanup);

async function rellenarYSubir() {
  render(<MerchantPaymentQrScreen embedded partnerId="7" nombre="Tienda" estadoExpediente="approved" />);
  await waitFor(() => expect(mocks.listQrCodes).toHaveBeenCalled());
  fireEvent.click(await screen.findByTestId('campo-entidad'));
  fireEvent.click(await screen.findByTestId('select-bankInstitutionCode-option-BNB'));
  fireEvent.change(screen.getByTestId('campo-cuenta'), { target: { value: '****7890' } });
  const input = screen.getByTestId('input-qr-cobro') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(['png'], 'qr.png', { type: 'image/png' })] } });
  fireEvent.click(screen.getByTestId('btn-subir-qr-cobro'));
}

async function confirmarContrasena(clave = 'secreta') {
  const campo = await screen.findByTestId('campo-reautenticacion');
  fireEvent.change(campo, { target: { value: clave } });
  fireEvent.click(screen.getByTestId('btn-confirmar-reautenticacion'));
}

describe('MerchantPaymentQrScreen · reautenticación', () => {
  it('pide la contraseña ANTES de subir nada y registra con la prueba en la cabecera', async () => {
    await rellenarYSubir();

    expect(await screen.findByTestId('dialogo-reautenticacion')).toBeTruthy();
    expect(mocks.createQrUploadUrl).not.toHaveBeenCalled();

    await confirmarContrasena();

    await waitFor(() => expect(mocks.registerQr).toHaveBeenCalledTimes(1));
    expect(mocks.merchantReauthenticate).toHaveBeenCalledWith({ password: 'secreta' }); // gitleaks:allow (valor de prueba, no es una cuenta real)
    expect(mocks.registerQr).toHaveBeenCalledWith('7', expect.objectContaining({ qrKind: 'bank', storageKey: TICKET.storageKey, bankInstitutionCode: 'BNB' }), 'prueba-1');
    await waitFor(() => expect(screen.queryByTestId('dialogo-reautenticacion')).toBeNull());
    expect(JSON.stringify(mocks.registerQr.mock.calls)).not.toContain('secreta');
  });

  it('contraseña errada: lo dice en el diálogo, vacía el campo y no sube nada', async () => {
    mocks.merchantReauthenticate.mockRejectedValueOnce(new ApiError('La contraseña no es correcta.', 400, false, false, 'REAUTH_INVALID_PASSWORD'));
    await rellenarYSubir();
    await confirmarContrasena('mala');

    expect((await screen.findByTestId('reautenticacion-error')).textContent).toContain('no es correcta');
    expect((screen.getByTestId('campo-reautenticacion') as HTMLInputElement).value).toBe('');
    expect(mocks.createQrUploadUrl).not.toHaveBeenCalled();
    expect(mocks.registerQr).not.toHaveBeenCalled();
  });

  it('si la prueba venció (REAUTH_REQUIRED), vuelve a pedirla y reintenta SÓLO el registro', async () => {
    mocks.registerQr.mockRejectedValueOnce(new ApiError('venció', 403, false, false, 'REAUTH_REQUIRED'));
    mocks.merchantReauthenticate
      .mockResolvedValueOnce({ reauthToken: 'prueba-1', expiresInSeconds: 300, expiresAt: '' })
      .mockResolvedValueOnce({ reauthToken: 'prueba-2', expiresInSeconds: 300, expiresAt: '' });
    await rellenarYSubir();
    await confirmarContrasena();

    await waitFor(() => expect(mocks.registerQr).toHaveBeenCalledTimes(1));
    await confirmarContrasena();

    await waitFor(() => expect(mocks.registerQr).toHaveBeenCalledTimes(2));
    expect(mocks.registerQr.mock.calls[1]?.[2]).toBe('prueba-2');
    expect(mocks.createQrUploadUrl).toHaveBeenCalledTimes(1);
    expect(mocks.uploadQrFile).toHaveBeenCalledTimes(1);
  });

  it('cancelar no cambia nada y lo dice', async () => {
    await rellenarYSubir();
    fireEvent.click(await screen.findByText('Cancelar'));

    expect((await screen.findByTestId('qr-cobro-aviso')).textContent).toContain('No se cambió el QR de cobro');
    expect(mocks.createQrUploadUrl).not.toHaveBeenCalled();
  });

  it('una sesión interna (segundo factor en su login) no pide la contraseña', async () => {
    mocks.sessionKind.value = 'internal';
    await rellenarYSubir();

    await waitFor(() => expect(mocks.registerQr).toHaveBeenCalledTimes(1));
    expect(mocks.registerQr.mock.calls[0]?.[2]).toBeUndefined();
    expect(screen.queryByTestId('dialogo-reautenticacion')).toBeNull();
  });
});

describe('motivoDeRechazo', () => {
  it('traduce el bloqueo y la contraseña errada a palabras del comercio', () => {
    expect(motivoDeRechazo(new ApiError('x', 429, false, false, 'ACCOUNT_LOCKED'))).toContain('bloqueada');
    expect(motivoDeRechazo(new ApiError('x', 400, false, false, 'REAUTH_INVALID_PASSWORD'))).toContain('no es correcta');
    expect(motivoDeRechazo(new Error('otra'))).toBe('otra');
  });
});
