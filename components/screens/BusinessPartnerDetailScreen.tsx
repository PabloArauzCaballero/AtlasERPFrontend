'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { accountingService } from '@/services/accountingService';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { FileAttachmentsPanel } from '@/components/screens/FileAttachmentsPanel';
import { PartnerDefaultAccountsPanel } from '@/components/screens/PartnerDefaultAccountsPanel';
import { countryOptions, kybStatusOptions, recordStatusOptions } from '@/lib/catalogs';
import { maskPii } from '@/lib/formatters';
import type { JsonObject, ResourceRow } from '@/services/types';

interface EditState {
  legalName: string;
  tradeName: string;
  taxId: string;
  countryCode: string;
  kybStatus: string;
  status: string;
}

function toEditState(partner: ResourceRow): EditState {
  return {
    legalName: String(partner.legalName ?? ''),
    tradeName: String(partner.tradeName ?? ''),
    taxId: String(partner.taxId ?? ''),
    countryCode: String(partner.countryCode ?? 'BO'),
    kybStatus: String(partner.kybStatus ?? 'PENDING'),
    status: String(partner.status ?? 'ACTIVE'),
  };
}

function kybTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'PENDING' || status === 'IN_REVIEW') return 'warning';
  return 'neutral';
}

export function BusinessPartnerDetailScreen({ initialId = '' }: { initialId?: string }) {
  const requestedId = initialId.trim();
  const load = useCallback(
    () => (requestedId ? accountingService.getBusinessPartner(requestedId) : Promise.resolve({} as ResourceRow)),
    [requestedId],
  );
  const resource = useAsyncResource(load, Boolean(requestedId));
  const partner = useMemo(() => resource.data ?? {}, [resource.data]);
  const mutation = useAtlasMutation((body: JsonObject) => accountingService.updateBusinessPartner(requestedId, body));

  const [form, setForm] = useState<EditState | null>(null);
  useEffect(() => {
    if (resource.status === 'success' && resource.data) setForm(toEditState(resource.data));
  }, [resource.status, resource.data]);

  const dirty = useMemo(() => form && JSON.stringify(form) !== JSON.stringify(toEditState(partner)), [form, partner]);

  async function handleSave() {
    if (!form) return;
    const body: JsonObject = {
      legalName: form.legalName,
      tradeName: form.tradeName || null,
      taxId: form.taxId || null,
      countryCode: form.countryCode,
      kybStatus: form.kybStatus,
      status: form.status,
    };
    try {
      await mutation.execute(body);
      await resource.reload();
    } catch {
      /* mutation.error ya expone el mensaje */
    }
  }

  const partnerNo = String(partner.partnerNo ?? '—');
  const name = String(partner.tradeName ?? partner.legalName ?? 'Detalle de partner');

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[
          { label: 'Contabilidad' },
          { label: 'Business Partners', href: '/operaciones/contabilidad/business-partners' },
          { label: partnerNo },
        ]}
        title={name}
        description="Ficha del business partner, identidad legal y estado KYB dentro del maestro financiero."
        actions={
          <Link href="/operaciones/contabilidad/business-partners">
            <AtlasButton variant="secondary" icon="arrow_back">Volver al directorio</AtlasButton>
          </Link>
        }
      />

      {!requestedId ? <InlineNotice tone="info" title="Seleccione un partner">Abra el detalle desde el directorio de business partners.</InlineNotice> : null}
      {resource.error ? <InlineNotice tone="danger" title="No se pudo cargar el partner">{resource.error}</InlineNotice> : null}

      {requestedId && !resource.error ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Código" value={<span className="font-mono">{partnerNo}</span>} detail="Inmutable" icon="tag" />
            <MetricCard label="Tipo" value={String(partner.partnerType ?? '—')} detail="Naturaleza del partner" icon="handshake" tone="teal" />
            <MetricCard label="KYB" value={<StatusPill tone={kybTone(String(partner.kybStatus))}>{String(partner.kybStatus ?? '—')}</StatusPill>} detail="Cumplimiento" icon="policy" tone="amber" />
            <MetricCard label="Estado" value={<StatusPill tone={String(partner.status) === 'ACTIVE' ? 'success' : 'neutral'}>{String(partner.status ?? '—')}</StatusPill>} detail="Vigencia" icon="verified" tone="purple" />
          </div>

          {mutation.status === 'success' ? <InlineNotice tone="success" title="Cambios guardados">El partner se actualizó correctamente.</InlineNotice> : null}
          {mutation.error ? <InlineNotice tone="danger" title="No se pudo guardar">{mutation.error}</InlineNotice> : null}

          <Panel title="Edición de partner" description="El código y el tipo de partner son inmutables. El NIT se muestra enmascarado pero se edita en claro." icon="edit">
            {form ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <FormField label="Razón social" name="legalName" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} className="md:col-span-2" />
                  <FormField label="Nombre comercial" name="tradeName" value={form.tradeName} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} />
                  <FormField label="NIT / documento" name="taxId" value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
                  <FormField kind="select" label="País" name="countryCode" value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })} options={countryOptions} />
                  <FormField kind="select" label="Estado KYB" name="kybStatus" value={form.kybStatus} onChange={(e) => setForm({ ...form, kybStatus: e.target.value })} options={kybStatusOptions} />
                  <FormField kind="select" label="Estado" name="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={recordStatusOptions} />
                </div>
                <div className="flex items-center gap-3">
                  <AtlasButton icon="save" loading={mutation.isLoading} disabled={!dirty} onClick={handleSave}>Guardar cambios</AtlasButton>
                  <AtlasButton variant="secondary" disabled={!dirty || mutation.isLoading} onClick={() => setForm(toEditState(partner))}>Descartar</AtlasButton>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Cargando partner…</p>
            )}
          </Panel>

          <Panel title="Identidad" icon="badge">
            <dl className="grid gap-x-6 gap-y-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="Razón social" value={partner.legalName} />
              <Detail label="Nombre comercial" value={partner.tradeName} />
              <Detail label="NIT" value={maskPii(partner.taxId, 'taxId')} mono />
              <Detail label="País" value={partner.countryCode} />
            </dl>
          </Panel>

          <PartnerDefaultAccountsPanel partnerId={requestedId} />

          <FileAttachmentsPanel ownerType="BUSINESS_PARTNER" ownerId={requestedId} title="Documentos KYB / respaldo" />
        </>
      ) : null}
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: unknown; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 break-words font-semibold text-slate-800 ${mono ? 'font-mono text-[11px]' : ''}`}>{String(value ?? '—')}</dd>
    </div>
  );
}
