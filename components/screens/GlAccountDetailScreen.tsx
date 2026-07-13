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
import { recordStatusOptions } from '@/lib/catalogs';
import type { JsonObject, ResourceRow } from '@/services/types';

const boolOptions = [
  { label: 'No', value: 'false' },
  { label: 'Sí', value: 'true' },
];

const flagFields = [
  { key: 'isControlAccount', label: 'Cuenta de control' },
  { key: 'requiresCostCenter', label: 'Requiere centro de costo' },
  { key: 'requiresProfitCenter', label: 'Requiere centro de beneficio' },
  { key: 'requiresPartner', label: 'Requiere partner' },
  { key: 'requiresTaxCode', label: 'Requiere código de impuesto' },
] as const;

interface EditState {
  name: string;
  status: string;
  isControlAccount: string;
  requiresCostCenter: string;
  requiresProfitCenter: string;
  requiresPartner: string;
  requiresTaxCode: string;
}

function toEditState(account: ResourceRow): EditState {
  return {
    name: String(account.name ?? ''),
    status: String(account.status ?? 'ACTIVE'),
    isControlAccount: String(Boolean(account.isControlAccount)),
    requiresCostCenter: String(Boolean(account.requiresCostCenter)),
    requiresProfitCenter: String(Boolean(account.requiresProfitCenter)),
    requiresPartner: String(Boolean(account.requiresPartner)),
    requiresTaxCode: String(Boolean(account.requiresTaxCode)),
  };
}

export function GlAccountDetailScreen({ initialId = '' }: { initialId?: string }) {
  const requestedId = initialId.trim();
  const load = useCallback(
    () => (requestedId ? accountingService.getGlAccount(requestedId) : Promise.resolve({} as ResourceRow)),
    [requestedId],
  );
  const resource = useAsyncResource(load, Boolean(requestedId));
  const account = useMemo(() => resource.data ?? {}, [resource.data]);
  const mutation = useAtlasMutation((body: JsonObject) => accountingService.updateGlAccount(requestedId, body));

  const [form, setForm] = useState<EditState | null>(null);
  useEffect(() => {
    if (resource.status === 'success' && resource.data) setForm(toEditState(resource.data));
  }, [resource.status, resource.data]);

  const dirty = useMemo(() => form && JSON.stringify(form) !== JSON.stringify(toEditState(account)), [form, account]);

  async function handleSave() {
    if (!form) return;
    const body: JsonObject = {
      name: form.name,
      status: form.status,
      isControlAccount: form.isControlAccount === 'true',
      requiresCostCenter: form.requiresCostCenter === 'true',
      requiresProfitCenter: form.requiresProfitCenter === 'true',
      requiresPartner: form.requiresPartner === 'true',
      requiresTaxCode: form.requiresTaxCode === 'true',
    };
    try {
      await mutation.execute(body);
      await resource.reload();
    } catch {
      /* mutation.error ya expone el mensaje */
    }
  }

  const accountNo = String(account.accountNo ?? '—');
  const name = String(account.name ?? 'Detalle de cuenta GL');

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[
          { label: 'Contabilidad' },
          { label: 'Cuentas GL', href: '/operaciones/contabilidad/cuentas-gl' },
          { label: accountNo },
        ]}
        title={name}
        description="Detalle de la cuenta contable, dimensiones obligatorias y estado dentro del plan de cuentas."
        actions={
          <Link href="/operaciones/contabilidad/cuentas-gl">
            <AtlasButton variant="secondary" icon="arrow_back">Volver al directorio</AtlasButton>
          </Link>
        }
      />

      {!requestedId ? <InlineNotice tone="info" title="Seleccione una cuenta">Abra el detalle desde el directorio de cuentas GL.</InlineNotice> : null}
      {resource.error ? <InlineNotice tone="danger" title="No se pudo cargar la cuenta">{resource.error}</InlineNotice> : null}

      {requestedId && !resource.error ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Número de cuenta" value={<span className="font-mono">{accountNo}</span>} detail="Inmutable" icon="tag" />
            <MetricCard label="Clasificación" value={String(account.accountType ?? '—')} detail="Tipo contable" icon="account_tree" tone="teal" />
            <MetricCard label="Naturaleza" value={account.normalBalance === 'D' ? 'Débito' : account.normalBalance === 'C' ? 'Crédito' : '—'} detail="Saldo normal" icon="swap_vert" tone="amber" />
            <MetricCard label="Estado" value={<StatusPill tone={String(account.status) === 'ACTIVE' ? 'success' : 'neutral'}>{String(account.status ?? '—')}</StatusPill>} detail="Vigencia" icon="verified" tone="purple" />
          </div>

          {mutation.status === 'success' ? <InlineNotice tone="success" title="Cambios guardados">La cuenta se actualizó correctamente.</InlineNotice> : null}
          {mutation.error ? <InlineNotice tone="danger" title="No se pudo guardar">{mutation.error}</InlineNotice> : null}

          <Panel title="Edición de cuenta" description="Los identificadores contables (número, COA, tipo y naturaleza) son inmutables para no afectar partidas ya registradas." icon="edit">
            {form ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <FormField label="Nombre" name="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="md:col-span-2" />
                  <FormField kind="select" label="Estado" name="status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={recordStatusOptions} />
                  {flagFields.map((flag) => (
                    <FormField key={flag.key} kind="select" label={flag.label} name={flag.key} value={form[flag.key]} onChange={(e) => setForm({ ...form, [flag.key]: e.target.value })} options={boolOptions} />
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <AtlasButton icon="save" loading={mutation.isLoading} disabled={!dirty} onClick={handleSave}>Guardar cambios</AtlasButton>
                  <AtlasButton variant="secondary" disabled={!dirty || mutation.isLoading} onClick={() => setForm(toEditState(account))}>Descartar</AtlasButton>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Cargando cuenta…</p>
            )}
          </Panel>

          <Panel title="Datos de referencia" icon="account_tree">
            <dl className="grid gap-x-6 gap-y-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="COA" value={account.coaId} mono />
              <Detail label="Cuenta padre" value={account.parentAccountId} mono />
              <Detail label="Grupo de cuenta" value={account.accountGroupId} mono />
              <Detail label="Tipo" value={account.accountType} />
              <Detail label="Naturaleza" value={account.normalBalance} />
            </dl>
          </Panel>

          <FileAttachmentsPanel ownerType="GL_ACCOUNT" ownerId={requestedId} />
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
