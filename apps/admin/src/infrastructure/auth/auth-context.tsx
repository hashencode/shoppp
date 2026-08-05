import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'
import type { AdminSession } from '@shoppp/contracts'
import { fetchAdminSession, loginAdmin, logoutAdmin } from '../../services/auth/api'
import type { PermissionKey } from './permissions'
import type { Role } from '../../shared/types/roles'

export type AuthStatus =
  | 'loading'
  | 'authenticated'
  | 'login-required'
  | 'disabled'
  | 'forbidden'

export type AuthContextValue = {
  accountName: string
  displayName: string
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void | Promise<void>
  permissions?: readonly PermissionKey[]
  principalKind?: AdminSession['principalKind']
  refreshSession: () => Promise<void>
  role: Role
  session: AdminSession | null
  sessionError: string | null
  status: AuthStatus
}

type ErrorShape = Error & { code?: string; status?: number }

const statusForError = (error: ErrorShape): AuthStatus => {
  if (error.code === 'identity_not_enabled') return 'disabled'
  if (error.status === 403) return 'forbidden'
  return 'login-required'
}

export const AuthContext = createContext<AuthContextValue | null>(null)
void React

export const useAuthState = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuthState must be used inside AuthProvider')
  return context
}

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [session, setSession] = useState<AdminSession | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [sessionError, setSessionError] = useState<string | null>(null)
  const sessionRequest = useRef(0)

  const refreshSession = useCallback(async () => {
    const request = ++sessionRequest.current
    setStatus('loading')
    setSessionError(null)
    try {
      const nextSession = await fetchAdminSession()
      if (request !== sessionRequest.current) return
      setSession(nextSession)
      setStatus('authenticated')
    } catch (error) {
      if (request !== sessionRequest.current) return
      const failure = error as ErrorShape
      setSession(null)
      setStatus(statusForError(failure))
      setSessionError(failure.status === 401 ? null : failure.message || '登录状态验证失败。')
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshSession(), 0)
    return () => {
      window.clearTimeout(timer)
      sessionRequest.current += 1
    }
  }, [refreshSession])

  const login = useCallback(async (email: string, password: string) => {
    const request = ++sessionRequest.current
    setStatus('loading')
    setSessionError(null)
    try {
      const nextSession = await loginAdmin({ email, password })
      if (request !== sessionRequest.current) return
      setSession(nextSession)
      setStatus('authenticated')
    } catch (error) {
      if (request !== sessionRequest.current) return
      const failure = error as ErrorShape
      setSession(null)
      setStatus(statusForError(failure))
      setSessionError(failure.message || '账号或密码错误。')
      throw error
    }
  }, [])

  const logout = useCallback(async () => {
    sessionRequest.current += 1
    try {
      await logoutAdmin()
    } finally {
      setSession(null)
      setStatus('login-required')
      setSessionError(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      accountName:
        session?.principalKind === 'human'
          ? session.email
          : session?.principalKind === 'service'
            ? session.serviceName
            : '',
      displayName: session?.displayName ?? '',
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      login,
      logout,
      permissions: session?.permissions,
      principalKind: session?.principalKind,
      refreshSession,
      role: session?.role.key ?? 'unauthenticated',
      session,
      sessionError,
      status,
    }),
    [login, logout, refreshSession, session, sessionError, status]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
