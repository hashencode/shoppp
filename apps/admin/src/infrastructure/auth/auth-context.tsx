import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import { fetchAdminSession } from '../../services/auth/api'
import type { PermissionKey } from './permissions'
import type { Role } from '../../shared/types/roles'

const AUTH_STORAGE_KEY = 'codex-admin-auth'
const AUTH_ACCOUNT_STORAGE_KEY = 'codex-admin-account'
const DEFAULT_DISPLAY_NAME = 'Access operator'
const DEFAULT_ACCOUNT_NAME = 'unverified-access-identity'
const templateAuthentication =
  typeof __ENABLE_TEMPLATE_ROUTES__ === 'undefined' || __ENABLE_TEMPLATE_ROUTES__

type LoginPayload = {
  role?: Role
  displayName?: string
  accountName?: string
}

type AuthContextValue = {
  accessManaged?: boolean
  isAuthenticated: boolean
  isLoading?: boolean
  role: Role
  permissions?: readonly PermissionKey[]
  displayName: string
  accountName: string
  sessionError?: string | null
  refreshSession?: () => Promise<void>
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
    if (!templateAuthentication || typeof window === 'undefined') {
      return false
    }

    return window.localStorage.getItem(AUTH_STORAGE_KEY) === '1'
  })
  const [role, setRole] = useState<Role>('admin')
  const [permissions, setPermissions] = useState<readonly PermissionKey[] | undefined>()
  const [displayName, setDisplayName] = useState(DEFAULT_DISPLAY_NAME)
  const [accountName, setAccountName] = useState(() => {
    if (!templateAuthentication || typeof window === 'undefined') {
      return DEFAULT_ACCOUNT_NAME
    }

    return window.localStorage.getItem(AUTH_ACCOUNT_STORAGE_KEY) || DEFAULT_ACCOUNT_NAME
  })
  const [isLoading, setIsLoading] = useState(!templateAuthentication)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const sessionRequest = useRef(0)

  const refreshSession = useCallback(async () => {
    if (templateAuthentication) {
      setIsLoading(false)
      return
    }
    const request = ++sessionRequest.current
    setIsLoading(true)
    setSessionError(null)
    try {
      const session = await fetchAdminSession()
      if (request !== sessionRequest.current) return
      setRole(session.role)
      setPermissions(session.permissions)
      setDisplayName(session.displayName)
      setAccountName(session.email)
      setIsAuthenticated(true)
    } catch (error) {
      if (request !== sessionRequest.current) return
      setIsAuthenticated(false)
      setPermissions(undefined)
      setSessionError(
        error instanceof Error
          ? error.message
          : 'Cloudflare Access session could not be verified.'
      )
    } finally {
      if (request === sessionRequest.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshSession(), 0)
    return () => {
      window.clearTimeout(timer)
      sessionRequest.current += 1
    }
  }, [refreshSession])

  const login = useCallback((payload?: LoginPayload) => {
    if (!templateAuthentication) {
      void refreshSession()
      return
    }
    const nextAccountName =
      payload?.accountName?.trim() || payload?.displayName?.trim() || DEFAULT_ACCOUNT_NAME

    setIsAuthenticated(true)
    setPermissions(undefined)
    setRole(payload?.role ?? 'admin')
    setDisplayName(payload?.displayName?.trim() ? payload.displayName : DEFAULT_DISPLAY_NAME)
    setAccountName(nextAccountName)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_STORAGE_KEY, '1')
      window.localStorage.setItem(AUTH_ACCOUNT_STORAGE_KEY, nextAccountName)
    }
  }, [refreshSession])

  const logout = useCallback(() => {
    sessionRequest.current += 1
    setIsAuthenticated(false)
    setPermissions(undefined)
    if (!templateAuthentication && typeof window !== 'undefined') {
      window.location.assign('/cdn-cgi/access/logout')
      return
    }
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(AUTH_STORAGE_KEY)
      window.localStorage.removeItem(AUTH_ACCOUNT_STORAGE_KEY)
    }
  }, [])

  const value = useMemo(
    () => ({
      isAuthenticated,
      isLoading,
      accessManaged: !templateAuthentication,
      role,
      permissions,
      displayName,
      accountName,
      refreshSession,
      sessionError,
      setRole,
      setDisplayName,
      setAccountName,
      login,
      logout,
    }),
    [
      accountName,
      displayName,
      isAuthenticated,
      isLoading,
      role,
      permissions,
      login,
      logout,
      refreshSession,
      sessionError,
    ]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
