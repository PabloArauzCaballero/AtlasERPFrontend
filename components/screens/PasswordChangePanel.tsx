'use client';

import { useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { useAuth } from '@/lib/authContext';
import { authService } from '@/services/authService';
import type { PinChallenge } from '@/services/authTypes';

/**
 * Cambio de contraseña de la cuenta con sesión abierta, en dos pasos y con el mismo segundo factor
 * por correo que el acceso.
 *
 * Sirve a las DOS poblaciones sin ramificar: el gateway resuelve quién cambia la contraseña a
 * partir del token upstream de la sesión, así que la misma pantalla vale para el personal interno
 * y para el comercio afiliado. Un `if` por audiencia aquí sólo abriría la puerta a que una de las
 * dos ramas se quedara atrás.
 *
 * Al confirmar, AtlasBackend revoca TODAS las sesiones de la cuenta —incluida ésta—, de modo que
 * la pantalla cierra sesión en vez de dejar al portal haciendo llamadas que ya devuelven 401.
 */
export function PasswordChangePanel() {
  const { logout } = useAuth();
  const [challenge, setChallenge] = useState<PinChallenge | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      setChallenge(await authService.requestPasswordChange({ currentPassword }));
      setCurrentPassword('');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'No fue posible enviar el código.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge) return;
    // Se comprueba antes de gastar el código: descubrir el error de tecleo después de canjearlo
    // obliga a esperar el minuto de cooldown para pedir otro.
    if (newPassword !== repeatPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await authService.confirmPasswordChange({ challengeToken: challenge.challengeToken, code, newPassword });
      setDone(true);
      await logout();
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : 'No fue posible cambiar la contraseña.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Panel title="Cambiar contraseña" icon="lock_reset">
        <InlineNotice tone="success">
          Contraseña cambiada. Cerramos tu sesión: vuelve a entrar con la contraseña nueva.
        </InlineNotice>
      </Panel>
    );
  }

  if (challenge) {
    return (
      <Panel
        title="Cambiar contraseña"
        description={`Enviamos un código de 6 dígitos a tu correo. Vence en ${challenge.expiresInMinutes} minutos.`}
        icon="mail_lock"
      >
        <form onSubmit={handleConfirm} className="max-w-sm space-y-4">
          <FormField
            label="Código del correo"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="000000"
          />
          <FormField
            label="Contraseña nueva"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            hint="Mínimo 10 caracteres, con al menos una letra y un número o símbolo."
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <FormField
            label="Repite la contraseña nueva"
            name="repeatPassword"
            type="password"
            autoComplete="new-password"
            required
            value={repeatPassword}
            onChange={(event) => setRepeatPassword(event.target.value)}
          />
          {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
          <AtlasButton type="submit" loading={submitting}>Confirmar contraseña nueva</AtlasButton>
        </form>
      </Panel>
    );
  }

  return (
    <Panel
      title="Cambiar contraseña"
      description="Pide un código a tu correo y confírmalo. Al terminar se cierran todas tus sesiones."
      icon="lock_reset"
    >
      <form onSubmit={handleRequest} className="max-w-sm space-y-4">
        <FormField
          label="Contraseña actual"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}
        <AtlasButton type="submit" loading={submitting}>Enviarme el código</AtlasButton>
      </form>
    </Panel>
  );
}
