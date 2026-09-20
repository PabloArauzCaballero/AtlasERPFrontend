'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/atlas/Icon';
import { GuideDrawer } from './GuideDrawer';
import { resolveGuide } from './guias';
import { tutorialById } from './tours';
import { useTutorial } from './TutorialContext';
import type { ScreenGuideNote } from './tutorial-types';

const SEEN_KEY = 'atlas.erp.guide.seen';

function readSeen(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

interface Props {
  /**
   * Lo que esta pantalla concreta quiere contar además de su guía (el aviso que antes vivía tras
   * un icono ⓘ propio en la barra). Entra en el MISMO panel: una pantalla no puede tener dos
   * botones que expliquen lo mismo.
   */
  note?: ScreenGuideNote | undefined;
}

/**
 * El ÚNICO botón de ayuda de la cabecera de cada pantalla.
 *
 * «¿Qué es esto?» abre la explicación de la vista. Resuelve su contenido por la RUTA, así que
 * ninguna pantalla tiene que declararlo: aparece solo en las 50 vistas y no hay forma de
 * olvidarse de uno al añadir la 51.
 *
 * Eran TRES controles hasta el 2026-09-19: este, «Recorrido» y un icono ⓘ que abría el aviso de
 * la pantalla. Los tres respondían la misma pregunta —«¿qué estoy viendo?»— y ocupaban media
 * barra antes de llegar al botón que hace algo. Ahora el recorrido se lanza DESDE el panel (ahí
 * ya estaba su llamada, «Hacer el recorrido guiado») y el aviso de la pantalla es una sección
 * más del mismo panel.
 *
 * Hasta que alguien lo abre por primera vez en esa ruta, el botón lleva un punto: la ayuda que
 * nadie ve es la misma ayuda que no existe.
 */
export function ScreenGuideButton({ note }: Props = {}) {
  const pathname = usePathname();
  const engine = useTutorial();
  const guide = resolveGuide(pathname);
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(false);

  useEffect(() => {
    if (!guide) {
      setUnseen(false);
      return;
    }
    setUnseen(!readSeen().includes(pathname));
  }, [pathname, guide]);

  if (!guide) return null;

  const tourId = guide.tutorialId;
  const hasTour = Boolean(tourId && tutorialById(tourId) && engine);

  function markSeen() {
    const seen = readSeen();
    if (seen.includes(pathname)) return;
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen, pathname]));
    } catch {
      /* almacenamiento bloqueado: el panel se abre igual, sólo no se recuerda */
    }
  }

  function openGuide() {
    setOpen(true);
    setUnseen(false);
    markSeen();
  }

  return (
    <>
      <button
        type="button"
        data-tutorial-id="screen-guide-button"
        data-testid="screen-guide-button"
        onClick={openGuide}
        className="relative inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:px-3"
        aria-label={`Qué es esta pantalla: ${guide.title}`}
      >
        <Icon name="help" className="text-[17px] text-[#006a61]" />
        <span className="hidden sm:inline">¿Qué es esto?</span>
        {unseen ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" /> : null}
      </button>
      {open ? (
        <GuideDrawer
          guide={guide}
          note={note}
          onClose={() => setOpen(false)}
          onStartTour={
            hasTour
              ? () => {
                  setOpen(false);
                  engine?.start(tourId!);
                }
              : undefined
          }
        />
      ) : null}
    </>
  );
}
