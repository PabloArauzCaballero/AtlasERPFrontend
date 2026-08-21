'use client';

import { useCallback, useEffect, useState } from 'react';
import { portalService } from '@/services/portalService';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useMerchantScope } from '@/hooks/useMerchantScope';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { formatBob, formatDate } from '@/lib/formatters';
import type { ResourceRow } from '@/services/types';

const tierTone: Record<string, 'neutral' | 'success' | 'warning'> = {
  STARTER: 'neutral',
  STANDARD: 'success',
  PREMIUM: 'warning',
  ENTERPRISE: 'warning',
};

export function MerchantPlansScreen() {
  const plansResource = useAsyncResource(useCallback(() => portalService.listPlans(), []));
  const plans = (plansResource.data ?? []) as ResourceRow[];

  const scope = useMerchantScope();
  const { accountId, ready } = scope;
  const subscription = useAsyncResource(
    useCallback(() => (ready ? portalService.getSubscription(accountId) : Promise.resolve(null)), [accountId, ready]),
    ready,
  );
  const current = (subscription.data ?? null) as ResourceRow | null;
  const currentPlanId = current ? String(current.planId ?? '') : '';

  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setError(null); }, [accountId]);

  async function selectPlan(planId: string) {
    // El staff debe decir en nombre de quién contrata; el comercio no, y por eso `ready` ya es
    // cierto para él sin haber elegido nada.
    if (!ready) { setError('Seleccione primero el comercio.'); return; }
    setBusyPlan(planId);
    setError(null);
    try {
      await portalService.subscribe({ ...(accountId ? { merchantAccountId: accountId } : {}), planId, autoRenew: true });
      await subscription.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo activar el plan.');
    } finally {
      setBusyPlan(null);
    }
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Portal comercio' }, { label: 'Planes' }]}
        title="Planes y suscripción"
        description="Elija el plan que mejor se ajusta a su comercio. La selección activa la suscripción y habilita las funciones incluidas."
      />

      <Panel compact>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {/* El comercio no elige comercio: su alcance sale de sus membresías. */}
          {scope.isMerchant ? null : (
            <FormField
              kind="select"
              label="Comercio"
              name="merchantAccountId"
              className="flex-1"
              value={scope.accountId ?? ''}
              onChange={(e) => scope.setAccountId(e.target.value)}
              options={[{ label: '— Seleccione un comercio —', value: '' }, ...scope.accountOptions]}
            />
          )}
          {current ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs">
              <span className="font-bold text-emerald-800">Plan actual: {String((current.plan as ResourceRow | undefined)?.name ?? '—')}</span>
              <span className="ml-2 text-emerald-700">Renueva {formatDate(typeof current.currentPeriodEnd === 'string' ? current.currentPeriodEnd : undefined)}</span>
            </div>
          ) : null}
        </div>
      </Panel>

      {error ? <InlineNotice tone="danger" title="No se pudo completar">{error}</InlineNotice> : null}
      {plansResource.error ? <InlineNotice tone="danger" title="No se pudieron cargar los planes">{plansResource.error}</InlineNotice> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const planId = String(plan.id);
          const isCurrent = planId === currentPlanId;
          const price = Number(plan.monthlyPrice ?? 0);
          const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
          return (
            <section key={planId} className={`flex flex-col rounded-xl border bg-white p-5 shadow-sm ${isCurrent ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-[#006a61]">{String(plan.name)}</h3>
                <StatusPill tone={tierTone[String(plan.tier)] ?? 'neutral'} dot={false}>{String(plan.tier)}</StatusPill>
              </div>
              <p className="mt-1 min-h-8 text-xs text-slate-500">{String(plan.description ?? '')}</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-slate-900">{price === 0 ? 'Gratis' : formatBob(price)}</span>
                {price > 0 ? <span className="text-xs text-slate-500">/ mes</span> : null}
              </div>
              <ul className="mt-4 flex-1 space-y-2">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-slate-700">
                    <Icon name="check_circle" className="mt-0.5 text-[15px] text-emerald-500" />{feature}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {isCurrent ? (
                  <AtlasButton variant="secondary" icon="check" className="w-full" disabled>Plan actual</AtlasButton>
                ) : (
                  <AtlasButton icon="bolt" className="w-full" loading={busyPlan === planId} disabled={!ready || Boolean(busyPlan)} onClick={() => selectPlan(planId)}>
                    {current ? 'Cambiar a este plan' : 'Seleccionar plan'}
                  </AtlasButton>
                )}
              </div>
            </section>
          );
        })}
        {!plans.length && plansResource.status !== 'loading' ? (
          <Panel><p className="py-6 text-center text-xs text-slate-500">No hay planes disponibles. Ejecute la migración de planes o créelos desde el panel interno.</p></Panel>
        ) : null}
      </div>
    </div>
  );
}
