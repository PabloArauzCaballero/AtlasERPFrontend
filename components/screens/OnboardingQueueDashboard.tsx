'use client';

import { MetricCard } from '@/components/atlas/MetricCard';
import { cn } from '@/lib/cn';
import type { ResourceRow } from '@/services/types';

export type OnboardingScope = 'abiertos' | 'historial' | 'todos';

const SCOPES: Array<{ id: OnboardingScope; label: string; hint: string }> = [
  { id: 'abiertos', label: 'Por atender', hint: 'Lo que falta por hacer. Es la cola.' },
  { id: 'historial', label: 'Activados', hint: 'Comercios ya operando: su expediente cerrado.' },
  { id: 'todos', label: 'Todos', hint: 'Para exportar y auditar, no para trabajar.' },
];

interface OnboardingQueueDashboardProps {
  summary: ResourceRow | null;
  loading: boolean;
  scope: OnboardingScope;
  onScopeChange: (scope: OnboardingScope) => void;
}

/**
 * El mini-tablero de la cola, y el selector de qué se está mirando.
 *
 * Las cinco cifras salen de UNA consulta del backend, contadas con la misma regla que aplica la
 * activación: «listos para activar» es lo que el botón aceptaría hoy, no una aproximación. Un
 * tablero que afirma «3 listos» con otra regla convence de algo que el backend va a rechazar.
 *
 * El selector es lo que responde a la queja original: los comercios ya activados salían mezclados
 * con los pendientes. Ahora la cola arranca en «Por atender» y el historial es un filtro explícito.
 */
export function OnboardingQueueDashboard({ summary, loading, scope, onScopeChange }: OnboardingQueueDashboardProps) {
  const n = (key: string) => (loading ? '…' : Number(summary?.[key] ?? 0));
  return (
    <div className="space-y-4" data-tutorial-id="onboarding-tablero">
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Por atender" value={n('abiertos')} detail="Casos que aún no cierran" icon="pending_actions" />
        <MetricCard label="Esperando al Motor" value={n('esperandoMotor')} detail="Verificación pedida" icon="hourglass_top" tone="purple" />
        <MetricCard label="A revisión manual" value={n('revisionManual')} detail="Los mira una persona" icon="rule" tone="amber" />
        <MetricCard label="Esperando credenciales" value={n('esperandoCredenciales')} detail="Pedidas al portal" icon="key" tone="teal" />
        <MetricCard label="Listos para activar" value={n('listosParaActivar')} detail="Sin pendientes y con contrato" icon="rocket_launch" tone="navy" />
      </div>
      <div role="radiogroup" aria-label="Qué casos mostrar" className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
        {SCOPES.map((option) => (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={scope === option.id}
            title={option.hint}
            data-testid={`onboarding-scope-${option.id}`}
            onClick={() => onScopeChange(option.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-bold transition',
              scope === option.id ? 'bg-primary-wash text-primary' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700',
            )}
          >
            {option.label}
            {option.id === 'historial' && !loading ? <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{n('activados')}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
