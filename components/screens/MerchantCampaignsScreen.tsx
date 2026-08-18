'use client';

import { useCallback, useMemo, useState } from 'react';
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
import { formatBob } from '@/lib/formatters';
import type { ResourceRow } from '@/services/types';

const micros = (value: unknown) => Number(value ?? 0) / 1_000_000;

export function MerchantCampaignsScreen() {
  const scope = useMerchantScope();
  const { accountId, ready } = scope;

  /**
   * Los anunciantes se recargan al cambiar de comercio, así que NO puede ser `useOptions`, que
   * carga una sola vez al montar: el staff cambiaría de comercio y seguiría viendo los anunciantes
   * del anterior.
   */
  const advertisers = useAsyncResource(
    useCallback(() => (ready ? portalService.listAdvertisers(accountId) : Promise.resolve([] as ResourceRow[])), [accountId, ready]),
    ready,
  );
  const advertiserOptions = useMemo(
    () => ((advertisers.data ?? []) as ResourceRow[]).map((row) => ({ value: String(row.id), label: String(row.tradeName ?? row.legalName ?? 'Anunciante') })),
    [advertisers.data],
  );

  const [advertiserId, setAdvertiserId] = useState('');
  const campaigns = useAsyncResource(
    useCallback(() => (advertiserId ? portalService.listCampaigns(advertiserId) : Promise.resolve([] as ResourceRow[])), [advertiserId]),
    Boolean(advertiserId),
  );
  const rows = useMemo(() => (campaigns.data ?? []) as ResourceRow[], [campaigns.data]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(campaign: ResourceRow) {
    const id = String(campaign.id);
    const status = String(campaign.status);
    const next = status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setBusyId(id);
    setError(null);
    try {
      await portalService.setCampaignStatus(id, next);
      await campaigns.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar el estado.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Portal comercio' }, { label: 'Campañas' }]}
        title="Campañas publicitarias"
        description="Encienda o pause las campañas de su comercio. La creación y edición de segmentos se gestiona con su ejecutivo comercial."
      />

      <Panel compact>
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* El comercio no elige comercio: el backend deriva sus anunciantes de sus membresías. */}
          {scope.isMerchant ? null : (
            <FormField kind="select" label="Comercio" name="merchantAccountId" className="max-w-md flex-1" value={accountId ?? ''} onChange={(e) => { scope.setAccountId(e.target.value); setAdvertiserId(''); }} options={[{ label: '— Seleccione un comercio —', value: '' }, ...scope.accountOptions]} />
          )}
          <FormField kind="select" label="Anunciante" name="advertiserId" className="max-w-md flex-1" value={advertiserId} onChange={(e) => setAdvertiserId(e.target.value)} options={[{ label: ready ? '— Seleccione un anunciante —' : '— Elija primero el comercio —', value: '' }, ...advertiserOptions]} />
        </div>
      </Panel>

      {error ? <InlineNotice tone="danger" title="No se pudo completar">{error}</InlineNotice> : null}
      {campaigns.error ? <InlineNotice tone="danger" title="No se pudieron cargar las campañas">{campaigns.error}</InlineNotice> : null}
      {advertisers.error ? <InlineNotice tone="danger" title="No se pudieron cargar los anunciantes">{advertisers.error}</InlineNotice> : null}
      {!advertiserId ? <InlineNotice tone="info" title="Seleccione un anunciante">Elija un anunciante para ver sus campañas.</InlineNotice> : null}

      {advertiserId && !campaigns.error ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((campaign) => {
            const id = String(campaign.id);
            const status = String(campaign.status);
            const toggleable = status === 'ACTIVE' || status === 'PAUSED';
            const spent = micros(campaign.spendTotalMicros);
            const budget = micros(campaign.budgetTotalMicros);
            const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
            return (
              <section key={id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{String(campaign.name)}</p><p className="text-[10px] uppercase tracking-wide text-slate-400">{String(campaign.objective ?? '')}</p></div>
                  <StatusPill tone={status === 'ACTIVE' ? 'success' : status === 'PAUSED' ? 'warning' : 'neutral'}>{status}</StatusPill>
                </div>
                <div className="mt-3 text-[11px] text-slate-600">
                  <div className="flex justify-between"><span>Gastado</span><b>{formatBob(spent)}</b></div>
                  <div className="flex justify-between"><span>Presupuesto</span><b>{formatBob(budget)}</b></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#031636]" style={{ width: `${pct}%` }} /></div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">
                  <Icon name="verified" className="text-[13px]" />{String(campaign.approvalStatus ?? '')}
                </div>
                <div className="mt-3">
                  {toggleable ? (
                    <AtlasButton className="w-full" variant={status === 'ACTIVE' ? 'secondary' : 'primary'} icon={status === 'ACTIVE' ? 'pause' : 'play_arrow'} loading={busyId === id} onClick={() => toggle(campaign)}>
                      {status === 'ACTIVE' ? 'Pausar campaña' : 'Activar campaña'}
                    </AtlasButton>
                  ) : (
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-center text-[10px] text-slate-500">No disponible para on/off (estado {status}).</p>
                  )}
                </div>
              </section>
            );
          })}
          {!rows.length && campaigns.status !== 'loading' ? <Panel><p className="py-6 text-center text-xs text-slate-500">Este anunciante no tiene campañas.</p></Panel> : null}
        </div>
      ) : null}
    </div>
  );
}
