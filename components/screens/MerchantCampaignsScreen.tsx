'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

  /*
   * El comercio NO elige anunciante. Ve sus campañas, todas.
   *
   * Un comercio no sabe qué es un «anunciante»: es una entidad interna de la plataforma de ads, y
   * suya puede haber más de una (una por marca, por ejemplo). Pedirle que elija una para poder ver
   * sus campañas convertía la pantalla en un desplegable delante de una lista vacía. Ahora, cuando
   * quien mira es el comercio, se piden las campañas de TODOS sus anunciantes y se juntan en una
   * sola lista; el selector queda sólo para el staff interno, que entra en nombre de comercios
   * distintos y ahí sí es una decisión real.
   */
  const eligeAnunciante = !scope.isMerchant && advertiserOptions.length > 1;
  const unicoAnunciante = advertiserOptions.length === 1 ? advertiserOptions[0] : undefined;
  useEffect(() => {
    if (!eligeAnunciante && unicoAnunciante && !advertiserId) setAdvertiserId(unicoAnunciante.value);
  }, [eligeAnunciante, unicoAnunciante, advertiserId]);

  /** Anunciantes cuyas campañas hay que pedir: los elegidos, o todos los del comercio. */
  const anunciantesAConsultar = useMemo(() => {
    if (eligeAnunciante) return advertiserId ? [advertiserId] : [];
    if (advertiserId) return [advertiserId];
    return advertiserOptions.map((option) => option.value);
  }, [eligeAnunciante, advertiserId, advertiserOptions]);
  const clave = anunciantesAConsultar.join(',');

  const campaigns = useAsyncResource(
    useCallback(async () => {
      if (!clave) return [] as ResourceRow[];
      const nombrePorId = new Map(advertiserOptions.map((option) => [option.value, option.label]));
      const listas = await Promise.all(clave.split(',').map(async (id) => {
        const propias = await portalService.listCampaigns(id);
        // El nombre del anunciante viaja con la campaña: al juntar varias listas, sin él no se
        // sabría de cuál de las marcas del comercio es cada campaña.
        return propias.map((campaign) => ({ ...campaign, advertiserName: nombrePorId.get(id) ?? '' }));
      }));
      return listas.flat();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clave]),
    Boolean(clave),
  );
  const rows = useMemo(() => (campaigns.data ?? []) as ResourceRow[], [campaigns.data]);
  const variosAnunciantes = anunciantesAConsultar.length > 1;
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
        actions={
          <BotonPdf
            label="Descargar PDF"
            data-testid="pdf-campanas"
            disabled={!rows.length}
            documento={() => ({
              title: 'Campañas publicitarias',
              subtitle: 'Portal del comercio',
              summary: [
                { label: 'Campañas', value: rows.length },
                { label: 'Activas', value: rows.filter((fila) => String(fila.status) === 'ACTIVE').length },
              ],
              sections: [
                {
                  title: 'Campañas',
                  table: tablaPdf(
                    [
                      { key: 'name', label: 'Campaña' },
                      { key: 'advertiserName', label: 'Anunciante' },
                      { key: 'objective', label: 'Objetivo' },
                      { key: 'gastado', label: 'Gastado' },
                      { key: 'presupuesto', label: 'Presupuesto' },
                      { key: 'status', label: 'Estado' },
                    ],
                    rows.map((fila) => ({
                      ...fila,
                      gastado: formatBob(micros(fila.spendTotalMicros)),
                      presupuesto: formatBob(micros(fila.budgetTotalMicros)),
                    })),
                  ),
                },
              ],
            })}
          />
        }
      />

      {/*
        * El negocio es el que inició sesión: aquí no se elige comercio, y sin nada que elegir la
        * barra de filtros no se pinta —era una caja vacía encima de la lista—.
        */}
      {scope.requiresSelection || eligeAnunciante ? (
        <Panel compact>
          <div className="flex flex-col gap-3 sm:flex-row">
            {/* Sólo a quien administra VARIOS negocios propios se le pregunta con cuál sigue. */}
            {scope.requiresSelection ? (
              <FormField kind="select" label="Negocio" name="merchantAccountId" className="max-w-md flex-1" value={accountId ?? ''} onChange={(e) => { scope.setAccountId(e.target.value); setAdvertiserId(''); }} hint="Administras varios negocios: elige de cuál quieres ver las campañas." options={[{ label: '— Elige uno de tus negocios —', value: '' }, ...scope.accountOptions]} />
            ) : null}
            {eligeAnunciante ? (
              <FormField kind="select" label="Anunciante" name="advertiserId" className="max-w-md flex-1" value={advertiserId} onChange={(e) => setAdvertiserId(e.target.value)} options={[{ label: '— Todos los anunciantes —', value: '' }, ...advertiserOptions]} hint="Acceso delegado: está entrando en nombre de otro comercio." />
            ) : null}
          </div>
        </Panel>
      ) : null}

      {scope.error ? <InlineNotice tone="danger" title="No se pudo determinar tu negocio">{scope.error}</InlineNotice> : null}
      {error ? <InlineNotice tone="danger" title="No se pudo completar">{error}</InlineNotice> : null}
      {campaigns.error ? <InlineNotice tone="danger" title="No se pudieron cargar las campañas">{campaigns.error}</InlineNotice> : null}
      {advertisers.error ? <InlineNotice tone="danger" title="No se pudieron cargar los anunciantes">{advertisers.error}</InlineNotice> : null}
      {!clave && ready && advertisers.status !== 'loading' ? (
        <InlineNotice tone="info" title="Todavía no hay anunciantes">
          Este comercio aún no tiene ninguna cuenta de anunciante creada, así que no hay campañas que mostrar. Tu ejecutivo comercial es quien la da de alta.
        </InlineNotice>
      ) : null}

      {clave && !campaigns.error ? (
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((campaign) => {
            const id = String(campaign.id);
            const status = String(campaign.status);
            const toggleable = status === 'ACTIVE' || status === 'PAUSED';
            const spent = micros(campaign.spendTotalMicros);
            const budget = micros(campaign.budgetTotalMicros);
            const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
            return (
              <section key={id} className="flex flex-col rounded-xl border border-slate-200 bg-white/80 backdrop-blur-[2px] p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{String(campaign.name)}</p><p className="text-[10px] uppercase tracking-wide text-slate-500">{variosAnunciantes && campaign.advertiserName ? `${String(campaign.advertiserName)} · ` : ''}{String(campaign.objective ?? '')}</p></div>
                  <StatusPill tone={status === 'ACTIVE' ? 'success' : status === 'PAUSED' ? 'warning' : 'neutral'}>{status}</StatusPill>
                </div>
                <div className="mt-3 text-[11px] text-slate-600">
                  <div className="flex justify-between"><span>Gastado</span><b>{formatBob(spent)}</b></div>
                  <div className="flex justify-between"><span>Presupuesto</span><b>{formatBob(budget)}</b></div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-[#006a61]" style={{ width: `${pct}%` }} /></div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
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
          {!rows.length && campaigns.status !== 'loading' ? <Panel><p className="py-6 text-center text-xs text-slate-500">Todavía no hay campañas creadas. Las crea tu ejecutivo comercial junto con los segmentos.</p></Panel> : null}
        </div>
      ) : null}
    </div>
  );
}
