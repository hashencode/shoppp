import type { AdminPermission } from '@shoppp/contracts'
import type { Role } from '../../shared/types/roles'

export type PermissionKey = AdminPermission

export const hasPermission = (
  _role: Role,
  permission: PermissionKey,
  authoritativePermissions?: readonly PermissionKey[]
): boolean => {
  return authoritativePermissions?.includes(permission) ?? false
}
