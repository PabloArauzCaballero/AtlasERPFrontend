'use client';

import { useEffect, useState } from 'react';

/**
 * Localiza `selector` en el DOM y sigue su rectángulo.
 *
 * El elemento puede no existir todavía justo después de cambiar de ruta, mientras
 * monta el bundle de la pantalla nueva. Por eso se reintenta durante un rato Y se
 * observa el DOM: el observador es la red de seguridad para el elemento que
 * aparece más tarde que el presupuesto de reintentos —lo normal en un equipo
 * lento o con el backend a medio responder—, en vez de rendirse y dejar el foco
 * apuntando al vacío.
 *
 * Devuelve `null` mientras no lo resuelve, para que el overlay pueda degradar a
 * una tarjeta centrada en lugar de no mostrar nada.
 */
export function useTutorialTarget(selector: string | undefined): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    let cancelled = false;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const measure = (): boolean => {
      const element = document.querySelector(selector);
      if (!element) return false;
      setRect(element.getBoundingClientRect());
      return true;
    };

    // Se observa el DOM sólo HASTA que el elemento aparece; una vez encontrado se
    // desconecta —los escuchas de resize y scroll mantienen el rectángulo al día—
    // para no reaccionar a mutaciones ajenas durante el resto del paso.
    const observer = new MutationObserver(() => {
      if (!cancelled && measure()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const tryMeasure = () => {
      if (cancelled) return;
      if (measure()) {
        observer.disconnect();
        return;
      }
      attempts += 1;
      if (attempts < 30) retryTimer = setTimeout(tryMeasure, 100);
    };
    tryMeasure();

    const onViewportChange = () => measure();
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      observer.disconnect();
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [selector]);

  return rect;
}
