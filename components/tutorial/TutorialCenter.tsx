'use client';

import { useMemo, useState } from 'react';
import { Icon } from '@/components/atlas/Icon';
import { Panel } from '@/components/atlas/Panel';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { cn } from '@/lib/cn';
import { guideCount } from './guias';
import {
  EMPTY_FILTERS,
  filterListings,
  primaryActionLabel,
  STATE_LABELS,
  summarize,
  tutorialState,
  type CenterFilters,
  type TutorialState,
} from './tutorial-center-state';
import { listingsForAudience, pendingPrerequisites, tutorialTitle } from './tutorial-registry';
import {
  TUTORIAL_CATEGORY_LABELS,
  TUTORIAL_LEVEL_LABELS,
  type TutorialCategory,
  type TutorialLevel,
  type TutorialListing,
} from './tutorial-types';
import { useTutorial } from './TutorialContext';

const STATE_TONE: Record<TutorialState, string> = {
  pending: 'bg-slate-100 text-slate-600',
  'in-progress': 'bg-amber-50 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-700',
  outdated: 'bg-blue-50 text-blue-700',
};

/**
 * Centro de Tutoriales: todos los recorridos, con el avance de quien mira.
 *
 * El porcentaje se calcula sobre lo que ESTA población puede abrir. Contar el
 * catálogo entero dejaría a un comercio con un avance clavado por debajo del
 * 100 % por recorridos de pantallas que su sesión ni siquiera alcanza.
 */
export function TutorialCenter({ audience }: { audience: 'internal' | 'merchant' }) {
  const engine = useTutorial();
  const [filters, setFilters] = useState<CenterFilters>(EMPTY_FILTERS);

  const listings = useMemo(() => listingsForAudience(audience), [audience]);
  const stateOf = useMemo(
    () => (listing: TutorialListing) => tutorialState(listing, engine?.progress[listing.id]),
    [engine?.progress],
  );
  const summary = useMemo(() => summarize(listings, stateOf), [listings, stateOf]);
  const visible = useMemo(() => filterListings(listings, stateOf, filters), [listings, stateOf, filters]);

  const categories = useMemo(
    () => Array.from(new Set(listings.map((listing) => listing.category))),
    [listings],
  );

  return (
    <div data-tutorial-id="tutorial-center" className="space-y-5">
      <WorkspaceHeader
        eyebrow="Ayuda"
        title="Centro de Tutoriales"
        description="Recorridos guiados sobre la aplicación real. Puedes retomar uno a medias o repetir cualquiera."
        breadcrumbs={[{ label: 'Ayuda' }, { label: 'Tutoriales' }]}
        hideHelp
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="Tu avance" value={`${summary.percent}%`} detail={`${summary.completed} de ${summary.total} completados`} icon="school" />
        <SummaryTile label="En progreso" value={String(summary.inProgress)} detail="Puedes retomarlos donde los dejaste" icon="play_circle" />
        <SummaryTile label="Pendientes" value={String(summary.pending)} detail="Todavía sin empezar" icon="pending" />
        <SummaryTile label="Pantallas explicadas" value={String(guideCount())} detail="Cada vista tiene su «¿Qué es esto?»" icon="help" />
      </div>

      <Panel compact>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 focus-within:border-[#006a61]">
            <Icon name="search" className="text-[18px] text-slate-500" />
            <input
              className="min-w-0 flex-1 bg-transparent text-xs outline-none"
              placeholder="Buscar un tutorial..."
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Módulo"
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700"
              value={filters.category}
              onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value as TutorialCategory | 'all' }))}
            >
              <option value="all">Todos los módulos</option>
              {categories.map((category) => (
                <option key={category} value={category}>{TUTORIAL_CATEGORY_LABELS[category]}</option>
              ))}
            </select>
            <select
              aria-label="Estado"
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700"
              value={filters.state}
              onChange={(event) => setFilters((current) => ({ ...current, state: event.target.value as TutorialState | 'all' }))}
            >
              <option value="all">Cualquier estado</option>
              {(Object.keys(STATE_LABELS) as TutorialState[]).map((state) => (
                <option key={state} value={state}>{STATE_LABELS[state]}</option>
              ))}
            </select>
            <select
              aria-label="Nivel"
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700"
              value={filters.level}
              onChange={(event) => setFilters((current) => ({ ...current, level: event.target.value as TutorialLevel | 'all' }))}
            >
              <option value="all">Cualquier nivel</option>
              {(Object.keys(TUTORIAL_LEVEL_LABELS) as TutorialLevel[]).map((level) => (
                <option key={level} value={level}>{TUTORIAL_LEVEL_LABELS[level]}</option>
              ))}
            </select>
          </div>
        </div>
      </Panel>

      {visible.length === 0 ? (
        <Panel>
          <p className="py-10 text-center text-sm text-slate-500">Ningún tutorial coincide con estos filtros.</p>
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((listing) => (
            <TutorialCard
              key={listing.id}
              listing={listing}
              state={stateOf(listing)}
              audience={audience}
              isCompleted={(id) => Boolean(engine?.isCompleted(id))}
              onStart={(options) => engine?.start(listing.id, options)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryTile({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: string }) {
  return (
    <article className="flex min-h-24 items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        <p className="mt-1 truncate text-[11px] text-slate-500">{detail}</p>
      </div>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary-wash text-primary">
        <Icon name={icon} className="text-[22px]" />
      </span>
    </article>
  );
}

interface CardProps {
  listing: TutorialListing;
  state: TutorialState;
  audience: 'internal' | 'merchant';
  isCompleted: (id: string) => boolean;
  onStart: (options?: { resume?: boolean; repeat?: boolean }) => void;
}

/**
 * Tarjeta de un recorrido.
 *
 * Los prerrequisitos pendientes no ocultan el botón: se avisa y se deja empezar.
 * Bloquearlo convertiría una recomendación en una puerta cerrada, y quien ya sabe
 * de qué va no tiene por qué repetir el recorrido anterior para poder mirar éste.
 */
function TutorialCard({ listing, state, audience, isCompleted, onStart }: CardProps) {
  const pending = pendingPrerequisites(listing, isCompleted, audience);
  const label = primaryActionLabel(state);

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', STATE_TONE[state])}>
          {STATE_LABELS[state]}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
          {TUTORIAL_CATEGORY_LABELS[listing.category]}
        </span>
        {listing.essential ? (
          <span className="rounded-full bg-[#006a61] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Esencial
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-bold text-slate-900">{listing.title}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-600">{listing.intro}</p>
      </div>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
        <span className="flex items-center gap-1"><Icon name="schedule" className="text-[14px]" />{listing.estimatedMinutes} min</span>
        <span className="flex items-center gap-1"><Icon name="list" className="text-[14px]" />{listing.stepCount} pasos</span>
        <span className="flex items-center gap-1"><Icon name="signal_cellular_alt" className="text-[14px]" />{TUTORIAL_LEVEL_LABELS[listing.level]}</span>
      </p>

      {pending.length ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
          Se entiende mejor después de: {pending.map(tutorialTitle).join(', ')}.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onStart(state === 'in-progress' ? { resume: true } : state === 'completed' ? { repeat: true } : undefined)}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-[#006a61] px-3 text-xs font-bold text-white shadow-sm hover:bg-[#00544d]"
        >
          <Icon name={state === 'in-progress' ? 'play_arrow' : 'explore'} className="text-[16px]" />
          {label}
        </button>
        {state === 'in-progress' ? (
          <button
            type="button"
            onClick={() => onStart()}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <Icon name="restart_alt" className="text-[16px]" />
            Desde el principio
          </button>
        ) : null}
      </div>
    </article>
  );
}
