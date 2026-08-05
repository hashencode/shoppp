import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AuthContext } from '../../infrastructure/auth/auth-context'
import { authContextFixture } from '../../test/auth-context-fixture'
import { RoleDetailPage } from './role-detail-page'
import { RolesPage } from './roles-page'
import { UserDetailPage } from './user-detail-page'
import { UsersPage } from './users-page'
import { PermissionGuard } from '../../shared/components/permission-guard'

void React

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
}

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

const adminRole = {
  description: 'Full administrative access',
  enabled: true,
  id: 'role_admin',
  key: 'admin',
  name: 'Administrator',
  permissions: ['iam.users.read', 'iam.users.write', 'iam.roles.read', 'iam.roles.write'],
  protected: true,
  system: true,
  version: 1,
}

const supportRole = {
  description: 'Support operators',
  enabled: true,
  id: 'role_support',
  key: 'support',
  name: 'Support',
  permissions: ['iam.users.read'],
  protected: false,
  system: false,
  version: 3,
}

const alice = {
  createdAt: '2026-08-01T00:00:00.000Z',
  displayName: 'Alice Admin',
  email: 'alice@example.test',
  id: 'identity_alice',
  role: adminRole,
  status: 'active',
  updatedAt: '2026-08-02T00:00:00.000Z',
  version: 2,
}

const disabledUser = {
  ...alice,
  displayName: 'Disabled User',
  email: 'disabled@example.test',
  id: 'identity_disabled',
  role: supportRole,
  status: 'disabled',
}

const expiredInvitation = {
  acceptedAt: null,
  acceptedIdentityId: null,
  createdAt: '2026-07-01T00:00:00.000Z',
  delivery: {
    attemptCount: 3,
    lastErrorCode: 'recipient_rejected',
    status: 'dead_letter',
  },
  displayName: 'Expired Invite',
  email: 'expired@example.test',
  expiresAt: '2026-07-08T00:00:00.000Z',
  id: 'invitation_expired',
  revokedAt: null,
  role: supportRole,
  status: 'expired',
  updatedAt: '2026-07-08T00:00:00.000Z',
  version: 2,
}

const page = (items: unknown[]) => ({ items, page: 1, pageSize: 25, total: items.length })

let inviteAttempts = 0
let userDetailLoads = 0
let roleDetailLoads = 0

const server = setupServer(
  http.get('*/admin/iam/users', () => {
    return HttpResponse.json({ data: page([alice, disabledUser]) })
  }),
  http.get('*/admin/iam/users/:id', ({ params }) => {
    userDetailLoads += 1
    return HttpResponse.json({ data: params.id === alice.id ? alice : disabledUser })
  }),
  http.get('*/admin/iam/invitations', () =>
    HttpResponse.json({ data: page([expiredInvitation]) })
  ),
  http.get('*/admin/iam/roles', () => {
    return HttpResponse.json({ data: page([adminRole, supportRole]) })
  }),
  http.get('*/admin/iam/roles/:id', ({ params }) => {
    roleDetailLoads += 1
    return HttpResponse.json({ data: params.id === adminRole.id ? adminRole : supportRole })
  }),
  http.post('*/admin/iam/invitations', async () => {
    inviteAttempts += 1
    if (inviteAttempts === 1) {
      return HttpResponse.json(
        { error: { code: 'active_invitation_conflict', message: 'Invitation already exists.' } },
        { status: 409 }
      )
    }
    return HttpResponse.json({ data: { ...expiredInvitation, status: 'pending' } }, { status: 201 })
  }),
  http.patch('*/admin/iam/users/:id', () =>
    HttpResponse.json(
      { error: { code: 'stale_user_version', message: 'The user changed.' } },
      { status: 409 }
    )
  ),
  http.patch('*/admin/iam/roles/:id', () =>
    HttpResponse.json(
      {
        error: {
          code: 'role_has_dependencies',
          details: { identities: 2, pendingInvitations: 1 },
          message: 'The role has dependencies.',
        },
      },
      { status: 409 }
    )
  )
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  inviteAttempts = 0
  userDetailLoads = 0
  roleDetailLoads = 0
})
afterAll(() => server.close())

const renderPage = (
  element: React.ReactNode,
  options: { path?: string; permissions?: string[]; identityId?: string } = {}
) => {
  const path = options.path ?? '/access/users'
  const permissions = options.permissions ?? [
    'iam.users.read',
    'iam.users.write',
    'iam.roles.read',
    'iam.roles.write',
  ]
  return render(
    <AuthContext.Provider
      value={authContextFixture({
        permissions: permissions as never,
        session: {
          displayName: 'Alice Admin',
          email: 'alice@example.test',
          environment: 'test',
          identityId: options.identityId ?? 'identity_manager',
          permissions: permissions as never,
          principalKind: 'human',
          role: adminRole,
        },
      })}
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/access/users" element={element} />
          <Route path="/access/users/:id" element={element} />
          <Route path="/access/roles" element={element} />
          <Route path="/access/roles/:id" element={element} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )
}

describe('IAM management pages', () => {
  it('renders active, disabled, expired, and empty-safe user lifecycle states for a read-only manager', async () => {
    renderPage(<UsersPage />, {
      permissions: ['iam.users.read', 'iam.roles.read'],
    })

    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeTruthy())
    expect(screen.getAllByText('Disabled').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('tab', { name: /Invitations/i }))
    expect(await screen.findByText('expired@example.test')).toBeTruthy()
    expect(screen.getAllByText('Expired').length).toBeGreaterThan(0)
    expect(screen.getByText('Delivery failed')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Invite user/i })).toBeNull()
  })

  it('keeps invite failures actionable and supports an idempotent retry', async () => {
    renderPage(<UsersPage />)
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /Invite user/i }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.test' } })
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'New User' } })
    fireEvent.mouseDown(screen.getByLabelText('Role'))
    fireEvent.click((await screen.findAllByText('Support')).at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }))
    expect(await screen.findByText('Invitation already exists.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }))
    await waitFor(() => expect(inviteAttempts).toBe(2))
    expect(await screen.findByText('Invitation created.')).toBeTruthy()
  })

  it('degrades user writes safely when role visibility is absent', async () => {
    const usersView = renderPage(<UsersPage />, {
      permissions: ['iam.users.read', 'iam.users.write'],
    })
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeTruthy())
    expect(screen.queryByRole('button', { name: /Invite user/i })).toBeNull()
    expect(screen.getByText(/invitation creation requires role visibility/i)).toBeTruthy()
    usersView.unmount()

    let updateBody: Record<string, unknown> | undefined
    server.use(
      http.patch('*/admin/iam/users/:id', async ({ request }) => {
        updateBody = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ data: { ...disabledUser, displayName: 'Renamed User' } })
      })
    )
    renderPage(<UserDetailPage />, {
      path: `/access/users/${disabledUser.id}`,
      permissions: ['iam.users.read', 'iam.users.write'],
    })
    await waitFor(() => expect(screen.getByDisplayValue('Disabled User')).toBeTruthy())
    expect(
      screen.getByLabelText('Role').closest('.ant-select')?.classList.contains('ant-select-disabled')
    ).toBe(true)
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Renamed User' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(updateBody).toBeTruthy())
    expect(updateBody).not.toHaveProperty('roleId')
  })

  it('prevents self-modification', async () => {
    renderPage(<UserDetailPage />, {
      identityId: alice.id,
      path: `/access/users/${alice.id}`,
    })
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Save changes' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(/cannot change your own role or status/i)).toBeTruthy()
  })

  it('reloads authoritative user data after a stale version', async () => {
    renderPage(<UserDetailPage />, { path: `/access/users/${disabledUser.id}` })
    await waitFor(() => expect(screen.getByDisplayValue('Disabled User')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Changed by this manager' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/changed by another administrator/i)).toBeTruthy()
    expect(userDetailLoads).toBeGreaterThanOrEqual(2)
  })

  it('surfaces the last-admin invariant after an explicitly confirmed status change', async () => {
    server.use(
      http.patch('*/admin/iam/users/:id', () =>
        HttpResponse.json(
          {
            error: {
              code: 'last_admin_change_denied',
              message: 'The user change violates an access invariant.',
            },
          },
          { status: 409 }
        )
      )
    )
    renderPage(<UserDetailPage />, { path: `/access/users/${alice.id}` })
    await waitFor(() => expect(screen.getByDisplayValue('Alice Admin')).toBeTruthy())
    fireEvent.mouseDown(screen.getByLabelText('Status'))
    fireEvent.click((await screen.findAllByText('Disabled')).at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm change' }))
    expect(await screen.findByText(/last enabled protected administrator/i)).toBeTruthy()
  })

  it('hides role writes from a user writer without role-write authority', async () => {
    renderPage(<RolesPage />, {
      path: '/access/roles',
      permissions: ['iam.users.read', 'iam.users.write', 'iam.roles.read'],
    })
    await waitFor(() => expect(screen.getByText('Administrator')).toBeTruthy())
    expect(screen.queryByRole('button', { name: /New role/i })).toBeNull()
    expect(screen.getByText('Protected')).toBeTruthy()
  })

  it('limits permission choices to the caller subset and explains archive dependencies', async () => {
    renderPage(<RoleDetailPage />, {
      path: `/access/roles/${supportRole.id}`,
      permissions: ['iam.roles.read', 'iam.roles.write', 'iam.users.read'],
    })
    await waitFor(() => expect(screen.getByDisplayValue('Support')).toBeTruthy())
    expect(screen.getByRole('checkbox', { name: /View users/i })).toBeTruthy()
    expect(screen.queryByRole('checkbox', { name: /Manage users/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Archive role' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm archive' }))
    expect(await screen.findByText(/2 assigned identities and 1 pending invitation/i)).toBeTruthy()
  })

  it('recovers from stale role versions by reloading authoritative data', async () => {
    server.use(
      http.patch('*/admin/iam/roles/:id', () =>
        HttpResponse.json(
          { error: { code: 'stale_role_version', message: 'The role changed.' } },
          { status: 409 }
        )
      )
    )
    renderPage(<RoleDetailPage />, { path: `/access/roles/${supportRole.id}` })
    await waitFor(() => expect(screen.getByDisplayValue('Support')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'Support Plus' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/changed by another administrator/i)).toBeTruthy()
    expect(roleDetailLoads).toBeGreaterThanOrEqual(2)
  })

  it('denies a direct IAM route when the authoritative permission is absent', () => {
    renderPage(
      <PermissionGuard permission="iam.roles.read">
        <div>Role administration</div>
      </PermissionGuard>,
      { permissions: ['iam.users.read'] }
    )
    expect(screen.getByText('Access denied')).toBeTruthy()
    expect(screen.queryByText('Role administration')).toBeNull()
  })
})
