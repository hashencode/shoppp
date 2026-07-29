import React, { createContext, useCallback, useMemo, useState, type PropsWithChildren } from 'react'
import type { Role } from '../../shared/types/roles'

const AUTH_STORAGE_KEY = 'codex-admin-auth'
const AUTH_ACCOUNT_STORAGE_KEY = 'codex-admin-account'
const DEFAULT_DISPLAY_NAME = '付小小'
const DEFAULT_ACCOUNT_NAME = 'fxx_admin'

type LoginPayload = {
  role?: Role
  displayName?: string
  accountName?: string
}

type AuthContextValue = {
  isAuthenticated: boolean
  role: Role
  displayName: string
  accountName: string
  setRole: (role: Role) => void
  setDisplayName: (displayName: string) => void
  setAccountName: (accountName: string) => void
  login: (payload?: LoginPayload) => void
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
void React

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return window.localStorage.getItem(AUTH_STORAGE_KEY) === '1'
  })
  const [role, setRole] = useState<Role>('admin')
  const [displayName, setDisplayName] = useState(DEFAULT_DISPLAY_NAME)
  const [accountName, setAccountName] = useState(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_ACCOUNT_NAME
    }

    return window.localStorage.getItem(AUTH_ACCOUNT_STORAGE_KEY) || DEFAULT_ACCOUNT_NAME
  })

  const login = useCallback((payload?: LoginPayload) => {
    const nextAccountName =
      payload?.accountName?.trim() || payload?.displayName?.trim() || DEFAULT_ACCOUNT_NAME

    setIsAuthenticated(true)
    setRole(payload?.role ?? 'admin')
    setDisplayName(payload?.displayName?.trim() ? payload.displayName : DEFAULT_DISPLAY_NAME)
    setAccountName(nextAccountName)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_STORAGE_KEY, '1')
      window.localStorage.setItem(AUTH_ACCOUNT_STORAGE_KEY, nextAccountName)
    }
  }, [])

  const logout = useCallback(() => {
    setIsAuthenticated(false)
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      window.localStorage.removeItem(AUTH_ACCOUNT_STORAGE_KEY)
    }
  }, [])

  const value = useMemo(
    () => ({
      isAuthenticated,
      role,
      displayName,
      accountName,
      setRole,
      setDisplayName,
      setAccountName,
      login,
      logout,
    }),
    [accountName, displayName, isAuthenticated, role, login, logout]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
