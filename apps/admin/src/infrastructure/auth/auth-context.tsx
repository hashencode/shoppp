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
import { acceptAdminInvitation, fetchAdminSession } from '../../services/auth/api'
import type { PermissionKey } from './permissions'
import type { Role } from '../../shared/types/roles'

export type AuthStatus =
  | 'loading'
  | 'authenticated'
  | 'access-required'
  | 'invitation-required'
  | 'invitation-expired'
  | 'disabled'
  | 'forbidden'

export type AuthContextValue = {
  accountName: string
  displayName: string
  isAuthenticated: boolean
  isLoading: boolean
  logout: () => void
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
  if (error.code === 'invitation_expired') return 'invitation-expired'
  if (error.status === 403) return 'forbidden'
  return 'access-required'
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
      let nextSession: AdminSession
      try {
        nextSession = await fetchAdminSession()
      } catch (error) {
        const sessionFailure = error as ErrorShape
        if (sessionFailure.code !== 'identity_unmapped') throw error
        try {
          nextSession = await acceptAdminInvitation()
        } catch (onboardingError) {
          const failure = onboardingError as ErrorShape
          if (request !== sessionRequest.current) return
          setSession(null)
          setStatus(
            failure.code === 'active_invitation_required'
              ? 'invitation-required'
              : failure.code === 'invitation_expired'
                ? 'invitation-expired'
                : failure.status === 403
                  ? 'forbidden'
                  : 'invitation-required'
          )
          setSessionError(failure.message)
          return
        }
      }
      if (request !== sessionRequest.current) return
      setSession(nextSession)
      setStatus('authenticated')
    } catch (error) {
      if (request !== sessionRequest.current) return
      const failure = error as ErrorShape
      setSession(null)
      setStatus(statusForError(failure))
      setSessionError(failure.message || 'Cloudflare Access session could not be verified.')
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshSession(), 0)
    return () => {
      window.clearTimeout(timer)
      sessionRequest.current += 1
    }
  }, [refreshSession])

  const logout = useCallback(() => {
    sessionRequest.current += 1
    setSession(null)
    setStatus('access-required')
    window.location.assign('/cdn-cgi/access/logout')
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
      logout,
      permissions: session?.permissions,
      principalKind: session?.principalKind,
      refreshSession,
      role: session?.role.key ?? 'unauthenticated',
      session,
      sessionError,
      status,
    }),
    [logout, refreshSession, session, sessionError, status]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
