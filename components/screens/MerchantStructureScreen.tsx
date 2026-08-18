'use client';

import { useCallback, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useMerchantScope } from '@/hooks/useMerchantScope';
import { useOptions } from '@/hooks/useOptions';
import { formDataToPayload } from '@/lib/formPayload';
import { b2bService } from '@/services/b2bService';
import { portalService } from '@/services/portalService';
import type { JsonObject, ResourceRow } from '@/services/types';

export function MerchantStructureScreen() {
  const branchMutation = useAtlasMutation(useCallback((body: JsonObject) => b2bService.createBranch(body), []));
  const userMutation = useAtlasMutation(useCallback((body: JsonObject) => b2bService.createMerchantUser(body), []));

  const accountOptions = useOptions(useCallback(async () => {
    const result = await b2bService.listAccounts({ page: 1, limit: 100 });
    const rows = (result.items ?? result.rows ?? []) as ResourceRow[];
    return rows.map((row) => ({ value: String(row.id), label: String(row.tradeName ?? row.legalName ?? 'Comercio') }));
  }, []));

  // Cuenta seleccionada en el formulario de usuario: define qué sucursales se pueden elegir.
  const [userAccountId, setUserAccountId] = useState('');
  const userBranches = useAsyncResource(
    useCallback(() => (userAccountId ? portalService.listBranches(userAccountId) : Promise.resolve([] as ResourceRow[])), [userAccountId]),
    Boolean(userAccountId),
  );
  const userBranchOptions = ((userBranches.data ?? []) as ResourceRow[]).map((b) => ({ value: String(b.id), label: String(b.name ?? 'Sucursal') }));

  const scope = useMerchantScope();
  const { accountId: queryAccountId, ready } = scope;
  const branches = useAsyncResource(
    useCallback(() => (ready ? portalService.listBranches(queryAccountId) : Promise.resolve([] as ResourceRow[])), [queryAccountId, ready]),
    ready,
  );
  const branchRows = (branches.data ?? []) as ResourceRow[];

  async function submitBranch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await branchMutation.execute(formDataToPayload(new FormData(event.currentTarget), [{ name: 'accountId' }, { name: 'name' }, { name: 'city' }, { name: 'address', optional: true }])); event.currentTarget.reset(); if (queryAccountId) await branches.reload(); } catch { /* shown inline */ }
  }

  async function submitUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await userMutation.execute(formDataToPayload(new FormData(event.currentTarget), [{ name: 'accountId' }, { name: 'branchId', optional: true }, { name: 'email' }, { name: 'fullName' }, { name: 'roleCode' }])); event.currentTarget.reset(); setUserAccountId(''); } catch { /* shown inline */ }
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader breadcrumbs={[{ label: 'Portal comercio' }, { label: 'Sucursales' }]} title="Sucursales del comercio" description="Configure ubicaciones físicas y otorgue acceso al personal del comercio sin mezclar permisos administrativos." />
      {/* Alta de sucursales y de usuarios son operaciones INTERNAS (`/b2b/*`): el comercio no
          tiene permiso sobre ellas, así que no se le pintan formularios que sólo darían 403. */}
      <div className={`grid gap-5 xl:grid-cols-2 ${scope.isMerchant ? 'hidden' : ''}`}>
        <form onSubmit={submitBranch}><Panel title="Agregar sucursal" description="Registre una nueva ubicación comercial vinculada a la cuenta merchant." icon="add_location"><div className="grid gap-3 md:grid-cols-2"><FormField kind="select" label="Comercio" name="accountId" required className="md:col-span-2" options={[{ label: '— Seleccione —', value: '' }, ...accountOptions]} /><FormField label="Nombre de sucursal" name="name" required placeholder="Sucursal Norte" /><FormField label="Ciudad" name="city" required placeholder="Santa Cruz de la Sierra" /><FormField label="Dirección" name="address" className="md:col-span-2" placeholder="Av. principal, zona y referencia" /></div>{branchMutation.error ? <InlineNotice className="mt-4" tone="danger">{branchMutation.error}</InlineNotice> : null}{branchMutation.status === 'success' ? <InlineNotice className="mt-4" tone="success">Sucursal registrada correctamente.</InlineNotice> : null}<div className="mt-5 flex justify-end"><AtlasButton type="submit" icon="add_location" loading={branchMutation.isLoading}>Registrar sucursal</AtlasButton></div></Panel></form>
        <form onSubmit={submitUser}><Panel title="Asociar usuario" description="Conceda acceso operativo al personal autorizado del comercio." icon="person_add"><div className="grid gap-3 md:grid-cols-2"><FormField kind="select" label="Comercio" name="accountId" required className="md:col-span-2" value={userAccountId} onChange={(e) => setUserAccountId(e.target.value)} options={[{ label: '— Seleccione —', value: '' }, ...accountOptions]} /><FormField kind="select" label="Sucursal" name="branchId" options={[{ label: userAccountId ? '— Alcance global —' : '— Elija primero el comercio —', value: '' }, ...userBranchOptions]} hint="Opcional para usuarios con alcance global." /><FormField label="Nombre completo" name="fullName" required placeholder="Nombre del responsable" /><FormField label="Correo corporativo" name="email" type="email" required placeholder="usuario@empresa.com" /><FormField kind="select" label="Rol principal" name="roleCode" required defaultValue="MERCHANT_OPERATOR" options={[{ label: 'Administrador merchant', value: 'MERCHANT_ADMIN' }, { label: 'Gerente de sucursal', value: 'BRANCH_MANAGER' }, { label: 'Operador estándar', value: 'MERCHANT_OPERATOR' }, { label: 'Auditor financiero', value: 'FINANCIAL_AUDITOR' }]} /></div>{userMutation.error ? <InlineNotice className="mt-4" tone="danger">{userMutation.error}</InlineNotice> : null}{userMutation.status === 'success' ? <InlineNotice className="mt-4" tone="success">Usuario merchant asociado correctamente.</InlineNotice> : null}<div className="mt-5 flex justify-end"><AtlasButton type="submit" icon="person_add" loading={userMutation.isLoading}>Asociar usuario</AtlasButton></div></Panel></form>
      </div>

      <Panel title="Sucursales registradas" description="Listado de sucursales del comercio seleccionado." icon="storefront" action={<AtlasButton variant="secondary" icon="refresh" loading={branches.status === 'loading'} disabled={!ready} onClick={branches.reload}>Actualizar</AtlasButton>}>
        {scope.isMerchant ? null : (
          <div className="mb-3 max-w-md">
            <FormField kind="select" label="Comercio a consultar" name="queryAccountId" value={queryAccountId ?? ''} onChange={(e) => scope.setAccountId(e.target.value)} options={[{ label: '— Seleccione un comercio —', value: '' }, ...accountOptions]} />
          </div>
        )}
        {branches.error ? <InlineNotice tone="danger" title="No se pudo consultar">{branches.error}</InlineNotice> : null}
        {!ready ? (
          <p className="py-6 text-center text-xs text-slate-500">Seleccione un comercio para ver sus sucursales.</p>
        ) : branchRows.length ? (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-2.5">Sucursal</th><th className="p-2.5">Ciudad</th><th className="p-2.5">Dirección</th><th className="p-2.5">BNPL</th><th className="p-2.5">Estado</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {branchRows.map((branch) => (
                  <tr key={String(branch.id)}>
                    <td className="p-2.5 font-semibold text-slate-800">{String(branch.name ?? '—')}</td>
                    <td className="p-2.5 text-slate-600">{String(branch.city ?? '—')}</td>
                    <td className="p-2.5 text-slate-600">{String(branch.address ?? '—')}</td>
                    <td className="p-2.5">{branch.canOriginateBnpl ? <StatusPill tone="success" dot={false}>Sí</StatusPill> : <StatusPill tone="neutral" dot={false}>No</StatusPill>}</td>
                    <td className="p-2.5"><StatusPill tone={String(branch.status) === 'ACTIVE' ? 'success' : 'warning'}>{String(branch.status ?? '—')}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : branches.status !== 'loading' ? (
          <div className="grid min-h-32 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><div><Icon name="inventory_2" className="text-[30px] text-slate-300" /><p className="mt-2 text-xs font-bold text-slate-600">Este comercio aún no tiene sucursales registradas.</p></div></div>
        ) : null}
      </Panel>
    </div>
  );
}
