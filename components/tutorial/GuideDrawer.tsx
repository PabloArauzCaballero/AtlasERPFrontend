'use client';

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/atlas/Icon';
import { TutorialPortal } from './TutorialPortal';
import type { ScreenGuide } from './tutorial-types';

interface Props {
  guide: ScreenGuide;
  onClose: () => void;
  /** Lanza el recorrido interactivo de la pantalla, si lo tiene. */
  onStartTour?: (() => void) | undefined;
}

/**
 * Panel «¿qué estoy viendo aquí?».
 *
 * Entra por la derecha y responde la pregunta de quien acaba de llegar a una
 * pantalla que no reconoce. Es texto, no un recorrido: se lee sin tocar nada, que
 * es exactamente lo que quiere alguien que no se atreve a pulsar.
 *
 * Cierra con Escape y al pulsar fuera, bloquea el desplazamiento del fondo y
 * devuelve el foco a donde estaba —el botón de la cabecera—, porque un panel que
 * te deja el teclado perdido detrás es peor que no abrirlo.
 */
export function GuideDrawer({ guide, onClose, onStartTour }: Props) {
  const panel = useRef<HTMLElement>(null);
  const opener = useRef<Element | null>(null);
  const [showBackend, setShowBackend] = useState(false);

  useEffect(() => {
    opener.current = document.activeElement;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  return (
    <TutorialPortal>
    <div
      className="guide-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside ref={panel} className="guide-drawer" role="dialog" aria-modal="true" aria-labelledby="guide-title">
        <header className="guide-head">
          <span className="guide-head-icon" aria-hidden="true">
            <Icon name="help" className="text-[20px]" />
          </span>
          <div className="min-w-0">
            <p>{guide.eyebrow}</p>
            <h2 id="guide-title">{guide.title}</h2>
          </div>
          <button type="button" className="guide-close" onClick={onClose} aria-label="Cerrar la explicación">
            <Icon name="close" className="text-[18px]" />
          </button>
        </header>

        <div className="guide-body custom-scrollbar">
          <p className="guide-lead">{guide.intro}</p>

          {onStartTour ? (
            <button type="button" className="guide-cta" onClick={onStartTour}>
              <Icon name="explore" className="text-[18px]" />
              <span>
                <b>Hacer el recorrido guiado</b>
                <em>Te señalo cada elemento sobre la pantalla real, paso a paso.</em>
              </span>
              <Icon name="chevron_right" className="ml-auto text-[18px]" />
            </button>
          ) : null}

          <ol className="guide-sections">
            {guide.sections.map((section, index) => (
              <li key={section.title}>
                <span className="guide-num">{index + 1}</span>
                <div className="min-w-0">
                  <h3>{section.title}</h3>
                  <p>{section.body}</p>
                  {section.tip ? (
                    <p className="guide-tip">
                      <Icon name="lightbulb" className="text-[15px]" />
                      <span>{section.tip}</span>
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>

          {/* Plegado a propósito: a quien opera no le dice nada, y es lo primero
              que pregunta soporte cuando algo devuelve un error. */}
          {guide.backend ? (
            <div className="guide-backend">
              <button type="button" onClick={() => setShowBackend((open) => !open)} aria-expanded={showBackend}>
                <Icon name={showBackend ? 'expand_less' : 'expand_more'} className="text-[16px]" />
                Detalle técnico
              </button>
              {showBackend ? <code>{guide.backend}</code> : null}
            </div>
          ) : null}
        </div>

        <footer className="guide-foot">
          <button type="button" className="tutorial-btn is-primary" onClick={onClose}>
            Entendido
          </button>
        </footer>
      </aside>
    </div>
    </TutorialPortal>
  );
}
