'use client';

import { useCallback, useState } from 'react';
import { b2bService } from '@/services/b2bService';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';

const checks = [
  { icon: 'draw', title: 'Digital Signature Status', detail: 'Contrato comercial firmado y vigente.' },
  { icon: 'security', title: 'Identity Validation (KYB)', detail: 'Identidad legal y beneficiarios verificados.' },
  { icon: 'storefront', title: 'Merchant Structure', detail: 'Sucursal principal y usuario corporativo registrados.' },
  { icon: 'account_balance', title: 'Settlement Readiness', detail: 'Política de liquidación y cuenta financiera verificadas.' },
];

export function MerchantActivationScreen() {
  const [caseId, setCaseId] = useState('');
  const mutation = useAtlasMutation(useCallback((id: string) => b2bService.activateOnboarding(id, {}), []));
  async function activate() { try { await mutation.execute(caseId); } catch { /* controlled */ } }
  return (
    <div className="space-y-5">
      <WorkspaceHeader breadcrumbs={[{ label: 'CRM' }, { label: 'Activación' }]} title="Activación del contrato" description="Último control de preparación antes de habilitar al comercio para operar en ATLAS." actions={<><AtlasButton variant="secondary" icon="visibility">Previsualizar contrato</AtlasButton><AtlasButton variant="secondary" icon="download">Exportar auditoría</AtlasButton></>} />
      {mutation.error ? <InlineNotice tone="danger">{mutation.error}</InlineNotice> : null}
      {mutation.status === 'success' ? <InlineNotice tone="success" title="Comercio activado">El caso fue activado por el backend y quedó disponible para operación.</InlineNotice> : null}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <div className="space-y-4">
          <Panel title="Readiness Check" icon="fact_check"><div className="grid gap-3 md:grid-cols-2">{checks.map((check) => <article key={check.title} className="flex gap-3 rounded-md border border-slate-200 p-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Icon name={check.icon} className="text-[19px]" /></span><div><div className="flex items-center gap-2"><h3 className="text-xs font-bold">{check.title}</h3><StatusPill tone="success" dot={false}>Ready</StatusPill></div><p className="mt-1 text-[11px] leading-4 text-slate-500">{check.detail}</p></div></article>)}</div></Panel>
          <Panel title="Activation Audit" icon="history_edu"><div className="grid gap-4 text-xs md:grid-cols-3"><Audit label="Control" value="4/4 validaciones" /><Audit label="Separación" value="Legal + Operaciones" /><Audit label="Registro" value="Business Action Log" /></div></Panel>
        </div>
        <aside className="space-y-4 xl:sticky xl:top-20">
          <Panel title="Account Activated" icon="rocket_launch"><div className="mb-4 rounded-md bg-[#006a61] p-4 text-white"><p className="text-[10px] font-bold uppercase tracking-widest text-white/75">Activation readiness</p><p className="mt-1 text-2xl font-bold">100%</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full w-full bg-emerald-400" /></div></div><FormField label="UUID del caso de onboarding" name="caseId" value={caseId} onChange={(event) => setCaseId(event.target.value)} required /><AtlasButton className="mt-4 w-full" icon="rocket_launch" variant="success" loading={mutation.isLoading} disabled={!caseId} onClick={activate}>Activar comercio</AtlasButton><p className="mt-3 text-[11px] leading-4 text-slate-500">La API volverá a comprobar los requisitos. La interfaz no puede saltarse controles del backend.</p></Panel>
        </aside>
      </div>
    </div>
  );
}
function Audit({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-slate-50 p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-800">{value}</p></div>; }
