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

export const hasPermission = (role: Role, permission: PermissionKey): boolean => {
  return rolePermissions[role].includes(permission)
}
