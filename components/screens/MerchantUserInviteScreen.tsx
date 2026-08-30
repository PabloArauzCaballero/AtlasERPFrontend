'use client';

import { useCallback, useState } from 'react';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { FormField } from '@/components/atlas/FormField';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useOptions } from '@/hooks/useOptions';
import { formDataToPayload } from '@/lib/formPayload';
import { b2bService } from '@/services/b2bService';
import { portalService } from '@/services/portalService';
import type { JsonObject, ResourceRow } from '@/services/types';

/**
 * Alta de un usuario del comercio, por el staff de Atlas.
 *
 * Vivía en la pantalla de sucursales DEL PORTAL, que es de la población equivocada: allí sólo
 * entra el comercio —`RequireAuth audience="merchant"` echa al staff a Operaciones—, así que el
 * formulario era inalcanzable para quien podía usarlo y, de paso, obligaba a aquella pantalla a
 * preguntar «¿de qué comercio?» a alguien que sólo tiene uno.
 *
 * Aquí sí hay que elegir comercio, y no es lo mismo: quien mira es personal interno, que atiende a
 * muchos. El endpoint sigue siendo el interno (`/b2b/onboarding/merchant-users`); no hay uno de
 * portal, y no debería haberlo: conceder acceso a un sistema no es una operación autoservicio.
 */
export function MerchantUserInviteScreen() {
  const accountOptions = useOptions(useCallback(async () => {
    const result = await b2bService.listAccounts({ page: 1, limit: 100 });
    const rows = (result.items ?? result.rows ?? []) as ResourceRow[];
    return rows.map((row) => ({ value: String(row.id), label: String(row.tradeName ?? row.legalName ?? 'Comercio') }));
  }, []));

  // Cuenta elegida: define qué sucursales se pueden asignar.
  const [accountId, setAccountId] = useState('');
  const branches = useAsyncResource(
    useCallback(() => (accountId ? portalService.listBranches(accountId) : Promise.resolve([] as ResourceRow[])), [accountId]),
    Boolean(accountId),
  );
  const branchOptions = ((branches.data ?? []) as ResourceRow[]).map((row) => ({ value: String(row.id), label: String(row.name ?? 'Sucursal') }));

  const userMutation = useAtlasMutation(useCallback((body: JsonObject) => b2bService.createMerchantUser(body), []));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      await userMutation.execute(
        formDataToPayload(new FormData(form), [
          { name: 'accountId' },
          { name: 'branchId', optional: true },
          { name: 'email' },
          { name: 'fullName' },
          { name: 'roleCode' },
        ]),
      );
      form.reset();
      setAccountId('');
    } catch { /* shown inline */ }
  }

  return (
    <form onSubmit={submit}>
      <Panel title="Asociar usuario de comercio" description="Concede acceso operativo al personal autorizado del comercio." icon="person_add">
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
          <FormField kind="select" label="Comercio" name="accountId" required className="md:col-span-2" value={accountId} onChange={(e) => setAccountId(e.target.value)} options={[{ label: '— Seleccione —', value: '' }, ...accountOptions]} />
          <FormField kind="select" label="Sucursal" name="branchId" options={[{ label: accountId ? '— Alcance global —' : '— Elija primero el comercio —', value: '' }, ...branchOptions]} hint="Opcional para usuarios con alcance global." />
          <FormField label="Nombre completo" name="fullName" required placeholder="Nombre del responsable" />
          <FormField label="Correo corporativo" name="email" type="email" required placeholder="usuario@empresa.com" />
          <FormField kind="select" label="Rol principal" name="roleCode" required defaultValue="MERCHANT_OPERATOR" options={[{ label: 'Administrador merchant', value: 'MERCHANT_ADMIN' }, { label: 'Gerente de sucursal', value: 'BRANCH_MANAGER' }, { label: 'Operador estándar', value: 'MERCHANT_OPERATOR' }, { label: 'Auditor financiero', value: 'FINANCIAL_AUDITOR' }]} />
        </div>
        {userMutation.error ? <InlineNotice className="mt-4" tone="danger">{userMutation.error}</InlineNotice> : null}
        {userMutation.status === 'success' ? <InlineNotice className="mt-4" tone="success">Usuario merchant asociado correctamente.</InlineNotice> : null}
        <div className="mt-5 flex justify-end">
          <AtlasButton type="submit" icon="person_add" loading={userMutation.isLoading}>Asociar usuario</AtlasButton>
        </div>
      </Panel>
    </form>
  );
}
