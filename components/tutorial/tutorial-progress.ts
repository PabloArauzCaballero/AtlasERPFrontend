/**
 * Progreso de tutoriales: forma, validación y almacenamiento.
 *
 * Tanto el backend como `localStorage` son entrada NO confiable: el primero puede
 * cambiar de contrato y el segundo lo escribe cualquier versión anterior de la
 * aplicación que siga viva en el navegador de alguien. Sin validar, un `lastStep`
 * que llegue como texto se propaga hasta la aritmética del Centro y sale como
 * «paso NaN de 5».
 *
 * Se descartan los registros inválidos en lugar de romper: perder el progreso de
 * un recorrido es molesto; dejar la pantalla de aprendizaje en blanco, peor.
 */

export type TutorialStatus = 'STARTED' | 'COMPLETED' | 'SKIPPED';

export interface TutorialProgress {
  tutorialId: string;
  status: TutorialStatus;
  lastStep: number;
  version: number;
  /** El usuario permite que este recorrido se ofrezca solo al entrar. */
  autoShow: boolean;
  startedAt?: string;
  completedAt?: string;
  lastInteractionAt?: string;
  repeatCount?: number;
}

const STATUSES: readonly TutorialStatus[] = ['STARTED', 'COMPLETED', 'SKIPPED'];

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asCount(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : fallback;
}

/** Valida un registro suelto. `null` si no es utilizable. */
export function parseProgress(input: unknown): TutorialProgress | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>;
  const tutorialId = asString(row.tutorialId);
  const status = STATUSES.find((candidate) => candidate === row.status);
  if (!tutorialId || !status) return null;
  const entry: TutorialProgress = {
    tutorialId,
    status,
    lastStep: asCount(row.lastStep, 0),
    version: Math.max(1, asCount(row.version, 1)),
    autoShow: typeof row.autoShow === 'boolean' ? row.autoShow : true,
    repeatCount: asCount(row.repeatCount, 0),
  };
  const startedAt = asString(row.startedAt);
  const completedAt = asString(row.completedAt);
  const lastInteractionAt = asString(row.lastInteractionAt);
  if (startedAt) entry.startedAt = startedAt;
  if (completedAt) entry.completedAt = completedAt;
  if (lastInteractionAt) entry.lastInteractionAt = lastInteractionAt;
  return entry;
}

export type ProgressMap = Record<string, TutorialProgress>;

/** Registros válidos indexados por recorrido; los corruptos se ignoran. */
export function parseProgressRows(input: unknown): ProgressMap {
  const rows = Array.isArray(input) ? input : input && typeof input === 'object' ? Object.values(input) : [];
  const map: ProgressMap = {};
  for (const row of rows) {
    const parsed = parseProgress(row);
    if (parsed) map[parsed.tutorialId] = parsed;
  }
  return map;
}

const CACHE_KEY = 'atlas.erp.tutorial.progress';

/**
 * Almacén del progreso.
 *
 * Hoy el ERP no expone un endpoint de progreso de tutoriales, así que la fuente
 * de verdad es el navegador. Esto está detrás de una interfaz a propósito: el día
 * que el backend lo ofrezca (el contrato que ya usa DecisionEngine es
 * `GET /tutorial-progress` y `PUT /tutorial-progress/:id`), se implementa otro
 * adaptador y el motor no cambia.
 *
 * Consecuencia mientras tanto, y conviene decirla en voz alta: el avance vive en
 * ESE navegador. Quien entre desde otro equipo empieza de cero. Es una molestia
 * aceptable —lo que se pierde es «ya vi este tutorial», no trabajo— y muy
 * preferible a inventar un endpoint que no existe y tragarse el 404 en silencio,
 * que se lee como un backend caído.
 */
export interface TutorialStore {
  read: () => ProgressMap;
  write: (map: ProgressMap) => void;
}

export const localTutorialStore: TutorialStore = {
  read: () => {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      return raw ? parseProgressRows(JSON.parse(raw)) : {};
    } catch {
      // Navegación privada o almacenamiento bloqueado: se arranca sin historial.
      return {};
    }
  },
  write: (map) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(map));
    } catch {
      /* mejor esfuerzo: no poder recordar el avance no puede romper el recorrido */
    }
  },
};

interface SaveOptions {
  lastStep?: number | undefined;
  version?: number | undefined;
  autoShow?: boolean | undefined;
  /** Suma una repetición: sólo lo pide un reinicio explícito del usuario. */
  repeat?: boolean | undefined;
}

/** Construye el registro nuevo conservando lo que el anterior ya sabía. */
export function nextEntry(
  tutorialId: string,
  status: TutorialStatus,
  previous: TutorialProgress | undefined,
  options: SaveOptions,
  now: string,
): TutorialProgress {
  const entry: TutorialProgress = {
    tutorialId,
    status,
    lastStep: options.lastStep ?? 0,
    // La versión es la del recorrido que se está haciendo. Guardar un `1` fijo
    // haría que un tutorial reescrito no se volviera a ofrecer nunca.
    version: options.version ?? previous?.version ?? 1,
    autoShow: options.autoShow ?? previous?.autoShow ?? true,
    startedAt: previous?.startedAt ?? now,
    lastInteractionAt: now,
    repeatCount: (previous?.repeatCount ?? 0) + (options.repeat ? 1 : 0),
  };
  const completedAt = status === 'COMPLETED' ? now : previous?.completedAt;
  if (completedAt) entry.completedAt = completedAt;
  return entry;
}

export type { SaveOptions };
