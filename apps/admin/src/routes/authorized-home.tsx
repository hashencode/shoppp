import React from 'react'
import { Navigate } from 'react-router-dom'
import { hasPermission } from '../infrastructure/auth/permissions'
import { useAuth } from '../infrastructure/auth/use-auth'
import { ForbiddenPage } from '../pages/forbidden-page'
import { templateRoutes } from './routes.config'

void React

export const AuthorizedHome = () => {
  const { permissions, role } = useAuth()
  const target = hasPermission(role, 'settings.read', permissions)
    ? '/welcome'
    : templateRoutes.find(
        (route) => route.inMenu && hasPermission(role, route.permission, permissions)
      )?.path
  return target ? <Navigate to={target} replace /> : <ForbiddenPage />
}
