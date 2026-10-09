'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ACTIVITY_EVENTS,
  actividadCompartida,
  apuntarActividadCompartida,
  faseDeSesion,
} from '@/lib/sessionLimits';

interface Options {
  /** Sólo se vigila una sesión abierta. */
  active: boolean;
  /** Cerrar de verdad, llamando al logout del backend: lo hace quien sabe hacerlo (`useAuth`). */
  onExpire: () => void;
}

export interface SessionLimitsState {
  /** Segundos que faltan para el cierre, o `null` si aún no toca avisar. */
  secondsLeft: number | null;
  /** «Sigo aquí»: reinicia la cuenta de inactividad, también para las demás pestañas. */
  keepAlive: () => void;
}

/** No se escribe en `localStorage` en cada tecla: con un apunte cada pocos segundos basta. */
const APUNTE_CADA_MS = 5_000;

/**
 * Vigila la inactividad y avisa antes de cerrar. Ver `lib/sessionLimits.ts`.
 *
 * La cuenta vive en refs y no en estado porque cada pulsación la reinicia: guardarla en estado
 * repintaría la pantalla entera mientras alguien escribe. Sólo pasa a estado lo que se ve —los
 * segundos del aviso— y sólo mientras el aviso está en pantalla.
 */
export function useSessionLimits({ active, onExpire }: Options): SessionLimitsState {
  const lastActivity = useRef(Date.now());
  const lastShared = useRef(0);
  // Un solo aviso de vencimiento por periodo de inactividad: el sondeo sigue latiendo mientras el
  // logout está en vuelo, y llamar a `onExpire` cada segundo lanzaría un logout por segundo.
  const vencida = useRef(false);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const touch = useCallback((force: boolean) => {
    const now = Date.now();
    lastActivity.current = now;
    vencida.current = false;
    if (force || now - lastShared.current >= APUNTE_CADA_MS) {
      lastShared.current = now;
      apuntarActividadCompartida(now);
    }
  }, []);

  const keepAlive = useCallback(() => {
    touch(true);
    setSecondsLeft(null);
  }, [touch]);

  // Una sesión nueva empieza con el reloj a cero: no hereda la inactividad de la anterior.
  useEffect(() => {
    if (!active) return;
    touch(true);
    setSecondsLeft(null);
  }, [active, touch]);

  useEffect(() => {
    if (!active) return;
    const onActivity = () => {
      // Ocultar la pestaña NO es actividad; volver a ella, sí.
      if (document.visibilityState === 'hidden') return;
      touch(false);
    };
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { passive: true });
    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity);
    };
  }, [active, touch]);

  useEffect(() => {
    if (!active) return;
    /*
     * Se sondea cada segundo en vez de programar un `setTimeout` al vencimiento: un temporizador
     * largo no sobrevive a la suspensión del equipo (al despertar dispara tarde o no dispara), y
     * comparar relojes en cada tic da el resultado correcto aunque el navegador haya estado
     * congelado toda la noche.
     */
    const tick = window.setInterval(() => {
      const now = Date.now();
      /*
       * Un valor del futuro en `localStorage` (reloj movido, o escrito a mano) no puede mantener la
       * sesión abierta para siempre. Recortarlo a «ahora» NO basta —en cada tic volvería a valer
       * «ahora» y la sesión no caducaría nunca—: se descarta entero. Lo mismo con el gesto propio
       * si el reloj del equipo retrocedió: se cuenta desde este instante y envejece desde aquí.
       */
      if (lastActivity.current > now) lastActivity.current = now;
      const compartida = actividadCompartida();
      const ultima = Math.max(lastActivity.current, compartida <= now ? compartida : 0);
      const estado = faseDeSesion(ultima, now);
      if (estado.fase === 'cerrar') {
        setSecondsLeft(null);
        if (!vencida.current) {
          vencida.current = true;
          expireRef.current();
        }
        return;
      }
      setSecondsLeft(estado.fase === 'aviso' ? estado.segundos : null);
    }, 1_000);
    return () => window.clearInterval(tick);
  }, [active]);

  return { secondsLeft, keepAlive };
}
