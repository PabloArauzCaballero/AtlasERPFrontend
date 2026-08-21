'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  localTutorialStore,
  nextEntry,
  type ProgressMap,
  type SaveOptions,
  type TutorialStatus,
  type TutorialStore,
} from './tutorial-progress';

/**
 * Progreso de tutoriales del usuario.
 *
 * Se lee en un efecto y no durante el render porque el almacén vive en el
 * navegador: leerlo al renderizar daría un árbol distinto en servidor y cliente,
 * y React descartaría el del servidor.
 */
export function useTutorialProgress(store: TutorialStore = localTutorialStore) {
  const [progress, setProgress] = useState<ProgressMap>({});
  // Espejo del estado para construir el registro nuevo FUERA del actualizador:
  // calcularlo dentro obligaría a un efecto secundario en una función que React
  // puede invocar más de una vez.
  const latest = useRef(progress);
  latest.current = progress;

  useEffect(() => setProgress(store.read()), [store]);

  const save = useCallback(
    (tutorialId: string, status: TutorialStatus, options: SaveOptions = {}) => {
      const entry = nextEntry(tutorialId, status, latest.current[tutorialId], options, new Date().toISOString());
      setProgress((current) => {
        const next = { ...current, [tutorialId]: entry };
        store.write(next);
        return next;
      });
    },
    [store],
  );

  return {
    progress,
    isCompleted: (id: string) => progress[id]?.status === 'COMPLETED',
    lastStep: (id: string) => progress[id]?.lastStep ?? 0,
    /**
     * `true` si el recorrido cambió desde que el usuario lo hizo. Uno reescrito
     * enseña algo distinto, así que vuelve a contar como pendiente sin borrar el
     * historial de que ya lo había visto.
     */
    isOutdated: (id: string, version: number) => {
      const entry = progress[id];
      return Boolean(entry && entry.status === 'COMPLETED' && entry.version < version);
    },
    markStarted: (id: string, lastStep = 0, version?: number) => save(id, 'STARTED', { lastStep, version }),
    saveStep: (id: string, lastStep: number, version?: number) => save(id, 'STARTED', { lastStep, version }),
    markCompleted: (id: string, version?: number) => save(id, 'COMPLETED', { version }),
    markSkipped: (id: string, lastStep?: number) => save(id, 'SKIPPED', { lastStep }),
    /** Reinicio explícito: vuelve al paso 0 y cuenta la repetición. */
    restart: (id: string, version?: number) => save(id, 'STARTED', { lastStep: 0, version, repeat: true }),
    setAutoShow: (id: string, autoShow: boolean) =>
      save(id, progress[id]?.status ?? 'STARTED', { lastStep: progress[id]?.lastStep, autoShow }),
  };
}

export type TutorialProgressApi = ReturnType<typeof useTutorialProgress>;
