import React, { type PropsWithChildren } from 'react'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { hasPermission, type PermissionKey } from '../../infrastructure/auth/permissions'
import { ForbiddenPage } from '../../pages/forbidden-page'

void React

type PermissionGuardProps = PropsWithChildren<{
  permission: PermissionKey
}>

export const PermissionGuard = ({ permission, children }: PermissionGuardProps) => {
  const { role, permissions } = useAuth()

  if (!hasPermission(role, permission, permissions)) {
    return <ForbiddenPage />
  }

  return children
}
