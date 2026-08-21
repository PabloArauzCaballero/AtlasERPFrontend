'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { b2bService } from '@/services/b2bService';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { AccountActivitiesPanel } from '@/components/screens/AccountActivitiesPanel';
import { FileAttachmentsPanel } from '@/components/screens/FileAttachmentsPanel';
import { formatBob, maskPii } from '@/lib/formatters';
import type { ResourceRow } from '@/services/types';

export function AccountDetailScreen({ initialId = '' }: { initialId?: string }) {
  const [accountId, setAccountId] = useState(initialId);
  const [requestedId, setRequestedId] = useState(initialId);
  const load = useCallback(() => requestedId ? b2bService.getAccount(requestedId) : Promise.resolve({} as ResourceRow), [requestedId]);
  const resource = useAsyncResource(load, Boolean(requestedId));
  const account = resource.data ?? {};
  const name = String(account.tradeName ?? account.legalName ?? 'Detalle de cuenta');

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'CRM', href: '/operaciones/crm/cuentas' }, { label: name }]}
        title={name}
        description="Vista 360° de identidad comercial, contactos, volumen esperado, riesgo y actividad institucional."
        actions={<><AtlasButton variant="secondary" icon="file_download">Exportar dossier</AtlasButton><Link href={`/operaciones/crm/cuentas/calificar?accountId=${requestedId}`}><AtlasButton icon="verified">Calificar cuenta</AtlasButton></Link></>}
      />

      <Panel compact>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <FormField label="UUID de cuenta" name="accountLookup" value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder="00000000-0000-4000-8000-000000000000" className="flex-1" />
          <AtlasButton icon="search" loading={resource.status === 'loading'} onClick={() => setRequestedId(accountId.trim())}>Consultar cuenta</AtlasButton>
        </div>
      </Panel>

      {resource.error ? <InlineNotice tone="danger" title="No se pudo consultar la cuenta">{resource.error}</InlineNotice> : null}
      {!requestedId ? <InlineNotice tone="info" title="Seleccione una cuenta">Abra el detalle desde el directorio o introduzca un UUID válido.</InlineNotice> : null}

      {requestedId && !resource.error ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Estado comercial" value={<StatusPill tone="success">{String(account.lifecycleStatus ?? 'CARGANDO')}</StatusPill>} detail="Ciclo de vida de la cuenta" icon="domain" />
            <MetricCard label="Volumen mensual" value={formatBob(Number(account.expectedMonthlyVolume ?? 0))} detail="Proyección declarada" icon="payments" tone="teal" />
            <MetricCard label="Nivel de riesgo" value={String(account.riskTier ?? 'SIN CLASIFICAR')} detail="Sujeto a validación" icon="shield" tone="amber" />
            <MetricCard label="Industria" value={String(account.industry ?? '—')} detail="Segmentación comercial" icon="category" tone="purple" />
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,.7fr)]">
            <div className="space-y-4">
              <Panel title="Resumen de la cuenta" icon="corporate_fare">
                <dl className="grid gap-x-6 gap-y-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
                  <Detail label="Razón social" value={account.legalName} />
                  <Detail label="Nombre comercial" value={account.tradeName} />
                  <Detail label="NIT" value={maskPii(account.taxId, 'taxId')} mono />
                  <Detail label="Tipo de cuenta" value={account.accountType} />
                  <Detail label="Categoría" value={account.category} />
                  <Detail label="Rubro" value={account.businessLine} />
                  <Detail label="País / ciudad" value={[account.countryCode, account.city].filter(Boolean).join(' · ')} />
                  <Detail label="Dirección" value={account.address} />
                  <Detail label="Sitio web" value={account.websiteUrl} />
                  <Detail label="Empleados" value={account.employeeCount} />
                  <Detail label="Año de fundación" value={account.foundedYear} />
                  <Detail label="Facturación anual" value={account.annualRevenue ? formatBob(Number(account.annualRevenue)) : '—'} />
                  <Detail label="Tags" value={Array.isArray(account.tags) ? account.tags.join(', ') : '—'} />
                  <Detail label="Responsable" value={account.ownerUserId} mono />
                  <Detail label="Territorio" value={account.territoryId} mono />
                </dl>
              </Panel>
              <Panel title="Contacts List" description="Contactos asociados devueltos por el agregado de cuenta" icon="groups">
                <ContactList contacts={Array.isArray(account.contacts) ? account.contacts : []} />
              </Panel>
            </div>
            <aside className="space-y-4">
              <Panel title="Acciones rápidas" icon="bolt">
                <div className="space-y-2">
                  <Quick href={`/operaciones/crm/cuentas/calificar?accountId=${requestedId}`} icon="verified" title="Calificar cuenta" detail="Ejecutar evaluación comercial" />
                  <Quick href="/operaciones/crm/oportunidades" icon="handshake" title="Crear oportunidad" detail="Iniciar nuevo negocio" />
                  <Quick href="/operaciones/crm/onboarding" icon="fact_check" title="Iniciar onboarding" detail="Preparar activación del comercio" />
                </div>
              </Panel>
              <Panel title="Historial de acciones" icon="history_edu">
                <div className="space-y-4 text-xs"><Timeline label="Consulta de expediente" detail="La información visible proviene del backend actual." /><Timeline label="Trazabilidad protegida" detail="Las mutaciones generan Business Action Logs." /><Timeline label="PII enmascarada" detail="NIT, teléfono y correo se presentan parcialmente." /></div>
              </Panel>
            </aside>
          </div>

          <AccountActivitiesPanel accountId={requestedId} />
          <FileAttachmentsPanel ownerType="B2B_ACCOUNT" ownerId={requestedId} title="Documentos de la cuenta" />
        </>
      ) : null}
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: unknown; mono?: boolean }) {
  return <div><dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className={`mt-1 break-words font-semibold text-slate-800 ${mono ? 'font-mono text-[11px]' : ''}`}>{String(value ?? '—')}</dd></div>;
}
function ContactList({ contacts }: { contacts: unknown[] }) {
  if (!contacts.length) return <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center"><Icon name="contact_page" className="text-[30px] text-slate-400" /><p className="mt-2 text-xs font-bold text-slate-700">Sin contactos asociados</p></div>;
  return <div className="space-y-2">{contacts.map((value, index) => { const contact = value as ResourceRow; return <article key={String(contact.id ?? index)} className="grid items-center gap-2 rounded-md border border-slate-200 p-3 text-xs sm:grid-cols-[1fr_1fr_auto]"><div><b className="block text-slate-800">{String(contact.fullName ?? '—')}</b><span className="text-slate-500">{String(contact.roleTitle ?? contact.decisionRole ?? 'Sin cargo')}</span></div><div className="text-slate-600"><span className="block">{maskPii(contact.email, 'email')}</span><span>{maskPii(contact.phone, 'phone')}</span></div><StatusPill tone={contact.isPrimary ? 'success' : 'neutral'}>{contact.isPrimary ? 'Principal' : String(contact.status ?? 'Activo')}</StatusPill></article>; })}</div>;
}
function Quick({ href, icon, title, detail }: { href: string; icon: string; title: string; detail: string }) {
  return <Link href={href} className="flex items-center gap-3 rounded-md border border-slate-200 p-3 hover:border-slate-300 hover:bg-slate-50"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-blue-50 text-[#006a61]"><Icon name={icon} className="text-[18px]" /></span><span className="min-w-0 flex-1"><b className="block text-xs">{title}</b><span className="block truncate text-[11px] text-slate-500">{detail}</span></span><Icon name="chevron_right" className="text-[17px] text-slate-500" /></Link>;
}
function Timeline({ label, detail }: { label: string; detail: string }) {
  return <div className="flex gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-teal-500 ring-4 ring-teal-50" /><div><b>{label}</b><p className="mt-0.5 text-[11px] leading-4 text-slate-500">{detail}</p></div></div>;
}
