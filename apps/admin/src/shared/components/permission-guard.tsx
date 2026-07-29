import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../infrastructure/auth/use-auth'
import { hasPermission, type PermissionKey } from '../../infrastructure/auth/permissions'

type PermissionGuardProps = PropsWithChildren<{
  permission: PermissionKey
}>

export const PermissionGuard = ({ permission, children }: PermissionGuardProps) => {
  const { role } = useAuth()
  const location = useLocation()

  if (!hasPermission(role, permission)) {
    return <Navigate to="/template/exception/403" replace state={{ from: location.pathname }} />
  }

  return children
}
