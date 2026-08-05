import React from 'react'
import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../infrastructure/auth/use-auth'
import { useI18n } from '../shared/contexts/i18n-context'
void React

export const RequireAuth = ({ children }: PropsWithChildren) => {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()
  const { t } = useI18n()

  if (isLoading) {
    return <div role="status" aria-live="polite">{t('Verifying login status…')}</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

export const RedirectIfAuthenticated = ({ children }: PropsWithChildren) => {
  const { isAuthenticated, isLoading } = useAuth()
  const { t } = useI18n()

  if (isLoading) {
    return <div role="status" aria-live="polite">{t('Verifying login status…')}</div>
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}
