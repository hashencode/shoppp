import type { Role } from '../../shared/types/roles'

export type PermissionKey =
  | 'dashboard.read'
  | 'list.read'
  | 'form.read'
  | 'form.write'
  | 'profile.read'
  | 'result.read'
  | 'exception.read'
  | 'catalog.read'
  | 'catalog.write'
  | 'catalog.publish'
  | 'inventory.read'
  | 'inventory.adjust'

const rolePermissions: Record<Role, PermissionKey[]> = {
  admin: [
    'dashboard.read',
    'list.read',
    'form.read',
    'form.write',
    'profile.read',
    'result.read',
    'exception.read',
    'catalog.read',
    'catalog.write',
    'catalog.publish',
    'inventory.read',
    'inventory.adjust',
  ],
  editor: [
    'dashboard.read',
    'list.read',
    'form.read',
    'form.write',
    'profile.read',
    'result.read',
    'exception.read',
    'catalog.read',
    'catalog.write',
    'catalog.publish',
    'inventory.read',
    'inventory.adjust',
  ],
  viewer: [
    'dashboard.read',
    'list.read',
    'form.read',
    'profile.read',
    'result.read',
    'exception.read',
    'catalog.read',
    'inventory.read',
  ],
}

export const hasPermission = (role: Role, permission: PermissionKey): boolean => {
  return rolePermissions[role].includes(permission)
}
