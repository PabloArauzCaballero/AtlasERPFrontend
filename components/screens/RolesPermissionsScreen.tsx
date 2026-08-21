'use client';

import { useCallback, useMemo, useState } from 'react';
import { Icon } from '@/components/atlas/Icon';
import { InlineNotice } from '@/components/atlas/InlineNotice';
import { Panel } from '@/components/atlas/Panel';
import { StatusPill } from '@/components/atlas/StatusPill';
import { WorkspaceHeader } from '@/components/atlas/WorkspaceHeader';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { authService } from '@/services/authService';
import type { InternalPermissionListItem, InternalRoleListItem } from '@/services/authTypes';

const riskTone: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'danger',
  CRITICAL: 'danger',
};

export function RolesPermissionsScreen() {
  const loadRoles = useCallback(() => authService.listRoles(), []);
  const loadPermissions = useCallback(() => authService.listPermissions(), []);
  const rolesResource = useAsyncResource(loadRoles);
  const permissionsResource = useAsyncResource(loadPermissions);
  const [selectedRoleCode, setSelectedRoleCode] = useState<string | null>(null);

  const roles = useMemo<InternalRoleListItem[]>(() => rolesResource.data?.items ?? [], [rolesResource.data]);
  const permissionCatalog = useMemo<InternalPermissionListItem[]>(() => permissionsResource.data?.items ?? [], [permissionsResource.data]);
  const permissionByCode = useMemo(() => new Map(permissionCatalog.map((permission) => [permission.code, permission])), [permissionCatalog]);

  const selectedRole = roles.find((role) => role.code === selectedRoleCode) ?? roles[0] ?? null;
  const loading = rolesResource.status === 'loading' || permissionsResource.status === 'loading';
  const error = rolesResource.error ?? permissionsResource.error;

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Administración' }, { label: 'Seguridad' }, { label: 'Roles' }]}
        title="Roles & Permissions"
        description="Catálogo real de internal_roles / internal_permissions (AtlasBackend)."
        actions={<StatusPill tone="success">CONECTADO</StatusPill>}
      />

      {error && !roles.length ? <InlineNotice tone="danger" title="No se pudo cargar el catálogo">{error}</InlineNotice> : null}

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Panel title="Role Directory" icon="admin_panel_settings" description={`${roles.length} roles activos`}>
          {loading && !roles.length ? (
            <p className="px-1 py-4 text-xs text-slate-500">Cargando roles…</p>
          ) : (
            <div className="space-y-1">
              {roles.map((role) => (
                <button
                  type="button"
                  key={role.code}
                  onClick={() => setSelectedRoleCode(role.code)}
                  className={`flex w-full items-center justify-between rounded px-3 py-2.5 text-left text-xs ${role.code === selectedRole?.code ? 'bg-[#006a61] text-white' : 'hover:bg-slate-50'}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{role.name}</span>
                    <span className={`block truncate text-[10px] ${role.code === selectedRole?.code ? 'text-blue-200' : 'text-slate-400'}`}>{role.department ?? role.code}</span>
                  </span>
                  <Icon name="chevron_right" className="text-[17px] opacity-60" />
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Permisos del rol"
          description={selectedRole ? `${selectedRole.name} — ${selectedRole.permissions.length} permisos asignados` : 'Selecciona un rol'}
          icon="grid_view"
        >
          {!selectedRole ? (
            <p className="px-1 py-4 text-xs text-slate-500">No hay roles disponibles.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[720px] w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Módulo</th>
                    <th className="p-3">Recurso</th>
                    <th className="p-3">Acción</th>
                    <th className="p-3">Riesgo</th>
                    <th className="p-3">Descripción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedRole.permissions.map((permissionCode) => {
                    const permission = permissionByCode.get(permissionCode);
                    return (
                      <tr key={permissionCode}>
                        <td className="p-3 font-bold">{permission?.module ?? '—'}</td>
                        <td className="p-3">{permission?.resource ?? '—'}</td>
                        <td className="p-3">{permission?.action ?? permissionCode}</td>
                        <td className="p-3"><StatusPill tone={riskTone[permission?.riskLevel ?? ''] ?? 'neutral'}>{permission?.riskLevel ?? '—'}</StatusPill></td>
                        <td className="p-3 text-slate-500">{permission?.description ?? '—'}</td>
                      </tr>
                    );
                  })}
                  {selectedRole.permissions.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-slate-400">Este rol no tiene permisos asignados.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
      <InlineNotice tone="info">Vista de solo lectura: reasignar roles a un usuario se hace desde User Management; editar el set de permisos de un rol no está expuesto todavía por el backend.</InlineNotice>
    </div>
  );
}
