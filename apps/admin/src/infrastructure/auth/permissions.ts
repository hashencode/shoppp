import type { Role } from '../../shared/types/roles'

export type PermissionKey =
  | 'dashboard.read'
  | 'list.read'
  | 'form.read'
  | 'form.write'
  | 'profile.read'
  | 'result.read'
  | 'exception.read'

const rolePermissions: Record<Role, PermissionKey[]> = {
  admin: [
    'dashboard.read',
    'list.read',
    'form.read',
    'form.write',
    'profile.read',
    'result.read',
    'exception.read',
  ],
  editor: [
    'dashboard.read',
    'list.read',
    'form.read',
    'form.write',
    'profile.read',
    'result.read',
    'exception.read',
  ],
  viewer: ['dashboard.read', 'list.read', 'form.read', 'profile.read', 'result.read', 'exception.read'],
}

export const hasPermission = (role: Role, permission: PermissionKey): boolean => {
  return rolePermissions[role].includes(permission)
}
