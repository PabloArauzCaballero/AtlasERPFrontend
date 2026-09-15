import type { InteractiveTutorial } from '../tutorial-types';
import { TOURS_CRM } from './tour-crm';
import { TOURS_NEGOCIO } from './tour-negocio';
import { TOURS_INTRODUCCION } from './tour-introduccion';
import { TOURS_OPERACION } from './tour-operacion';

// Los de negocio van PRIMERO: son los que hay que hacer antes que ninguno (ver tour-negocio.ts).
const ALL: readonly InteractiveTutorial[] = [...TOURS_NEGOCIO, ...TOURS_INTRODUCCION, ...TOURS_CRM, ...TOURS_OPERACION];

/** Recorridos indexados por id. */
export const TUTORIALS: Readonly<Record<string, InteractiveTutorial>> = Object.fromEntries(
  ALL.map((tutorial) => [tutorial.id, tutorial]),
);

export function tutorialById(id: string): InteractiveTutorial | null {
  return TUTORIALS[id] ?? null;
}

export { ALL as ALL_TUTORIALS };
