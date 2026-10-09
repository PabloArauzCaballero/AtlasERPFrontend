'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Modal } from '@/components/atlas/Modal';
import { ApiError } from '@/lib/apiClient';
import { authService } from '@/services/authService';

interface ReautenticacionDialogProps {
  open: boolean;
  /** Qué se va a confirmar, en palabras del comercio («cambiar su QR de cobro»). */
  accion: string;
  /** La prueba de un solo uso que exige el backend en `x-reauth-token`. */
  onConfirmada: (reauthToken: string) => void;
  onCancel: () => void;
}

/** El rechazo, dicho con palabras del comercio y con lo que puede hacer. */
export function motivoDeRechazo(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'REAUTH_INVALID_PASSWORD') return 'La contraseña no es correcta. Vuelva a escribirla.';
    if (error.code === 'ACCOUNT_LOCKED' || error.status === 429) {
      return 'Demasiados intentos fallidos: su cuenta quedó bloqueada un rato. Espere unos minutos e inténtelo otra vez.';
    }
    return error.message;
  }
  return error instanceof Error ? error.message : 'No se pudo confirmar su contraseña.';
}

/**
 * Pide la contraseña OTRA VEZ antes de una operación sensible (hallazgo ERP-03).
 *
 * El login del comercio no lleva segundo factor obligatorio, y con esa sesión se podía cambiar el QR
 * bancario al que le pagan sus clientes: una contraseña robada —o un equipo desatendido con la sesión
 * abierta— bastaba para desviar sus cobros. Aquí la persona demuestra que sabe la contraseña justo
 * antes del cambio, y el backend devuelve una prueba de un solo uso que vence a los 5 minutos.
 *
 * La contraseña sólo vive en el estado de este diálogo mientras está abierto: se manda una vez, se
 * borra al confirmar, al fallar y al cerrar, y nunca se guarda en `localStorage`, en la URL ni en la
 * prueba. Cada intento fallido cuenta en el mismo bloqueo que el login.
 */
export function ReautenticacionDialog({ open, accion, onConfirmada, onCancel }: ReautenticacionDialogProps) {
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setPassword('');
    setError(null);
  }, [open]);

  async function confirmar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!password) {
      setError('Escriba su contraseña.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const prueba = await authService.merchantReauthenticate({ password });
      setPassword('');
      onConfirmada(prueba.reauthToken);
    } catch (fallo) {
      setPassword('');
      setError(motivoDeRechazo(fallo));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      open={open}
      width="md"
      icon="lock"
      title="Confirme que es usted"
      description={`Para ${accion} escriba otra vez la contraseña con la que entró.`}
      busy={enviando}
      onClose={onCancel}
    >
      <form onSubmit={(evento) => void confirmar(evento)} className="space-y-4" data-testid="dialogo-reautenticacion" noValidate>
        <p className="text-xs text-slate-600">
          Es una protección de su dinero: aunque alguien tuviera su sesión abierta, no podría cambiar la cuenta a la que le
          pagan sus clientes sin saber su contraseña.
        </p>
        <FormField
          tooltip="La misma contraseña con la que inicia sesión en el portal. No se guarda: sólo confirma que es usted."
          label="Contraseña"
          name="reauthPassword"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          onChange={(evento) => setPassword(evento.target.value)}
          aria-invalid={error ? true : undefined}
          data-testid="campo-reautenticacion"
        />
        {error ? (
          <div role="alert" data-testid="reautenticacion-error">
            <InlineNotice tone="danger">{error}</InlineNotice>
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <AtlasButton variant="secondary" disabled={enviando} onClick={onCancel}>
            Cancelar
          </AtlasButton>
          <AtlasButton type="submit" icon="lock_open" loading={enviando} data-testid="btn-confirmar-reautenticacion">
            Confirmar
          </AtlasButton>
        </div>
      </form>
    </Modal>
  );
}
