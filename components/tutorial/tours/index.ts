import type { InteractiveTutorial } from '../tutorial-types';
import { TOURS_CRM } from './tour-crm';
import { TOURS_INTRODUCCION } from './tour-introduccion';
import { TOURS_OPERACION } from './tour-operacion';

const ALL: readonly InteractiveTutorial[] = [...TOURS_INTRODUCCION, ...TOURS_CRM, ...TOURS_OPERACION];

/** Recorridos indexados por id. */
export const TUTORIALS: Readonly<Record<string, InteractiveTutorial>> = Object.fromEntries(
  ALL.map((tutorial) => [tutorial.id, tutorial]),
);

export function tutorialById(id: string): InteractiveTutorial | null {
  return TUTORIALS[id] ?? null;
}

export { ALL as ALL_TUTORIALS };
