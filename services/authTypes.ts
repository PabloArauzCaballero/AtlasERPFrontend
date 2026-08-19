export interface InternalUserProfile {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  name: string;
  userCode: string | null;
  status: string;
  department: string | null;
  jobTitle: string | null;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  roles: string[];
  legacyRoles: string[];
  permissions: string[];
}

export interface InternalAccessProfile {
  user: InternalUserProfile;
}

export interface InternalAuthResponse extends InternalAccessProfile {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

/**
 * Desafío de segundo factor. Misma forma para los dos flujos que lo usan —el acceso interno y el
 * cambio de contraseña—, y en ambos se responde con el código de 6 dígitos que llega al correo.
 */
export interface PinChallenge {
  pinChallengeRequired: true;
  challengeToken: string;
  expiresInMinutes: number;
}

/**
 * El acceso interno termina en sesión o en desafío, y las dos cosas son un éxito. La unión obliga
 * a la pantalla a distinguirlas: leer `accessToken` de un desafío guardaba `undefined` como token
 * y la sesión moría en la primera llamada, con un 401 que parecía un problema de credenciales.
 */
export type InternalLoginOutcome = InternalAuthResponse | PinChallenge;

export function isPinChallenge(outcome: InternalLoginOutcome): outcome is PinChallenge {
  return (outcome as PinChallenge).pinChallengeRequired === true;
}

export interface InternalRoleListItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  department: string | null;
  legacyRoleCode: string;
  status: string;
  permissions: string[];
}

export interface InternalPermissionListItem {
  id: string;
  code: string;
  module: string;
  resource: string;
  action: string;
  description: string | null;
  riskLevel: string;
  requiresReason: boolean;
  requiresMfa: boolean;
}

export type InternalUserStatus = 'active' | 'invited' | 'suspended' | 'locked' | 'disabled';

export interface UpdateInternalUserInput {
  fullName?: string;
  department?: string;
  jobTitle?: string | null;
  status?: InternalUserStatus;
  mustChangePassword?: boolean;
  reason: string;
}

export interface ReplaceInternalUserRolesInput {
  roles: string[];
  reason: string;
}

/**
 * Usuario del COMERCIO afiliado. Es otra población: su identidad vive en AtlasBackend
 * (`iam.merchant_users`) y no tiene roles internos ni permisos RBAC — lo que puede tocar lo decide
 * el backend contra sus membresías, no una lista de permisos en el token.
 */
export interface MerchantUserProfile {
  id: string;
  email: string;
  fullName: string | null;
  userCode: string | null;
  phone: string | null;
  role: 'merchant';
  status: string;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
}

export interface MerchantAuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: MerchantUserProfile;
}
