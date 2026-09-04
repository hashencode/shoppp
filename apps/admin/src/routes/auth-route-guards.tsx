import React, { useEffect, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { Spin } from 'antd'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../infrastructure/auth/use-auth'
void React

const AUTH_LOADING_INDICATOR_DELAY_MS = 1_000

const DelayedAuthSpinner = () => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), AUTH_LOADING_INDICATOR_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      data-testid="auth-loading-indicator"
    >
      <Spin size="large" />
    </div>
  )
}

export const RequireAuth = ({ children }: PropsWithChildren) => {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <DelayedAuthSpinner />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return children
}

export const RedirectIfAuthenticated = ({ children }: PropsWithChildren) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <DelayedAuthSpinner />
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}
