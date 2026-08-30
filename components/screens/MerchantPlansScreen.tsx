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
import { BotonPdf } from '@/components/atlas/BotonPdf';
import { tablaPdf } from '@/lib/pdf';
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
    if (!ready) { setError('Elige primero sobre qué negocio quieres contratar.'); return; }
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
        breadcrumbs={[{ label: 'Portal comercio' }, { label: 'Tarifas' }]}
        title="Tarifas de publicidad"
        description="Usted paga por lo que la plataforma entrega: personas alcanzadas y clics recibidos. Sin cuota mensual y sin límite de sucursales."
        actions={
          <BotonPdf
            label="Descargar PDF"
            data-testid="pdf-planes"
            disabled={!plans.length}
            documento={() => ({
              title: 'Tarifas de publicidad',
              subtitle: current ? `Plan contratado: ${String(current.planName ?? current.planId ?? '—')}` : 'Sin plan contratado',
              summary: [{ label: 'Tarifas disponibles', value: plans.length }],
              sections: [
                {
                  title: 'Tarifas',
                  table: tablaPdf(
                    [
                      { key: 'name', label: 'Tarifa' },
                      { key: 'code', label: 'Código' },
                      { key: 'currencyCode', label: 'Moneda' },
                      { key: 'status', label: 'Estado' },
                    ],
                    plans,
                  ),
                },
              ],
            })}
          />
        }
      />

      <Panel compact>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {/*
            * El comercio no elige comercio: el negocio es el que inició sesión.
            *
            * Lo único que se pregunta —y sólo a quien administra varios— es con cuál de SUS
            * negocios sigue. Antes aquí salía un desplegable con todos los comercios de la
            * plataforma, porque la pantalla se creía el `requiresAccountSelection` que el backend
            * también levanta para el staff interno.
            */}
          {scope.requiresSelection ? (
            <FormField
              kind="select"
              label="Negocio"
              name="merchantAccountId"
              className="flex-1"
              value={scope.accountId ?? ''}
              onChange={(e) => scope.setAccountId(e.target.value)}
              hint="Administras varios negocios: elige sobre cuál quieres ver el plan."
              options={[{ label: '— Elige uno de tus negocios —', value: '' }, ...scope.accountOptions]}
            />
          ) : null}
          {current ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs">
              <span className="font-bold text-emerald-800">Plan actual: {String((current.plan as ResourceRow | undefined)?.name ?? '—')}</span>
              <span className="ml-2 text-emerald-700">Renueva {formatDate(typeof current.currentPeriodEnd === 'string' ? current.currentPeriodEnd : undefined)}</span>
            </div>
          ) : null}
        </div>
      </Panel>

      {scope.error ? <InlineNotice tone="danger" title="No se pudo determinar tu negocio">{scope.error}</InlineNotice> : null}
      {error ? <InlineNotice tone="danger" title="No se pudo completar">{error}</InlineNotice> : null}
      {plansResource.error ? <InlineNotice tone="danger" title="No se pudieron cargar los planes">{plansResource.error}</InlineNotice> : null}

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan) => {
          const planId = String(plan.id);
          const isCurrent = planId === currentPlanId;
          /*
           * La tarifa, no una cuota. El comercio paga por lo que la plataforma le ENTREGA —personas
           * alcanzadas y clics recibidos—, asi que el precio que decide una compra son estas dos
           * cifras. Antes aqui se mostraba un importe mensual, que era lo unico que separaba a un
           * plan de otro junto con un tope de sucursales que ningun codigo aplicaba.
           */
          const cpm = Number(plan.cpmPrice ?? 0);
          const cpc = Number(plan.cpcPrice ?? 0);
          const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
          return (
            <section key={planId} className={`flex flex-col rounded-xl border bg-white p-5 shadow-sm ${isCurrent ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-[#006a61]">{String(plan.name)}</h3>
                <StatusPill tone={tierTone[String(plan.tier)] ?? 'neutral'} dot={false}>{String(plan.tier)}</StatusPill>
              </div>
              <p className="mt-1 min-h-8 text-xs text-slate-500">{String(plan.description ?? '')}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Alcance</p>
                  <p className="mt-1 text-xl font-extrabold text-slate-900">{formatBob(cpm)}</p>
                  <p className="text-[11px] leading-4 text-slate-500">por cada 1.000 personas</p>
                </div>
                <div className="rounded-md bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Clics</p>
                  <p className="mt-1 text-xl font-extrabold text-slate-900">{formatBob(cpc)}</p>
                  <p className="text-[11px] leading-4 text-slate-500">por clic recibido</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-slate-500">Sin cuota mensual. Usted fija el presupuesto de cada campana.</p>
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
