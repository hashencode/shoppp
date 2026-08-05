import React, { type PropsWithChildren } from 'react'
import { ADMIN_PERMISSION_KEYS, type AdminPermission } from '@shoppp/contracts'
import {
  AuthContext,
  type AuthContextValue,
} from '../infrastructure/auth/auth-context'
import type { Role } from '../shared/types/roles'

void React

export const authContextFixture = (
  overrides: Partial<AuthContextValue> = {}
): AuthContextValue => ({
  accountName: 'admin@example.test',
  displayName: 'Admin fixture',
  isAuthenticated: true,
  isLoading: false,
  login: async () => undefined,
  logout: () => undefined,
  permissions: ADMIN_PERMISSION_KEYS,
  principalKind: 'human',
  refreshSession: async () => undefined,
  role: 'admin',
  session: null,
  sessionError: null,
  status: 'authenticated',
  ...overrides,
})

export const AuthTestProvider = ({
  children,
  permissions,
  role = 'admin',
}: PropsWithChildren<{ permissions?: readonly AdminPermission[]; role?: Role }>) => (
  <AuthContext.Provider
    value={authContextFixture({
      permissions: permissions ?? ADMIN_PERMISSION_KEYS,
      role,
    })}
  >
    {children}
  </AuthContext.Provider>
)
