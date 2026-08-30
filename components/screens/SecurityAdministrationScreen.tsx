'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { AtlasButton } from '@/components/atlas/AtlasButton';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { MetricCard } from '@/components/atlas/MetricCard';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { useAtlasMutation } from '@/hooks/useAtlasMutation';
import { useAuth } from '@/lib/authContext';
import { ActionFormModal } from '@/components/screens/ActionFormModal';
import { authService } from '@/services/authService';
import type { InternalUserProfile, InternalUserStatus } from '@/services/authTypes';

const statusTone: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  active: 'success',
  invited: 'warning',
  suspended: 'danger',
  locked: 'danger',
  disabled: 'neutral',
};

const nextStatus: Record<string, InternalUserStatus> = { active: 'suspended', suspended: 'active', locked: 'active' };

function policyItems(): string[] {
  return ['MFA obligatorio para roles privilegiados', 'Sesiones con expiración y revocación', 'Separación de funciones críticas', 'Auditoría de cambios de permisos'];
}

export function SecurityAdministrationScreen() {
  const { user: currentUser, hasPermission } = useAuth();
  const loadUsers = useCallback(() => authService.listUsers(), []);
  const usersResource = useAsyncResource(loadUsers);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [statusChange, setStatusChange] = useState<{ row: InternalUserProfile; target: InternalUserStatus } | null>(null);
  /*
   * Cambiar los roles de una persona: `PATCH /auth/users/:id/roles` existía con su método en el
   * servicio y ninguna pantalla lo llamaba. El directorio enseñaba los roles y no había forma de
   * corregirlos, así que un alta con el rol equivocado se quedaba así —o se arreglaba por API—.
   */
  const [rolesChange, setRolesChange] = useState<InternalUserProfile | null>(null);
  const rolesCatalog = useAsyncResource(useCallback(() => authService.listRoles(), []));
  const canManage = hasPermission('internal.users.manage');

  const mutation = useAtlasMutation((input: { internalUserId: string; status: InternalUserStatus; reason: string }) =>
    authService.updateUser(input.internalUserId, { status: input.status, reason: input.reason }),
  );

  const users = useMemo<InternalUserProfile[]>(() => usersResource.data?.items ?? [], [usersResource.data]);
  const activeCount = users.filter((row) => row.status === 'active').length;
  const suspendedCount = users.filter((row) => row.status === 'suspended' || row.status === 'locked').length;
  const mfaCount = users.filter((row) => row.mfaEnabled).length;

  /**
   * Retirar o devolver el acceso de una persona exige motivo. Se pedía con
   * `window.prompt` y se descartaba en silencio si el texto era corto: quien
   * escribía «baja» veía cerrarse la caja y no pasaba nada, sin explicación.
   * El diálogo de la aplicación no deja confirmar hasta que hay motivo, y dice
   * cuál es el mínimo antes de escribirlo.
   */
  async function applyStatusChange(row: InternalUserProfile, target: InternalUserStatus, reason: string) {
    setPendingUserId(row.id);
    try {
      await mutation.execute({ internalUserId: row.id, status: target, reason: reason.trim() });
      await usersResource.reload();
    } finally {
      setPendingUserId(null);
    }
  }

  function toggleStatus(row: InternalUserProfile) {
    const target = nextStatus[row.status];
    if (!target) return;
    setStatusChange({ row, target });
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Administración' }, { label: 'Seguridad' }]}
        title="Usuarios internos"
        description="Directorio real de usuarios internos, roles y estado de acceso (internal_users / internal_roles)."
        actions={
          <>
            <Link href="/operaciones/admin/roles"><AtlasButton variant="secondary" icon="admin_panel_settings">Roles & permisos</AtlasButton></Link>
            <AtlasButton icon="refresh" variant="secondary" loading={usersResource.status === 'loading'} onClick={usersResource.reload}>Actualizar</AtlasButton>
          </>
        }
      />

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Users" value={users.length || '—'} detail="internal_users (tenant actual)" icon="group" />
        <MetricCard label="Active Users" value={activeCount || '—'} detail="Estado activo" icon="public" tone="teal" />
        <MetricCard label="Suspended / Locked" value={suspendedCount} detail="Requieren revisión" icon="gpp_maybe" tone="amber" />
        <MetricCard label="MFA Enabled" value={mfaCount} detail="De los usuarios listados" icon="verified_user" tone="purple" />
      </div>

      <div className="grid gap-4 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1.5fr)_360px]">
        <Panel title="Personal de Atlas" description="Usuario, rol, estado y MFA — datos en vivo desde /internal/users." icon="manage_accounts">
          {usersResource.error && !users.length ? (
            <InlineNotice tone="danger" title="No se pudo cargar el directorio">{usersResource.error}</InlineNotice>
          ) : (
            <div className="overflow-hidden rounded-md border border-slate-200">
              <div className="grid grid-cols-[2fr_1.4fr_1fr_0.7fr_100px] bg-slate-50 px-4 py-3 text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                <span>Usuario</span><span>Roles</span><span>Estado</span><span>MFA</span><span />
              </div>
              {users.length === 0 && usersResource.status !== 'loading' ? (
                <div className="grid min-h-56 place-items-center p-8 text-center">
                  <div>
                    <Icon name="person_search" className="text-[34px] text-slate-400" />
                    <p className="mt-2 text-xs font-bold text-slate-600">Sin usuarios internos en este tenant</p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {users.map((row) => (
                    <div key={row.id} className="grid grid-cols-[2fr_1.4fr_1fr_0.7fr_100px] items-center px-4 py-3 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-800">{row.fullName}{row.id === currentUser?.id ? ' (tú)' : ''}</p>
                        <p className="truncate text-[11px] text-slate-500">{row.email}</p>
                      </div>
                      <span className="truncate text-slate-600">{row.roles.join(', ') || '—'}</span>
                      <span><StatusPill tone={statusTone[row.status] ?? 'neutral'}>{row.status}</StatusPill></span>
                      <span>{row.mfaEnabled ? <Icon name="check_circle" className="text-[18px] text-emerald-600" /> : <Icon name="remove_circle" className="text-[18px] text-slate-500" />}</span>
                      <span className="text-right">
                        {canManage ? (
                          <AtlasButton
                            variant="secondary"
                            className="mr-1 h-7 px-2 text-[10px]"
                            onClick={() => setRolesChange(row)}
                          >
                            Roles
                          </AtlasButton>
                        ) : null}
                        {canManage && row.id !== currentUser?.id && nextStatus[row.status] ? (
                          <AtlasButton
                            variant="secondary"
                            className="h-7 px-2 text-[10px]"
                            loading={pendingUserId === row.id}
                            onClick={() => toggleStatus(row)}
                          >
                            {row.status === 'active' ? 'Suspender' : 'Reactivar'}
                          </AtlasButton>
                        ) : null}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Panel>
        <div className="space-y-4">
          <Panel title="Seguridad global" icon="shield">
            <div className="space-y-3">
              {policyItems().map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs">
                  <Icon name="check_circle" className="text-[17px] text-emerald-600" />
                  <span className="leading-5 text-slate-600">{item}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Estado del contrato" icon="api">
            <StatusPill tone="success">CONECTADO</StatusPill>
            <p className="mt-3 text-xs leading-5 text-slate-600">GET/PATCH /internal/users y /internal/users/:id/roles (AtlasBackend, módulo internal-users).</p>
          </Panel>
        </div>
      </div>
      {!canManage ? <InlineNotice tone="info">Tu usuario no tiene el permiso internal.users.manage: puedes ver el directorio, pero no suspender/reactivar cuentas.</InlineNotice> : null}
      {mutation.error ? <InlineNotice tone="danger">{mutation.error}</InlineNotice> : null}
      {rolesChange ? (
        <ActionFormModal
          open
          icon="admin_panel_settings"
          title={`Roles de ${rolesChange.fullName}`}
          description="Los roles se REEMPLAZAN por los que se elijan: lo que no se marque, se retira. El motivo queda en la auditoría porque un cambio de permisos es lo primero que se revisa tras un incidente."
          submitLabel="Reemplazar roles"
          fields={[
            {
              name: 'roles',
              label: 'Roles',
              type: 'chips',
              required: true,
              span: 2,
              defaultValue: rolesChange.roles.join(', '),
              hint: `Disponibles: ${(rolesCatalog.data?.items ?? []).map((role) => role.code).join(', ') || 'cargando…'}`,
            },
            { name: 'reason', label: 'Motivo', required: true, span: 2, placeholder: 'Cambio de puesto, rotación de equipo…' },
          ]}
          onClose={() => setRolesChange(null)}
          onSubmit={async (payload) => {
            const roles = Array.isArray(payload.roles)
              ? (payload.roles as string[])
              : String(payload.roles ?? '').split(',').map((item) => item.trim()).filter(Boolean);
            await authService.replaceUserRoles(rolesChange.id, { roles, reason: String(payload.reason ?? '') });
            setRolesChange(null);
            await usersResource.reload();
          }}
        />
      ) : null}
      {statusChange ? (
        <ConfirmDialog
          title={statusChange.target === 'suspended' ? 'Suspender el acceso' : 'Reactivar el acceso'}
          body={
            statusChange.target === 'suspended'
              ? `${statusChange.row.fullName} dejará de poder entrar a la consola. Su historial se conserva: lo que se retira es el acceso, no lo que hizo.`
              : `${statusChange.row.fullName} volverá a poder entrar a la consola con los roles que ya tenía.`
          }
          confirmLabel={statusChange.target === 'suspended' ? 'Suspender' : 'Reactivar'}
          tone={statusChange.target === 'suspended' ? 'danger' : 'primary'}
          reasonLabel="Motivo"
          reasonPlaceholder="Baja del equipo, rotación de puesto, incidente de seguridad..."
          minReasonLength={8}
          onConfirm={(reason) => {
            const pending = statusChange;
            setStatusChange(null);
            void applyStatusChange(pending.row, pending.target, reason);
          }}
          onCancel={() => setStatusChange(null)}
        />
      ) : null}
    </div>
  );
}
