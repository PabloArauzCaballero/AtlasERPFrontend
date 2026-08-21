'use client';

import { useCallback, useEffect, useState } from 'react';
import { accountingService } from '@/services/accountingService';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { partnerAccountPurposeOptions, purposeLabel } from '@/lib/catalogs';
import type { ResourceRow } from '@/services/types';

export function PartnerDefaultAccountsPanel({ partnerId }: { partnerId: string }) {
  const load = useCallback(() => accountingService.listPartnerDefaultAccounts(partnerId), [partnerId]);
  const resource = useAsyncResource(load, Boolean(partnerId));
  const rows = (resource.data ?? []) as ResourceRow[];

  // Combina propósitos existentes con el catálogo canónico (para poder asignar los que falten).
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    rows.forEach((row) => { next[String(row.accountPurpose)] = String(row.glAccountId ?? ''); });
    setDrafts(next);
  }, [resource.data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(purpose: string) {
    setSavingKey(purpose);
    setError(null);
    try {
      await accountingService.setPartnerDefaultAccount(partnerId, {
        accountPurpose: purpose,
        glAccountId: drafts[purpose]?.trim() ? drafts[purpose].trim() : null,
      });
      await resource.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la cuenta.');
    } finally {
      setSavingKey(null);
    }
  }

  const existing = new Set(rows.map((row) => String(row.accountPurpose)));
  const allPurposes = [
    ...rows.map((row) => String(row.accountPurpose)),
    ...partnerAccountPurposeOptions.map((option) => option.value).filter((value) => !existing.has(value)),
  ];

  return (
    <Panel title="Cuentas contables por defecto" description="CxC, anticipos, recargos y retenciones. Se auto-provisionan al crear el partner; asigne aquí la cuenta GL real." icon="account_balance">
      {error ? <InlineNotice tone="danger" title="Error">{error}</InlineNotice> : null}
      {resource.error && !rows.length ? <InlineNotice tone="warning" title="No se pudieron cargar">{resource.error}</InlineNotice> : null}
      <div className="space-y-2">
        {allPurposes.map((purpose) => {
          const assigned = Boolean(drafts[purpose]?.trim());
          return (
            <div key={purpose} className="flex flex-col gap-2 rounded-md border border-slate-200 p-2 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Icon name="link" className="text-[16px] text-slate-500" />
                <span className="text-xs font-semibold text-slate-800">{purposeLabel(purpose)}</span>
                <StatusPill tone={assigned ? 'success' : 'warning'} dot={false}>{assigned ? 'Asignada' : 'Slot'}</StatusPill>
              </div>
              <input
                className="h-9 flex-1 rounded-md border border-slate-300 bg-white px-3 font-mono text-[11px] outline-none focus:border-[#006a61] focus:ring-2 focus:ring-blue-100"
                placeholder="UUID de la cuenta GL"
                value={drafts[purpose] ?? ''}
                onChange={(e) => setDrafts((current) => ({ ...current, [purpose]: e.target.value }))}
              />
              <AtlasButton variant="secondary" icon="save" loading={savingKey === purpose} onClick={() => save(purpose)}>Guardar</AtlasButton>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
