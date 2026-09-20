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
  /* `getUser` retirado: `listUsers` ya devuelve el perfil completo de cada persona, así que pedirlo
   * de uno en uno no lo llamaba nadie. El endpoint sigue en el backend. */
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
  /**
   * «Olvidé mi contraseña» del comercio, en dos pasos y sin sesión. Distinto de
   * `requestPasswordChange`, que exige estar dentro y saber la contraseña actual.
   *
   * La respuesta es la misma exista o no la cuenta: la pantalla NO puede decir «ese correo no está
   * registrado» sin convertirse en un comprobador de qué correos son de un comercio afiliado.
   */
  requestMerchantPasswordReset(body: { email: string }) {
    return apiRequest<{ requested: boolean }>('auth/merchant/password-reset/request', {
      method: 'POST',
      body,
      skipAuthRetry: true,
    });
  },
  confirmMerchantPasswordReset(body: { email: string; code: string; newPassword: string }) {
    return apiRequest<{ passwordChanged: boolean }>('auth/merchant/password-reset/confirm', {
      method: 'POST',
      body,
      skipAuthRetry: true,
    });
  },
  /**
   * Lo mismo para el PERSONAL INTERNO. Rutas distintas de las del comercio a propósito: a quién se
   * le cambia la contraseña lo decide la ruta, no un campo del cuerpo, así que desde una pantalla
   * no se puede sondear qué correos son de la otra población.
   */
  requestPasswordReset(body: { email: string }) {
    return apiRequest<{ requested: boolean }>('auth/password-reset/request', {
      method: 'POST',
      body,
      skipAuthRetry: true,
    });
  },
  confirmPasswordReset(body: { email: string; code: string; newPassword: string }) {
    return apiRequest<{ passwordChanged: boolean }>('auth/password-reset/confirm', {
      method: 'POST',
      body,
      skipAuthRetry: true,
    });
  },
  listPermissions() {
    return apiRequest<{ items: InternalPermissionListItem[] }>('auth/permissions');
  },
};
