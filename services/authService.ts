import { apiRequest } from '@/lib/apiClient';
import type {
  InternalAuthResponse,
  InternalPermissionListItem,
  InternalRoleListItem,
  InternalUserProfile,
  ReplaceInternalUserRolesInput,
  UpdateInternalUserInput,
} from './authTypes';

/**
 * Todas las rutas viven en `atlas-integrated-backend` bajo `/auth/*`. Ese backend reenvía
 * internamente hacia AtlasBackend (gateway de identidad) — el frontend nunca habla con
 * AtlasBackend directamente. El refresh token upstream vive en una cookie httpOnly que este
 * cliente jamás toca; el refresco ocurre automático en `lib/apiClient.ts` cuando algo da 401.
 */
export const authService = {
  login(body: { email: string; password: string }) {
    return apiRequest<InternalAuthResponse>('auth/login', { method: 'POST', body, skipAuthRetry: true });
  },
  logout(allDevices = false) {
    return apiRequest<{ loggedOut: boolean }>('auth/logout', {
      method: 'POST',
      body: { allDevices },
      skipAuthRetry: true,
    });
  },
  me() {
    return apiRequest<{ user: InternalUserProfile }>('auth/me');
  },
  listUsers() {
    return apiRequest<{ items: InternalUserProfile[] }>('auth/users');
  },
  getUser(internalUserId: string) {
    return apiRequest<{ user: InternalUserProfile }>(`auth/users/${internalUserId}`);
  },
  updateUser(internalUserId: string, body: UpdateInternalUserInput) {
    return apiRequest<{ user: InternalUserProfile }>(`auth/users/${internalUserId}`, { method: 'PATCH', body });
  },
  replaceUserRoles(internalUserId: string, body: ReplaceInternalUserRolesInput) {
    return apiRequest<{ user: InternalUserProfile }>(`auth/users/${internalUserId}/roles`, { method: 'PATCH', body });
  },
  listRoles() {
    return apiRequest<{ items: InternalRoleListItem[] }>('auth/roles');
  },
  listPermissions() {
    return apiRequest<{ items: InternalPermissionListItem[] }>('auth/permissions');
  },
};
