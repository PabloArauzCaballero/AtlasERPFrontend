'use client';

import { useCallback, useRef } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { Modal } from '@/components/atlas/Modal';
import { useSessionLimits } from '@/hooks/useSessionLimits';
import { useAuth } from '@/lib/authContext';
import { TRASPASO, dejarParaLaSiguientePantalla } from '@/lib/traspasoEfimero';

/**
 * Cierra la sesión tras 15 minutos sin actividad, avisando un minuto antes. Personal interno y
 * comercio por igual. Ver `lib/sessionLimits.ts`.
 *
 * Cerrar es un logout REAL (`useAuth().logout`, que llama a `/auth/logout` o a
 * `/auth/merchant/logout` y revoca la cookie de refresco), no sólo olvidar el token en memoria: con
 * la cookie viva, recargar la pestaña devolvería la sesión entera. Al quedar sin sesión,
 * `RequireAuth` manda al login con `next` a la pantalla donde se estaba, y el login explica por qué.
 *
 * Escape, el fondo y la X equivalen a «Seguir trabajando», no a cerrar sesión: la salida por
 * omisión de un diálogo no puede ser la que tira el trabajo a medias.
 */
export function CierrePorInactividad() {
  const { status, logout } = useAuth();
  const cerrando = useRef(false);

  const cerrar = useCallback(
    (motivo: 'inactividad' | 'usuario') => {
      // El sondeo sigue latiendo mientras el logout está en vuelo: un solo cierre.
      if (cerrando.current) return;
      cerrando.current = true;
      if (motivo === 'inactividad') dejarParaLaSiguientePantalla(TRASPASO.cierrePorInactividad, '1');
      void logout().finally(() => {
        cerrando.current = false;
      });
    },
    [logout],
  );

  const alVencer = useCallback(() => cerrar('inactividad'), [cerrar]);
  const { secondsLeft, keepAlive } = useSessionLimits({ active: status === 'authenticated', onExpire: alVencer });

  return (
    <Modal
      open={secondsLeft !== null}
      onClose={keepAlive}
      icon="lock_clock"
      width="md"
      title="Tu sesión va a cerrarse"
      description="Por seguridad, la sesión se cierra tras 15 minutos sin actividad."
      footer={
        <>
          <AtlasButton variant="secondary" onClick={() => cerrar('usuario')}>Cerrar sesión ahora</AtlasButton>
          <AtlasButton onClick={keepAlive} data-testid="seguir-trabajando">Seguir trabajando</AtlasButton>
        </>
      }
    >
      <p className="text-sm text-slate-700">
        {/* `role="timer"` con `aria-live="off"`: la cuenta se consulta, no se anuncia cada segundo. */}
        Se cerrará en{' '}
        <strong role="timer" aria-live="off" className="font-mono">{secondsLeft ?? 0} s</strong>. Lo que no
        hayas guardado se perderá.
      </p>
    </Modal>
  );
}
