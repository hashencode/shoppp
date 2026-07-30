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
  | 'orders.read'
  | 'orders.fulfill'
  | 'orders.cancel'
  | 'orders.refund'
  | 'reporting.read'
  | 'reporting.export'
  | 'operations.jobs.read'
  | 'operations.replay'
  | 'settings.read'
  | 'settings.write'
  | 'audit.read'
  | 'privacy.manage'
  | 'themes.read'
  | 'themes.write'
  | 'themes.approve'
  | 'themes.preview'

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
    'orders.read',
    'orders.fulfill',
    'orders.cancel',
    'orders.refund',
    'reporting.read',
    'reporting.export',
    'operations.jobs.read',
    'operations.replay',
    'settings.read',
    'settings.write',
    'audit.read',
    'privacy.manage',
    'themes.read',
    'themes.write',
    'themes.approve',
    'themes.preview',
  ],
  catalog_manager: [
    'catalog.read',
    'catalog.write',
    'catalog.publish',
    'inventory.read',
    'themes.read',
    'themes.write',
    'themes.approve',
    'themes.preview',
  ],
  operations: [
    'catalog.read',
    'inventory.read',
    'inventory.adjust',
    'orders.read',
    'orders.fulfill',
    'orders.cancel',
    'orders.refund',
    'audit.read',
    'operations.replay',
    'operations.jobs.read',
    'themes.read',
  ],
  support: ['catalog.read', 'inventory.read', 'orders.read'],
  analyst: [
    'catalog.read',
    'inventory.read',
    'orders.read',
    'reporting.read',
    'reporting.export',
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
    'orders.read',
    'orders.fulfill',
    'orders.cancel',
    'orders.refund',
    'reporting.read',
    'reporting.export',
    'operations.jobs.read',
    'operations.replay',
    'themes.read',
    'themes.write',
    'themes.approve',
    'themes.preview',
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
    'orders.read',
    'reporting.read',
  ],
}

export const hasPermission = (
  role: Role,
  permission: PermissionKey,
  authoritativePermissions?: readonly PermissionKey[]
): boolean => {
  return authoritativePermissions !== undefined
    ? authoritativePermissions.includes(permission)
    : rolePermissions[role].includes(permission)
}
