'use client';

import { createContext, useContext } from 'react';
import type { InteractiveTutorial } from './tutorial-types';

export interface StartOptions {
  /** Retoma el último paso guardado en lugar de empezar de cero. */
  resume?: boolean;
  /** Reinicio explícito tras haberlo completado: cuenta una repetición. */
  repeat?: boolean;
}

export interface TutorialValue {
  tutorial: InteractiveTutorial | null;
  stepIndex: number;
  /** Inicia el recorrido con ese id, si existe. */
  start: (tutorialId: string, options?: StartOptions) => void;
  next: () => void;
  previous: () => void;
  exit: () => void;
  /** Progreso del usuario, para el Centro y para las tarjetas. */
  progress: import('./tutorial-progress').ProgressMap;
  isCompleted: (id: string) => boolean;
  lastStep: (id: string) => number;
  isOutdated: (id: string, version: number) => boolean;
}

export const TutorialContext = createContext<TutorialValue | null>(null);

/**
 * Acceso al motor.
 *
 * Devuelve `null` fuera del proveedor en lugar de lanzar: el botón de ayuda vive
 * en `WorkspaceHeader`, que también se usa en pantallas fuera del armazón
 * autenticado. Reventar allí convertiría la falta de un tutorial en una pantalla
 * en blanco, que es peor que no ofrecer el botón.
 */
export function useTutorial(): TutorialValue | null {
  return useContext(TutorialContext);
}
