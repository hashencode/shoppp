import type { PermissionKey } from '../../../infrastructure/auth/permissions'

export type PagePermissionContract = {
  page?: PermissionKey
}

export type FormPermissionContract = {
  read: PermissionKey
  write: PermissionKey
}
