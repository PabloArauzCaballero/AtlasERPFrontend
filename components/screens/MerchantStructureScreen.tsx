'use client';

import { Fragment, useCallback, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { QrCanvas } from '@/components/atlas/QrCanvas';
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
import { partnerOnboardingService, type PartnerOnboardingState } from '@/services/partnerOnboardingService';
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

  /*
   * Editar y dar de baja una sucursal. Antes solo se podian CREAR: una sucursal con la direccion
   * mal escrita se quedaba asi para siempre, y una que cerraba seguia figurando como abierta y
   * habilitada para originar BNPL.
   *
   * No hay borrado a proposito. Una sucursal borrada se lleva por delante el historial de las
   * ventas que origino, y esas cuotas siguen venciendo: lo que se necesita es que deje de operar,
   * no que deje de haber existido.
   */
  const [editando, setEditando] = useState<ResourceRow | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const editMutation = useAtlasMutation(useCallback(({ id, body }: { id: string; body: JsonObject }) => b2bService.updateBranch(id, body), []));
  const statusMutation = useAtlasMutation(useCallback(({ id, body }: { id: string; body: JsonObject }) => b2bService.setBranchStatus(id, body), []));

  async function guardarEdicion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editando) return;
    const form = new FormData(event.currentTarget);
    try {
      await editMutation.execute({
        id: String(editando.id),
        body: {
          name: String(form.get('name') ?? ''),
          city: String(form.get('city') ?? ''),
          address: String(form.get('address') ?? ''),
          canOriginateBnpl: form.get('canOriginateBnpl') === 'true',
        },
      });
      setEditando(null);
      await branches.reload();
    } catch { /* shown inline */ }
  }

  async function cambiarEstado(branch: ResourceRow) {
    const activa = String(branch.status) === 'ACTIVE';
    setOcupada(String(branch.id));
    try {
      await statusMutation.execute({ id: String(branch.id), body: { status: activa ? 'INACTIVE' : 'ACTIVE' } });
      await branches.reload();
    } catch { /* shown inline */ } finally { setOcupada(null); }
  }

  /*
   * El QR que se imprime para una sucursal.
   *
   * Vive en el expediente del comercio (AtlasBackend) y no en el ERP, asi que hay que cruzarlo. El
   * cruce es por `erpBranchId` —el campo con el que el expediente declara a que sucursal del ERP
   * corresponde cada local— y NUNCA por el nombre: dos locales pueden llamarse «Sucursal Centro», y
   * enseñar el QR de la otra tienda manda el cobro a la caja equivocada. Si no hay declaracion, se
   * dice que no la hay.
   */
  const [qrAbierto, setQrAbierto] = useState<string | null>(null);
  const red = useAsyncResource<PartnerOnboardingState | null>(
    useCallback(async () => {
      // `mine` responde sobre la sesion de un COMERCIO. Un usuario interno de Atlas mirando esta
      // pantalla no tiene expediente propio, y preguntarlo solo produciria un error que no
      // significa nada para el.
      if (!scope.isMerchant) return null;
      const propios = await partnerOnboardingService.mine();
      const propio = propios.profiles?.[0];
      if (!propio) return null;
      return partnerOnboardingService.getState(propio.partnerId);
    }, [scope.isMerchant]),
    true,
  );
  const redDatos = red.data ?? null;

  /** Los terminales del local del expediente enlazado con ESTA sucursal del ERP. */
  function terminalesDe(erpBranchId: string) {
    if (!redDatos) return null;
    const local = redDatos.branches.find((branch) => branch.erpBranchId === erpBranchId);
    if (!local) return null;
    return redDatos.posTerminals.filter((pos) => pos.branchId === local.branchId);
  }

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

      {editando ? (
        <form onSubmit={guardarEdicion}>
          <Panel title={`Editar ${String(editando.name ?? 'sucursal')}`} description="La sucursal no cambia de comercio: eso movería sus ventas de cuenta." icon="edit_location">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Nombre de sucursal" name="name" required defaultValue={String(editando.name ?? '')} />
              <FormField label="Ciudad" name="city" required defaultValue={String(editando.city ?? '')} />
              <FormField label="Dirección" name="address" className="md:col-span-2" defaultValue={String(editando.address ?? '')} />
              <FormField kind="select" label="Puede originar BNPL" name="canOriginateBnpl" defaultValue={editando.canOriginateBnpl ? 'true' : 'false'} options={[{ label: 'Sí', value: 'true' }, { label: 'No', value: 'false' }]} hint="Una sucursal dada de baja no origina, aunque esto diga que sí." />
            </div>
            {editMutation.error ? <InlineNotice className="mt-4" tone="danger">{editMutation.error}</InlineNotice> : null}
            <div className="mt-5 flex justify-end gap-2">
              <AtlasButton variant="secondary" type="button" onClick={() => setEditando(null)}>Cancelar</AtlasButton>
              <AtlasButton type="submit" icon="save" loading={editMutation.isLoading}>Guardar cambios</AtlasButton>
            </div>
          </Panel>
        </form>
      ) : null}
      {statusMutation.error ? <InlineNotice tone="danger" title="No se pudo cambiar el estado">{statusMutation.error}</InlineNotice> : null}

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
          <div className="table-scroll rounded-lg border border-slate-200">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500"><tr><th className="p-2.5">Sucursal</th><th className="p-2.5">Ciudad</th><th className="p-2.5">Dirección</th><th className="p-2.5">BNPL</th><th className="p-2.5">Estado</th><th className="p-2.5 text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {branchRows.map((branch) => {
                  const id = String(branch.id);
                  const abierto = qrAbierto === id;
                  const terminales = abierto ? terminalesDe(id) : null;
                  return (
                  <Fragment key={id}>
                  <tr>
                    <td className="p-2.5 font-semibold text-slate-800">{String(branch.name ?? '—')}</td>
                    <td className="p-2.5 text-slate-600">{String(branch.city ?? '—')}</td>
                    <td className="p-2.5 text-slate-600">{String(branch.address ?? '—')}</td>
                    <td className="p-2.5">{branch.canOriginateBnpl ? <StatusPill tone="success" dot={false}>Sí</StatusPill> : <StatusPill tone="neutral" dot={false}>No</StatusPill>}</td>
                    <td className="p-2.5"><StatusPill tone={String(branch.status) === 'ACTIVE' ? 'success' : 'warning'}>{String(branch.status ?? '—')}</StatusPill></td>
                    <td className="p-2.5">
                      <div className="flex justify-end gap-1.5">
                        <AtlasButton variant="secondary" icon="qr_code_2" data-testid={`ver-qr-${id}`} onClick={() => setQrAbierto(abierto ? null : id)}>
                          {abierto ? 'Ocultar QR' : 'Ver QR'}
                        </AtlasButton>
                        <AtlasButton variant="secondary" icon="edit" onClick={() => setEditando(branch)}>Editar</AtlasButton>
                        <AtlasButton variant={String(branch.status) === 'ACTIVE' ? 'danger' : 'success'} icon={String(branch.status) === 'ACTIVE' ? 'block' : 'check'} loading={ocupada === String(branch.id)} onClick={() => void cambiarEstado(branch)}>
                          {String(branch.status) === 'ACTIVE' ? 'Dar de baja' : 'Reactivar'}
                        </AtlasButton>
                      </div>
                    </td>
                  </tr>
                  {abierto ? (
                    <tr>
                      <td colSpan={6} className="bg-slate-50/70 p-3" data-testid={`qr-de-${id}`}>
                        {red.status === 'loading' ? (
                          <p className="text-slate-600">Buscando el QR de esta sucursal…</p>
                        ) : terminales === null ? (
                          <p className="text-slate-600">
                            Esta sucursal no está enlazada con ningún local del expediente, así que no se puede saber
                            cuál es su QR sin arriesgarse a mostrar el de otra tienda. Regístrala en{' '}
                            <strong>Mi empresa</strong> indicando esta sucursal.
                          </p>
                        ) : terminales.length === 0 ? (
                          <p className="text-slate-600">
                            El local existe en el expediente pero todavía no tiene ninguna caja dada de alta, así que
                            no hay QR que imprimir.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-4">
                            {terminales.map((pos) => (
                              <div key={pos.terminalId} className="w-44 space-y-1.5 text-center">
                                <QrCanvas value={pos.terminalSerial} size={176} className="mx-auto" />
                                <p className="font-bold text-slate-800">{pos.terminalAlias ?? pos.terminalSerial}</p>
                                <p className="font-mono text-[11px] text-slate-600">{pos.terminalSerial}</p>
                                <StatusPill tone={pos.status === 'active' ? 'success' : 'warning'}>{pos.status}</StatusPill>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : null}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : branches.status !== 'loading' ? (
          <div className="grid min-h-32 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center"><div><Icon name="inventory_2" className="text-[30px] text-slate-400" /><p className="mt-2 text-xs font-bold text-slate-600">Este comercio aún no tiene sucursales registradas.</p></div></div>
        ) : null}
      </Panel>
    </div>
  );
}
