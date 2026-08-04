import React, { type PropsWithChildren } from 'react'
import { ADMIN_PERMISSION_KEYS, type AdminPermission } from '@shoppp/contracts'
import {
  AuthContext,
  type AuthContextValue,
} from '../infrastructure/auth/auth-context'
import type { Role } from '../shared/types/roles'

void React

const READ_ONLY_PERMISSIONS: readonly AdminPermission[] = [
  'catalog.read',
  'inventory.read',
  'orders.read',
  'reporting.read',
  'operations.jobs.read',
]

export const testPermissionsForRole = (role: Role): readonly AdminPermission[] =>
  role === 'viewer' ? READ_ONLY_PERMISSIONS : ADMIN_PERMISSION_KEYS

export const authContextFixture = (
  overrides: Partial<AuthContextValue> = {}
): AuthContextValue => ({
  accountName: 'admin@example.test',
  displayName: 'Admin fixture',
  isAuthenticated: true,
  isLoading: false,
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
      permissions: permissions ?? testPermissionsForRole(role),
      role,
    })}
  >
    {children}
  </AuthContext.Provider>
)
