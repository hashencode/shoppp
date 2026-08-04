import React from 'react'
import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../infrastructure/auth/use-auth'
void React

export const RequireAuth = ({ children }: PropsWithChildren) => {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <div role="status" aria-live="polite">正在验证登录状态…</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

export const RedirectIfAuthenticated = ({ children }: PropsWithChildren) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <div role="status" aria-live="polite">正在验证登录状态…</div>
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}
