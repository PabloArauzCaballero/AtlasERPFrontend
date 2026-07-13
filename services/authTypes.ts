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
