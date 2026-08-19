import { apiRequest } from '@/lib/apiClient';
import type {
  InternalAuthResponse,
  InternalLoginOutcome,
  PinChallenge,
  MerchantAuthResponse,
  MerchantUserProfile,
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
  /** Primer paso. Puede devolver la sesión o el desafío de segundo factor: los dos son éxito. */
  login(body: { email: string; password: string }) {
    return apiRequest<InternalLoginOutcome>('auth/login', { method: 'POST', body, skipAuthRetry: true });
  },
  /** Segundo paso: el desafío más el PIN del correo, a cambio de la sesión. */
  loginPin(body: { challengeToken: string; pin: string }) {
    return apiRequest<InternalAuthResponse>('auth/login/pin', { method: 'POST', body, skipAuthRetry: true });
  },
  /**
   * Cambio de contraseña de la cuenta con sesión abierta, en dos pasos y con el mismo segundo
   * factor. No lleva email ni id: quién cambia la contraseña lo decide la sesión.
   */
  requestPasswordChange(body: { currentPassword: string }) {
    return apiRequest<PinChallenge>('auth/password/change/request', { method: 'POST', body });
  },
  confirmPasswordChange(body: { challengeToken: string; code: string; newPassword: string }) {
    return apiRequest<{ passwordChanged: boolean }>('auth/password/change/confirm', { method: 'POST', body });
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
  /**
   * Canal del COMERCIO. Rutas separadas del login interno a propósito: son dos poblaciones
   * distintas y el backend las resuelve contra tablas distintas.
   */
  merchantLogin(body: { email: string; password: string }) {
    return apiRequest<MerchantAuthResponse>('auth/merchant/login', { method: 'POST', body, skipAuthRetry: true });
  },
  merchantMe() {
    return apiRequest<{ user: MerchantUserProfile }>('auth/merchant/me');
  },
  merchantLogout(allDevices = false) {
    return apiRequest<{ loggedOut: boolean }>('auth/merchant/logout', {
      method: 'POST',
      body: { allDevices },
      skipAuthRetry: true,
    });
  },
  listPermissions() {
    return apiRequest<{ items: InternalPermissionListItem[] }>('auth/permissions');
  },
};
