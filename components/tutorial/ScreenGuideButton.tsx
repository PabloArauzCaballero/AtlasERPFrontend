'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/atlas/Icon';
import { GuideDrawer } from './GuideDrawer';
import { resolveGuide } from './guias';
import { tutorialById } from './tours';
import { useTutorial } from './TutorialContext';

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

/**
 * Los dos botones de ayuda de la cabecera de cada pantalla.
 *
 * «¿Qué es esto?» abre la explicación de la vista; «Recorrido» lanza el tutorial
 * interactivo cuando esa pantalla tiene uno. Resuelven su contenido por la RUTA,
 * así que ninguna pantalla tiene que declararlos: aparecen solos en las 50 vistas
 * y no hay forma de olvidarse de uno al añadir la 51.
 *
 * Hasta que alguien lo abre por primera vez en esa ruta, el botón lleva un punto:
 * la ayuda que nadie ve es la misma ayuda que no existe.
 */
export function ScreenGuideButton() {
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
        onClick={openGuide}
        className="relative inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:px-3"
        aria-label={`Qué es esta pantalla: ${guide.title}`}
      >
        <Icon name="help" className="text-[17px] text-[#006a61]" />
        <span className="hidden sm:inline">¿Qué es esto?</span>
        {unseen ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-blue-600" aria-hidden="true" /> : null}
      </button>
      {hasTour ? (
        <button
          type="button"
          data-tutorial-id="screen-tour-button"
          onClick={() => engine?.start(tourId!)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 sm:px-3"
          aria-label={`Iniciar el recorrido guiado de ${guide.title}`}
        >
          <Icon name="explore" className="text-[17px] text-[#006a61]" />
          <span className="hidden md:inline">Recorrido</span>
        </button>
      ) : null}
      {open ? (
        <GuideDrawer
          guide={guide}
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
