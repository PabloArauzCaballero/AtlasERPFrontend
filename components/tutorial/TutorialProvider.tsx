'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { TutorialContext, type StartOptions, type TutorialValue } from './TutorialContext';
import { TutorialOverlay } from './TutorialOverlay';
import { tutorialById } from './tours';
import { tutorialMeta } from './tutorial-registry';
import { applicableIndex, clampStep, isAtRoute, routeForStep, type TutorialRouter } from './tutorial-navigation';
import type { InteractiveTutorial } from './tutorial-types';
import { useTutorialProgress } from './useTutorialProgress';

/**
 * Ruta en la que debe verse el paso: la que declara el propio paso y, si el
 * recorrido no habla de rutas, la de su ficha en el Centro. Gracias a esa segunda
 * fuente, un recorrido de una sola pantalla se puede lanzar desde el Centro sin
 * repetir la ruta en cada paso.
 */
function tutorialRoute(tutorial: InteractiveTutorial, index: number): string | null {
  return routeForStep(tutorial, index) ?? tutorialMeta(tutorial.id)?.route ?? null;
}

/**
 * Motor de recorridos interactivos.
 *
 * Se monta una sola vez dentro del armazón autenticado, de modo que cualquier
 * pantalla puede lanzar un recorrido y el overlay se pinta por encima de todo.
 */
export function TutorialProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [tutorial, setTutorial] = useState<InteractiveTutorial | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const { progress, isCompleted, lastStep, isOutdated, markStarted, saveStep, markCompleted, markSkipped, restart } =
    useTutorialProgress();

  // El router cambia de identidad en cada navegación; leerlo por referencia evita
  // rehacer los callbacks —y volver a disparar el efecto de navegación— en cada
  // cambio de ruta.
  const nav = useRef<TutorialRouter>({ pathname, push: router.push });
  nav.current = { pathname, push: router.push };

  const begin = useCallback(
    (found: InteractiveTutorial, from: number, repeat: boolean) => {
      const here = nav.current.pathname;
      /**
       * Saltar pasos opcionales exige poder MIRAR la pantalla del recorrido. Al
       * lanzarlo desde el Centro todavía estamos en `/tutoriales`, así que el DOM
       * no dice nada sobre los elementos de la vista destino: juzgar ahí
       * descartaría justo los pasos que el usuario venía a ver. Sólo se filtra
       * cuando ya estamos donde el recorrido ocurre.
       */
      const destination = tutorialRoute(found, from);
      const onDestination = destination === null || isAtRoute(here, destination);
      const first = onDestination ? applicableIndex(found, from, 1, here) : from;
      // Si desde el paso pedido no queda nada aplicable se reintenta desde el
      // principio antes de rendirse: retomar no puede dejar sin recorrido.
      const index = first === -1 ? applicableIndex(found, 0, 1, here) : first;
      if (index === -1) return;
      setTutorial(found);
      setStepIndex(index);
      if (repeat) restart(found.id, found.version);
      else markStarted(found.id, index, found.version);
    },
    [markStarted, restart],
  );

  const start = useCallback(
    (id: string, options?: StartOptions) => {
      const found = tutorialById(id);
      if (!found) return;
      const from = options?.resume ? clampStep(found, lastStep(id)) : 0;
      begin(found, from, Boolean(options?.repeat));
    },
    [begin, lastStep],
  );

  const finish = useCallback(() => {
    if (tutorial) markCompleted(tutorial.id, tutorial.version);
    setTutorial(null);
    setStepIndex(0);
  }, [tutorial, markCompleted]);

  /** Salir a medias NO es completar: se guarda el paso para poder retomarlo. */
  const exit = useCallback(() => {
    if (tutorial) markSkipped(tutorial.id, stepIndex);
    setTutorial(null);
    setStepIndex(0);
  }, [tutorial, stepIndex, markSkipped]);

  const next = useCallback(() => {
    if (!tutorial) return;
    const target = applicableIndex(tutorial, stepIndex + 1, 1, nav.current.pathname);
    if (target === -1) {
      finish();
      return;
    }
    setStepIndex(target);
    saveStep(tutorial.id, target, tutorial.version);
  }, [tutorial, stepIndex, finish, saveStep]);

  const previous = useCallback(() => {
    if (!tutorial) return;
    const target = applicableIndex(tutorial, stepIndex - 1, -1, nav.current.pathname);
    if (target !== -1) setStepIndex(target);
  }, [tutorial, stepIndex]);

  /**
   * Lleva al usuario a la pantalla del paso actual.
   *
   * Sin esto, un recorrido que cruza vistas resaltaría el vacío: el elemento no
   * está porque la pantalla no es la correcta, no porque falte. Se compara con
   * `isAtRoute` y no con una igualdad, porque quien acaba de abrir una ficha desde
   * el listado YA está donde el recorrido lo quería, y devolverlo sería un bucle.
   */
  useEffect(() => {
    if (!tutorial) return;
    const route = tutorialRoute(tutorial, stepIndex);
    if (!route || isAtRoute(pathname, route)) return;
    router.push(route);
  }, [tutorial, stepIndex, pathname, router]);

  const value: TutorialValue = useMemo(
    () => ({ tutorial, stepIndex, start, next, previous, exit, progress, isCompleted, lastStep, isOutdated }),
    [tutorial, stepIndex, start, next, previous, exit, progress, isCompleted, lastStep, isOutdated],
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {tutorial ? (
        <TutorialOverlay
          tutorial={tutorial}
          stepIndex={stepIndex}
          onNext={next}
          onPrevious={previous}
          onExit={exit}
        />
      ) : null}
    </TutorialContext.Provider>
  );
}
