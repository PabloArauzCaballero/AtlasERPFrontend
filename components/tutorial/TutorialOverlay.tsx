'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/atlas/Icon';
import { usePlacement, useTargetDisabled } from './overlay-hooks';
import { TutorialPortal } from './TutorialPortal';
import type { InteractiveTutorial, RequiredAction } from './tutorial-types';
import { useTutorialTarget } from './useTutorialTarget';

const PAD = 8;

/** Qué se le pide al usuario mientras el paso espera su acción. */
const WAIT_LABEL: Record<RequiredAction, string> = {
  click: 'Pulsa lo resaltado para seguir…',
  input: 'Escribe o elige un valor en lo resaltado para seguir…',
  submit: 'Envía el formulario resaltado para seguir…',
};

interface Props {
  tutorial: InteractiveTutorial;
  stepIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  onExit: () => void;
}

/**
 * Overlay del recorrido: oscurece la pantalla, resalta el elemento del paso y
 * muestra la explicación junto a él.
 *
 * Cuando el paso pide una acción (`requiredAction`) NO ofrece «Siguiente»:
 * escucha la acción real sobre el elemento resaltado y avanza cuando ocurre. Es
 * lo que separa un recorrido de una presentación.
 */
export function TutorialOverlay({ tutorial, stepIndex, onNext, onPrevious, onExit }: Props) {
  const step = tutorial.steps[stepIndex]!;
  const rect = useTutorialTarget(step.target);
  const [actionDone, setActionDone] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);
  const card = useRef<HTMLDivElement>(null);
  const disabled = useTargetDisabled(step.target, rect);

  /**
   * Salir del primer paso no cuesta nada; salir del séptimo tira el recorrido
   * hecho, y ahí sí se pregunta. Se confirma DENTRO de la tarjeta y no con
   * `window.confirm`, que ni respeta el diseño ni se lee junto al resto.
   */
  const requestExit = useCallback(() => {
    if (stepIndex === 0) onExit();
    else setConfirmingExit(true);
  }, [stepIndex, onExit]);

  // Cambiar de paso invalida una confirmación abierta: preguntar por una salida
  // que el usuario ya no está pidiendo es ruido.
  useEffect(() => setConfirmingExit(false), [stepIndex]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestExit();
      // Mientras se pregunta por la salida, las flechas no deben mover el paso por
      // debajo de la pregunta.
      if (confirmingExit) return;
      if (event.key === 'ArrowRight') onNext();
      if (event.key === 'ArrowLeft') onPrevious();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestExit, onNext, onPrevious, confirmingExit]);

  // El elemento del paso puede estar fuera de la pantalla —una tabla larga, un
  // panel al pie—: se trae a la vista para que el foco sea visible.
  useEffect(() => {
    if (!step.target) return;
    const element = document.querySelector(step.target);
    if (element instanceof HTMLElement && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [step.target]);

  /**
   * `true` en cuanto el elemento del paso existe de verdad.
   *
   * Se usa como disparador para volver a enganchar el escucha de la acción. Es un
   * booleano y no el rectángulo a propósito: el rectángulo cambia con cada scroll,
   * y depender de él reiniciaría el estado del paso continuamente.
   */
  const hasTarget = Boolean(rect);

  useEffect(() => {
    setActionDone(false);
    if (!step.requiredAction || !step.target) return;
    const element = document.querySelector(step.target);
    // Sin elemento no hay a quién escuchar, pero esto NO es el final: cuando
    // aparezca, `hasTarget` cambia y el efecto se vuelve a ejecutar. Enganchar una
    // sola vez dejaba muerto cualquier paso cuyo elemento llega después de navegar
    // o después de que responda el backend.
    if (!element) return;
    const events: Record<RequiredAction, string[]> = {
      click: ['click'],
      // «Escribir» cubre teclear y elegir en un desplegable.
      input: ['input', 'change'],
      submit: ['submit'],
    };
    const handler = () => {
      setActionDone(true);
      onNext();
    };
    const names = events[step.requiredAction];
    for (const name of names) element.addEventListener(name, handler, { once: true });
    return () => {
      for (const name of names) element.removeEventListener(name, handler);
    };
  }, [step, onNext, hasTarget]);

  /**
   * Sólo se espera una acción si hay algo real sobre lo que hacerla.
   *
   * Un paso con `requiredAction` cuyo elemento no está en pantalla —o está
   * deshabilitado— escondería «Siguiente» y dejaría el recorrido muerto, sin más
   * salida que cerrarlo. Si no hay nada accionable, el paso se explica igual y se
   * puede continuar.
   */
  const actionable = Boolean(rect) && !disabled;
  const waitingForAction = Boolean(step.requiredAction) && actionable && !actionDone;
  const waitLabel = WAIT_LABEL[step.requiredAction ?? 'click'];
  const isLast = stepIndex === tutorial.steps.length - 1;
  const placement = usePlacement(card, rect);
  const percent = Math.round(((stepIndex + 1) / tutorial.steps.length) * 100);

  // Sin `aria-modal`: este recorrido pide que se pulse el elemento REAL de la
  // página. Declararlo modal le diría al lector de pantalla que todo lo de fuera
  // está inerte justo cuando hay que ir a usarlo.
  return (
    <TutorialPortal>
    <div className="tutorial-overlay" role="dialog" aria-label={step.title}>
      {rect ? (
        <div
          className="tutorial-spotlight"
          style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
        />
      ) : (
        <div className="tutorial-scrim" />
      )}
      <div
        ref={card}
        className={placement ? `tutorial-card tutorial-from-${placement.side}` : 'tutorial-card is-centered'}
        style={placement ? { top: placement.top, left: placement.left } : undefined}
      >
        <button type="button" className="tutorial-close" onClick={requestExit} aria-label="Salir del recorrido">
          <Icon name="close" className="text-[18px]" />
        </button>
        <p className="tutorial-kicker">
          {tutorial.title} · paso {stepIndex + 1} de {tutorial.steps.length}
        </p>
        <div
          className="tutorial-bar"
          role="progressbar"
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={tutorial.steps.length}
        >
          <span style={{ width: `${percent}%` }} />
        </div>
        {/* El «para qué sirve» del recorrido sólo vivía en el catálogo: sin esto se
            empieza un tutorial sin saber a dónde lleva. */}
        {stepIndex === 0 ? <p className="tutorial-lead">{tutorial.intro}</p> : null}
        <h3>{step.title}</h3>
        <p>{step.content}</p>
        {step.tip ? (
          <p className="tutorial-tip">
            <Icon name="lightbulb" className="text-[15px]" />
            <span>{step.tip}</span>
          </p>
        ) : null}
        {/* Decir dónde mirar es la mitad del recorrido: sin esto, un paso cuyo
            elemento no está en pantalla se lee como si faltara información. */}
        {step.target && !rect ? (
          <p className="tutorial-note">
            Este paso señala algo que ahora mismo no está en pantalla. La explicación vale igual y puedes continuar.
          </p>
        ) : null}
        {step.target && disabled ? (
          <p className="tutorial-note">
            El elemento resaltado está deshabilitado en este momento, así que todavía no puedes usarlo. Continúa y vuelve
            cuando esté disponible.
          </p>
        ) : null}
        {confirmingExit ? (
          <div className="tutorial-confirm" role="alertdialog" aria-label="Confirmar salida">
            <p>
              Llevas {stepIndex + 1} de {tutorial.steps.length}. Si sales ahora se guarda tu avance y puedes retomarlo
              desde el Centro de Tutoriales.
            </p>
            <div className="tutorial-confirm-actions">
              <button type="button" className="tutorial-btn" onClick={() => setConfirmingExit(false)}>
                Seguir aquí
              </button>
              {/* No repite el nombre del botón de cerrar: dos botones con el mismo
                  nombre accesible en el mismo diálogo son indistinguibles para un
                  lector de pantalla. */}
              <button type="button" className="tutorial-btn is-danger" onClick={onExit}>
                Sí, salir
              </button>
            </div>
          </div>
        ) : null}
        <div className="tutorial-actions">
          <button type="button" className="tutorial-btn" onClick={onPrevious} disabled={stepIndex === 0}>
            <Icon name="arrow_back" className="text-[15px]" /> Atrás
          </button>
          {waitingForAction ? (
            <>
              <span className="tutorial-wait">
                <Icon name="ads_click" className="text-[15px]" /> {waitLabel}
              </span>
              {/* Salida siempre disponible: un recorrido que sólo avanza con un clic
                  concreto no puede ser un callejón sin salida. */}
              <button type="button" className="tutorial-btn" onClick={onNext}>
                Saltar este paso
              </button>
            </>
          ) : (
            <button type="button" className="tutorial-btn is-primary" onClick={onNext}>
              {isLast ? 'Finalizar' : 'Siguiente'} <Icon name="arrow_forward" className="text-[15px]" />
            </button>
          )}
        </div>
      </div>
    </div>
    </TutorialPortal>
  );
}
