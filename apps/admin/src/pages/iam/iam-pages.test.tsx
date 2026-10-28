import React from 'react'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
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
import { renderInLocale } from '../../test/render-in-locale'
import { PermissionChecklist } from './permission-checklist'
import { useI18n, type AppLocale } from '../../shared/contexts/i18n-context'
import type { AdminPermission } from '@shoppp/contracts'

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
let userLoads = 0
let invitationLoads = 0
let roleLoads = 0
let userQueries: Record<string, string>[] = []
let invitationQueries: Record<string, string>[] = []
let roleQueries: Record<string, string>[] = []
let roleCreateBody: unknown
let inviteBodies: Array<Record<string, unknown>> = []
const originalLanguages = Object.getOwnPropertyDescriptor(window.navigator, 'languages')

const server = setupServer(
  http.get('*/admin/iam/users', ({ request }) => {
    userLoads += 1
    userQueries.push(Object.fromEntries(new URL(request.url).searchParams.entries()))
    return HttpResponse.json({ data: page([alice, disabledUser]) })
  }),
  http.get('*/admin/iam/users/:id', ({ params }) => {
    userDetailLoads += 1
    return HttpResponse.json({ data: params.id === alice.id ? alice : disabledUser })
  }),
  http.get('*/admin/iam/invitations', ({ request }) => {
    invitationLoads += 1
    invitationQueries.push(Object.fromEntries(new URL(request.url).searchParams.entries()))
    return HttpResponse.json({ data: page([expiredInvitation]) })
  }),
  http.get('*/admin/iam/roles', ({ request }) => {
    roleLoads += 1
    const query = Object.fromEntries(new URL(request.url).searchParams.entries())
    roleQueries.push(query)
    const requestedPage = Number(query.page ?? 1)
    return HttpResponse.json({
      data: { ...page([adminRole, supportRole]), page: requestedPage, total: 30 },
    })
  }),
  http.get('*/admin/iam/roles/:id', ({ params }) => {
    roleDetailLoads += 1
    return HttpResponse.json({ data: params.id === adminRole.id ? adminRole : supportRole })
  }),
  http.post('*/admin/iam/invitations', async ({ request }) => {
    inviteBodies.push((await request.json()) as Record<string, unknown>)
    inviteAttempts += 1
    if (inviteAttempts === 1) {
      return HttpResponse.json(
        { error: { code: 'active_invitation_conflict', message: 'Invitation already exists.' } },
        { status: 409 }
      )
    }
    return HttpResponse.json({ data: { ...expiredInvitation, status: 'pending' } }, { status: 201 })
  }),
  http.post('*/admin/iam/roles', async ({ request }) => {
    roleCreateBody = await request.json()
    return HttpResponse.json({ data: supportRole }, { status: 201 })
  }),
  http.patch('*/admin/iam/users/:id', () =>
    HttpResponse.json(
      { error: { code: 'stale_user_version', message: 'The user changed.' } },
      { status: 409 }
    )
  ),
  http.patch('*/admin/iam/roles/:id', async ({ request }) => {
    const body = await request.json()
    if ('enabled' in (body as object)) expect(body).toEqual({ enabled: false, expectedVersion: 3 })
    return HttpResponse.json(
      {
        error: {
          code: 'role_has_dependencies',
          details: { identities: 2, pendingInvitations: 1 },
          message: 'The role has dependencies.',
        },
      },
      { status: 409 }
    )
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  inviteAttempts = 0
  userDetailLoads = 0
  roleDetailLoads = 0
  userLoads = 0
  invitationLoads = 0
  roleLoads = 0
  userQueries = []
  invitationQueries = []
  roleQueries = []
  roleCreateBody = undefined
  inviteBodies = []
  if (originalLanguages) Object.defineProperty(window.navigator, 'languages', originalLanguages)
  else Reflect.deleteProperty(window.navigator, 'languages')
})
afterAll(() => server.close())

const renderPage = (
  element: React.ReactNode,
  options: {
    path?: string
    permissions?: string[]
    identityId?: string
    locale?: AppLocale
    sessionRole?: typeof adminRole
  } = {}
) => {
  const path = options.path ?? '/access/users'
  const permissions = options.permissions ?? [
    'iam.users.read',
    'iam.users.write',
    'iam.roles.read',
    'iam.roles.write',
  ]
  return renderInLocale(
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
          role: options.sessionRole ?? adminRole,
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
    </AuthContext.Provider>,
    options.locale
  )
}

const LocaleSwitch = () => {
  const { locale, setLocale } = useI18n()
  return (
    <button onClick={() => setLocale(locale === 'en-US' ? 'zh-CN' : 'en-US')}>
      Switch language
    </button>
  )
}

describe('IAM management pages', () => {
  it.each(['zh-CN', 'en-US'] as const)(
    'formats invitation expiry using %s and retranslates without fetching',
    async (locale) => {
      const otherLocale = locale === 'zh-CN' ? 'en-US' : 'zh-CN'
      Object.defineProperty(window.navigator, 'languages', {
        configurable: true,
        value: [otherLocale],
      })
      const expiresAt = '2026-09-03T23:30:00.000Z'
      server.use(
        http.get('*/admin/iam/invitations', () => {
          invitationLoads += 1
          return HttpResponse.json({ data: page([{ ...expiredInvitation, expiresAt }]) })
        })
      )
      renderPage(
        <>
          <LocaleSwitch />
          <UsersPage />
        </>,
        { locale }
      )
      await screen.findByText('Alice Admin')
      fireEvent.click(
        screen.getByRole('tab', { name: locale === 'zh-CN' ? '邀请' : 'Invitations' })
      )
      await screen.findByText('expired@example.test')
      expect(screen.getByText(new Date(expiresAt).toLocaleDateString(locale))).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
      expect(screen.getByText(new Date(expiresAt).toLocaleDateString(otherLocale))).toBeTruthy()
      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
      expect(invitationLoads).toBe(1)
    }
  )

  it.each(['zh-CN', 'en-US'] as const)(
    'formats user updates using %s while preserving local time and unsaved edits',
    async (locale) => {
      const otherLocale = locale === 'zh-CN' ? 'en-US' : 'zh-CN'
      Object.defineProperty(window.navigator, 'languages', {
        configurable: true,
        value: [otherLocale],
      })
      const updatedAt = '2026-09-03T23:30:00.000Z'
      server.use(
        http.get('*/admin/iam/users/:id', () => {
          userDetailLoads += 1
          return HttpResponse.json({ data: { ...disabledUser, updatedAt } })
        })
      )
      renderPage(
        <>
          <LocaleSwitch />
          <UserDetailPage />
        </>,
        { locale, path: `/access/users/${disabledUser.id}` }
      )
      await screen.findByDisplayValue('Disabled User')
      expect(screen.getByText(new Date(updatedAt).toLocaleString(locale))).toBeTruthy()
      fireEvent.change(screen.getByDisplayValue('Disabled User'), {
        target: { value: 'Unsaved name' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
      expect(screen.getByText(new Date(updatedAt).toLocaleString(otherLocale))).toBeTruthy()
      expect(screen.getByDisplayValue('Unsaved name')).toBeTruthy()
      await act(async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 0))
      })
      expect(userDetailLoads).toBe(1)
    }
  )

  it('localizes permission read/write labels while preserving selected permission IDs across language changes', () => {
    let selected: readonly AdminPermission[] = []
    const PermissionProbe = () => {
      const { setLocale } = useI18n()
      const [value, setValue] = React.useState<AdminPermission[]>(['catalog.read'])
      return (
        <>
          <button onClick={() => setLocale('en-US')}>English</button>
          <PermissionChecklist
            permitted={['catalog.read', 'catalog.write']}
            value={value}
            onChange={(next) => {
              selected = next
              setValue(next)
            }}
          />
        </>
      )
    }
    renderInLocale(<PermissionProbe />, 'zh-CN')
    expect(screen.getByText('查看商品及商品目录内容。')).toBeTruthy()
    expect(screen.getByText('创建和编辑商品目录内容。')).toBeTruthy()
    expect(
      (screen.getByRole('checkbox', { name: /查看商品目录/ }) as HTMLInputElement).checked
    ).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /编辑商品目录/ }))
    expect(selected).toEqual(['catalog.read', 'catalog.write'])
    fireEvent.click(screen.getByText('English'))
    expect(
      (screen.getByRole('checkbox', { name: /Edit catalog/ }) as HTMLInputElement).checked
    ).toBe(true)
    fireEvent.click(screen.getByRole('checkbox', { name: /View catalog/ }))
    expect(selected).toEqual(['catalog.write'])
  })

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

  it('keeps resource tabs, query, and results in one Card across resource changes', async () => {
    renderPage(<UsersPage />)

    await screen.findByText('Alice Admin')
    const listCard = screen.getByText('Alice Admin').closest('.ant-card')
    expect(listCard).toBeTruthy()
    expect(screen.getByRole('tablist').closest('.ant-card')).toBe(listCard)
    expect(screen.getByLabelText('Search users and invitations').closest('.ant-card')).toBe(
      listCard
    )

    fireEvent.click(screen.getByRole('tab', { name: /Invitations/i }))
    await screen.findByText('expired@example.test')
    expect(screen.getByRole('tablist').closest('.ant-card')).toBe(listCard)
    expect(screen.getByText('expired@example.test').closest('.ant-card')).toBe(listCard)
    expect(screen.getByLabelText('Search users and invitations').closest('.ant-card')).toBe(
      listCard
    )
  })

  it('keeps filters draft-only and commits shared search to both independent resources', async () => {
    renderPage(<UsersPage />)
    await waitFor(() => expect(userLoads).toBe(1))
    await waitFor(() => expect(invitationLoads).toBe(1))

    fireEvent.mouseDown(screen.getByLabelText('User status'))
    fireEvent.click((await screen.findAllByText('Disabled')).at(-1)!)
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })
    expect(userLoads).toBe(1)
    expect(invitationLoads).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: /Search/ }))
    await waitFor(() => expect(userLoads).toBe(2))
    expect(invitationLoads).toBe(1)
    expect(userQueries.at(-1)).toMatchObject({ page: '1', status: 'disabled' })

    fireEvent.change(screen.getByLabelText('Search users and invitations'), {
      target: { value: 'alice@example.test' },
    })
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })
    expect(userLoads).toBe(2)
    expect(invitationLoads).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: /Search/ }))
    await waitFor(() => expect(userLoads).toBe(3))
    await waitFor(() => expect(invitationLoads).toBe(2))
    expect(userQueries.at(-1)).toMatchObject({ page: '1', search: 'alice@example.test' })
    expect(invitationQueries.at(-1)).toMatchObject({
      page: '1',
      search: 'alice@example.test',
    })
  })

  it('paginates users without moving or reloading invitations', async () => {
    server.use(
      http.get('*/admin/iam/users', ({ request }) => {
        userLoads += 1
        const query = Object.fromEntries(new URL(request.url).searchParams.entries())
        userQueries.push(query)
        return HttpResponse.json({
          data: { ...page([alice, disabledUser]), page: Number(query.page), total: 30 },
        })
      })
    )
    renderPage(<UsersPage />)
    await screen.findByText('Alice Admin')
    await waitFor(() => expect(invitationLoads).toBe(1))

    fireEvent.click(screen.getByTitle('2'))
    await waitFor(() => expect(userQueries.at(-1)).toMatchObject({ page: '2', pageSize: '25' }))
    expect(invitationLoads).toBe(1)
  })

  it('paginates invitations without moving or reloading users', async () => {
    server.use(
      http.get('*/admin/iam/invitations', ({ request }) => {
        invitationLoads += 1
        const query = Object.fromEntries(new URL(request.url).searchParams.entries())
        invitationQueries.push(query)
        return HttpResponse.json({
          data: { ...page([expiredInvitation]), page: Number(query.page), total: 30 },
        })
      })
    )
    renderPage(<UsersPage />)
    await screen.findByText('Alice Admin')
    fireEvent.click(screen.getByRole('tab', { name: /Invitations/i }))
    await screen.findByText('expired@example.test')

    fireEvent.click(screen.getByTitle('2'))
    await waitFor(() =>
      expect(invitationQueries.at(-1)).toMatchObject({ page: '2', pageSize: '25' })
    )
    expect(userLoads).toBe(1)
  })

  it('resets only visible status scope and preserves the hidden tab draft', async () => {
    renderPage(<UsersPage />)
    await waitFor(() => expect(invitationLoads).toBe(1))
    fireEvent.click(screen.getByRole('tab', { name: /Invitations/i }))
    fireEvent.mouseDown(screen.getByLabelText('Invitation status'))
    fireEvent.click((await screen.findAllByText('Revoked')).at(-1)!)
    fireEvent.click(screen.getByRole('tab', { name: /^Users$/i }))

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(userLoads).toBe(2))
    expect(invitationLoads).toBe(1)

    fireEvent.click(screen.getByRole('tab', { name: /Invitations/i }))
    fireEvent.click(screen.getByRole('button', { name: /Search/ }))
    await waitFor(() => expect(invitationLoads).toBe(2))
    expect(invitationQueries.at(-1)).toMatchObject({ page: '1', status: 'revoked' })
  })

  it('keeps user results usable when invitations fail and retries invitations independently', async () => {
    server.use(
      http.get('*/admin/iam/invitations', () =>
        HttpResponse.json(
          { error: { code: 'QUERY_SERVER_ERROR', message: 'Invitations unavailable.' } },
          { status: 503 }
        )
      )
    )
    renderPage(<UsersPage />)

    expect(await screen.findByText('Alice Admin')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Invitations/i }))
    expect(await screen.findByText('Invitations unavailable.')).toBeTruthy()

    server.use(
      http.get('*/admin/iam/invitations', ({ request }) => {
        invitationLoads += 1
        invitationQueries.push(Object.fromEntries(new URL(request.url).searchParams.entries()))
        return HttpResponse.json({ data: page([expiredInvitation]) })
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('expired@example.test')).toBeTruthy()
    expect(userLoads).toBe(1)
  })

  it('keeps invitation results usable when users fail and retries users independently', async () => {
    server.use(
      http.get('*/admin/iam/users', () => {
        userLoads += 1
        return HttpResponse.json(
          { error: { code: 'QUERY_SERVER_ERROR', message: 'Users unavailable.' } },
          { status: 503 }
        )
      })
    )
    renderPage(<UsersPage />)

    expect(await screen.findByText('Users unavailable.')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Invitations/i }))
    expect(await screen.findByText('expired@example.test')).toBeTruthy()

    server.use(
      http.get('*/admin/iam/users', ({ request }) => {
        userLoads += 1
        userQueries.push(Object.fromEntries(new URL(request.url).searchParams.entries()))
        return HttpResponse.json({ data: page([alice, disabledUser]) })
      })
    )
    fireEvent.click(screen.getByRole('tab', { name: /^Users$/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Alice Admin')).toBeTruthy()
    expect(invitationLoads).toBe(1)
  })

  it('keeps lists visible when the auxiliary roles lookup fails', async () => {
    server.use(
      http.get('*/admin/iam/roles', () =>
        HttpResponse.json(
          { error: { code: 'QUERY_SERVER_ERROR', message: 'Roles unavailable.' } },
          { status: 503 }
        )
      )
    )
    renderPage(<UsersPage />)

    expect(await screen.findByText('Alice Admin')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: /Invitations/i }))
    expect(await screen.findByText('expired@example.test')).toBeTruthy()
    expect(screen.getByText('Roles unavailable.')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Invite user/i }).hasAttribute('disabled')).toBe(true)
  })

  it('hides invitation mutations without user-write authority', async () => {
    server.use(
      http.get('*/admin/iam/invitations', () =>
        HttpResponse.json({
          data: page([{ ...expiredInvitation, status: 'pending' as const }]),
        })
      )
    )
    renderPage(<UsersPage />, { permissions: ['iam.users.read'] })
    fireEvent.click(await screen.findByRole('tab', { name: /Invitations/i }))
    expect(await screen.findByText('expired@example.test')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Resend' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Revoke' })).toBeNull()
  })

  it('keeps pending invitation actions in the bounded row layout with revoke confirmation', async () => {
    let revokeCalls = 0
    server.use(
      http.get('*/admin/iam/invitations', () =>
        HttpResponse.json({
          data: page([{ ...expiredInvitation, status: 'pending' as const }]),
        })
      ),
      http.post('*/admin/iam/invitations/:id/revoke', async ({ request }) => {
        expect(await request.json()).toEqual({ expectedVersion: 2 })
        revokeCalls += 1
        return HttpResponse.json({ data: { ...expiredInvitation, status: 'revoked' } })
      })
    )
    renderPage(<UsersPage />)
    fireEvent.click(await screen.findByRole('tab', { name: /Invitations/i }))
    const invitee = await screen.findByText('expired@example.test')
    const row = invitee.closest('tr')
    expect(row?.querySelectorAll('[data-list-row-actions-row]')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Revoke' }))
    expect(revokeCalls).toBe(0)
    expect(
      await screen.findByText('The invitee will no longer be able to activate it.')
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm revoke' }))
    await waitFor(() => expect(revokeCalls).toBe(1))
  }, 25_000)

  it('keeps invite failures actionable and supports an idempotent retry', async () => {
    renderPage(<UsersPage />)
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeTruthy())
    const inviteButton = screen.getByRole('button', { name: /Invite user/i })
    await waitFor(() => expect(inviteButton.hasAttribute('disabled')).toBe(false))
    fireEvent.click(inviteButton)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.test' } })
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'New User' } })
    fireEvent.mouseDown(screen.getByLabelText('Role'))
    fireEvent.click((await screen.findAllByText('Support')).at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }))
    expect(await screen.findByText('Invitation already exists.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }))
    await waitFor(() => expect(inviteAttempts).toBe(2))
    expect(await screen.findByText('Invitation created.')).toBeTruthy()
    expect(inviteBodies).toEqual([
      {
        displayName: 'New User',
        email: 'new@example.test',
        roleId: 'role_support',
        idempotencyKey: expect.stringMatching(/^admin-invite-/),
      },
      {
        displayName: 'New User',
        email: 'new@example.test',
        roleId: 'role_support',
        idempotencyKey: expect.stringMatching(/^admin-invite-/),
      },
    ])
    expect(inviteBodies[0]?.idempotencyKey).toBe(inviteBodies[1]?.idempotencyKey)
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
      screen
        .getByLabelText('Role')
        .closest('.ant-select')
        ?.classList.contains('ant-select-disabled')
    ).toBe(true)
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'Renamed User' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(updateBody).toBeTruthy())
    expect(updateBody).toEqual({ displayName: 'Renamed User', enabled: false, expectedVersion: 2 })
  })

  it('prevents self-modification', async () => {
    renderPage(<UserDetailPage />, {
      identityId: alice.id,
      path: `/access/users/${alice.id}`,
    })
    await waitFor(() => expect(screen.getByText('Alice Admin')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.getByLabelText('Display name').hasAttribute('disabled')).toBe(true)
    expect(
      screen
        .getByLabelText('Role')
        .closest('.ant-select')
        ?.classList.contains('ant-select-disabled')
    ).toBe(true)
    expect(screen.getByText(/cannot change your own role or status/i)).toBeTruthy()
  })

  it('reloads authoritative user data after a stale version', async () => {
    renderPage(<UserDetailPage />, { path: `/access/users/${disabledUser.id}` })
    await waitFor(() => expect(screen.getByDisplayValue('Disabled User')).toBeTruthy())
    fireEvent.change(screen.getByLabelText('Display name'), {
      target: { value: 'Changed by this manager' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
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
    expect(
      screen.queryByText('Role permissions are authoritative on each protected API request.')
    ).toBeNull()
  })

  it('keeps one users heading without repeating the page purpose below it', async () => {
    renderPage(<UsersPage />)
    await screen.findByText('Alice Admin')
    expect(
      screen.queryByText('Manage human accounts, activation, status, and role assignment.')
    ).toBeNull()
    expect(
      screen.getAllByRole('heading', { level: 4, name: 'Users and invitations' })
    ).toHaveLength(1)
  })

  it('commits role search explicitly, resets it, and paginates with the accepted page size', async () => {
    const requests: Record<string, string>[] = []
    server.use(
      http.get('*/admin/iam/roles', ({ request }) => {
        requests.push(Object.fromEntries(new URL(request.url).searchParams.entries()))
        const requestedPage = Number(new URL(request.url).searchParams.get('page') ?? 1)
        return HttpResponse.json({
          data: { ...page([adminRole, supportRole]), page: requestedPage, total: 30 },
        })
      })
    )
    renderPage(<RolesPage />, { path: '/access/roles' })

    await screen.findByText('Administrator')
    expect(requests).toEqual([{ page: '1', pageSize: '25' }])
    fireEvent.change(screen.getByLabelText('Search roles'), {
      target: { value: ' support ' },
    })
    expect(requests).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /^(loading )?Search$/ }))
    await waitFor(() => expect(requests).toHaveLength(2), { timeout: 3_000 })
    expect(requests[1]).toEqual({ page: '1', pageSize: '25', search: 'support' })

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(requests).toHaveLength(3), { timeout: 3_000 })
    expect(requests[2]).toEqual({ page: '1', pageSize: '25' })

    fireEvent.click(document.querySelector('.ant-pagination-next button')!)
    await waitFor(() => expect(requests.at(-1)?.page).toBe('2'))
  })

  it('retranslates roles without refetching the committed query', async () => {
    renderPage(
      <>
        <LocaleSwitch />
        <RolesPage />
      </>,
      { path: '/access/roles' }
    )

    await screen.findByText('Administrator')
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })
    expect(roleQueries).toEqual([{ page: '1', pageSize: '25' }])
  })

  it('opens the selected role in a 720px Drawer while retaining the list', async () => {
    renderInLocale(
      <AuthContext.Provider
        value={authContextFixture({
          permissions: ['iam.roles.read', 'iam.roles.write'],
          role: 'admin',
        })}
      >
        <MemoryRouter initialEntries={['/access/roles']}>
          <Routes>
            <Route path="/access/roles" element={<RolesPage />} />
            <Route path="/access/roles/:id" element={<div>Role destination</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    )
    await screen.findByText('Administrator')

    fireEvent.click(screen.getAllByRole('button', { name: 'Inspect' })[1]!)
    expect(await screen.findByDisplayValue('Support')).toBeTruthy()
    expect(document.querySelector('.ant-drawer-content-wrapper')?.getAttribute('style')).toContain(
      '720px'
    )
    expect(roleDetailLoads).toBe(1)
    expect(roleLoads).toBe(1)
  })

  it('saves tree leaf permissions through the role Drawer once and refreshes its list once', async () => {
    let savedBody: unknown
    let writes = 0
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.patch('*/admin/iam/roles/:id', async ({ request }) => {
        writes += 1
        savedBody = await request.json()
        await pending
        return HttpResponse.json({ data: { ...supportRole, version: 4 } })
      })
    )
    renderPage(<RolesPage />, {
      path: '/access/roles',
      permissions: [
        'iam.roles.read',
        'iam.roles.write',
        'iam.users.read',
        'catalog.read',
        'catalog.write',
      ],
    })
    await screen.findByText('Support')
    fireEvent.click(screen.getAllByRole('button', { name: 'Inspect' })[1]!)
    await screen.findByDisplayValue('Support')
    const drawer = document.querySelector('.ant-drawer') as HTMLElement
    fireEvent.click(
      within(drawer)
        .getByText('catalog', { exact: true })
        .closest('.ant-tree-treenode')!
        .querySelector('.ant-tree-checkbox')!
    )
    fireEvent.change(within(drawer).getByLabelText('Role name'), {
      target: { value: ' Support Plus ' },
    })
    fireEvent.change(within(drawer).getByLabelText('Description'), {
      target: { value: ' Updated support ' },
    })
    fireEvent.submit(drawer.querySelector('form')!)
    fireEvent.submit(drawer.querySelector('form')!)
    await waitFor(() => expect(writes).toBe(1))
    expect(savedBody).toEqual({
      description: 'Updated support',
      expectedVersion: 3,
      name: 'Support Plus',
      permissions: ['catalog.read', 'catalog.write', 'iam.users.read'],
    })
    expect(
      (within(drawer).getByRole('button', { name: 'Reset' }) as HTMLButtonElement).disabled
    ).toBe(true)
    fireEvent.click(drawer.querySelector('.ant-drawer-close')!)
    expect(roleLoads).toBe(1)
    await act(async () => {
      release()
    })
    await waitFor(() => expect(roleLoads).toBe(2))
    expect(screen.queryByRole('dialog', { name: 'Support' })).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    expect(roleLoads).toBe(2)
    expect(writes).toBe(1)
  })

  it('waits for permission reduction confirmation before completing the role Drawer save', async () => {
    let savedBody: unknown
    server.use(
      http.patch('*/admin/iam/roles/:id', async ({ request }) => {
        savedBody = await request.json()
        return HttpResponse.json({ data: { ...supportRole, permissions: [], version: 4 } })
      })
    )
    renderPage(<RolesPage />, { path: '/access/roles' })
    await screen.findByText('Support')
    fireEvent.click(screen.getAllByRole('button', { name: 'Inspect' })[1]!)
    await screen.findByDisplayValue('Support')
    const drawer = document.querySelector('.ant-drawer') as HTMLElement
    fireEvent.click(within(drawer).getByRole('checkbox', { name: 'View users' }))
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }))
    await screen.findByRole('button', { name: 'Confirm reduction' })
    expect(savedBody).toBeUndefined()
    fireEvent.click(drawer.querySelector('.ant-drawer-close')!)
    expect(roleLoads).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    let confirmation = document.querySelector('.ant-modal-confirm-confirm') as HTMLElement
    await waitFor(() => expect(confirmation.className).toContain('leave-active'))
    fireEvent.transitionEnd(confirmation)
    await waitFor(() =>
      expect(
        (within(drawer).getByRole('button', { name: /^(loading )?Save$/ }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    )
    expect(savedBody).toBeUndefined()
    expect(
      within(drawer).getByRole('checkbox', { name: 'View users' }).getAttribute('aria-checked')
    ).toBe('false')
    fireEvent.click(within(drawer).getByRole('button', { name: /^(loading )?Save$/ }))
    await screen.findByRole('button', { name: 'Confirm reduction' })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reduction' }))
    await waitFor(() =>
      expect(savedBody).toEqual({
        description: 'Support operators',
        expectedVersion: 3,
        name: 'Support',
        permissions: [],
      })
    )
    confirmation = document.querySelector('.ant-modal-confirm-confirm') as HTMLElement
    await waitFor(() => expect(confirmation.className).toContain('leave-active'))
    fireEvent.transitionEnd(confirmation)
    await waitFor(() => expect(roleLoads).toBe(2))
    expect(screen.queryByRole('dialog', { name: 'Support' })).toBeNull()
  })

  it('preserves granted permissions outside caller authority in a readonly Drawer and closes cleanly', async () => {
    let writes = 0
    server.use(
      http.patch('*/admin/iam/roles/:id', () => {
        writes += 1
        return HttpResponse.json({ data: supportRole })
      })
    )
    renderPage(<RolesPage />, {
      path: '/access/roles',
      permissions: ['iam.roles.read', 'iam.roles.write'],
    })
    await screen.findByText('Support')
    fireEvent.click(screen.getAllByRole('button', { name: 'Inspect' })[1]!)
    await screen.findByDisplayValue('Support')
    const drawer = document.querySelector('.ant-drawer') as HTMLElement
    expect((within(drawer).getByLabelText('Role name') as HTMLInputElement).disabled).toBe(true)
    expect(
      within(drawer).getByRole('checkbox', { name: 'View users' }).getAttribute('aria-checked')
    ).toBe('true')
    expect(within(drawer).queryByRole('button', { name: 'Save' })).toBeNull()
    fireEvent.change(within(drawer).getByLabelText('Search permissions'), {
      target: { value: 'users' },
    })
    fireEvent.click(within(drawer).getByRole('button', { name: 'Collapse all' }))
    fireEvent.click(within(drawer).getByRole('button', { name: 'Expand all' }))
    fireEvent.submit(drawer.querySelector('form')!)
    fireEvent.click(drawer.querySelector('.ant-drawer-close')!)
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Support' })).toBeNull())
    expect(screen.queryByText('Unsaved changes')).toBeNull()
    expect(writes).toBe(0)
    expect(roleLoads).toBe(1)
  })

  it('retries failed role details inside the Drawer without reloading the list', async () => {
    let fail = true
    server.use(
      http.get('*/admin/iam/roles/:id', () => {
        roleDetailLoads += 1
        return fail
          ? HttpResponse.json(
              { error: { code: 'unavailable', message: 'Unavailable' } },
              { status: 503 }
            )
          : HttpResponse.json({ data: supportRole })
      })
    )
    renderPage(<RolesPage />, { path: '/access/roles' })
    await screen.findByText('Support')
    fireEvent.click(screen.getAllByRole('button', { name: 'Inspect' })[1]!)
    await screen.findByText('Form details could not be loaded')
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByDisplayValue('Support')
    expect(screen.getByRole('tree', { name: 'Role permissions' })).toBeTruthy()
    expect(roleDetailLoads).toBe(2)
    expect(roleLoads).toBe(1)
  })

  it('creates a permitted role and reloads the committed list', async () => {
    renderPage(<RolesPage />, { path: '/access/roles' })
    await screen.findByText('Administrator')

    fireEvent.change(screen.getByLabelText('Search roles'), { target: { value: 'support' } })
    fireEvent.click(screen.getByRole('button', { name: /^(loading )?Search$/ }))
    await waitFor(() => expect(roleLoads).toBe(2), { timeout: 3_000 })

    fireEvent.click(screen.getByRole('button', { name: 'New role' }))
    fireEvent.change(screen.getByLabelText('Role key'), { target: { value: 'support_lead' } })
    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'Support Lead' } })
    expect(document.querySelector('.ant-drawer-content-wrapper')?.getAttribute('style')).toContain(
      '720px'
    )
    expect(
      within(document.querySelector('.ant-drawer') as HTMLElement).queryByRole('button', {
        name: 'Cancel',
      })
    ).toBeNull()
    fireEvent.click(
      within(document.querySelector('.ant-drawer') as HTMLElement).getByRole('button', {
        name: 'Save',
      })
    )

    await waitFor(() => expect(roleCreateBody).toBeTruthy())
    expect(roleCreateBody).toEqual({
      description: null,
      key: 'support_lead',
      name: 'Support Lead',
      permissions: [],
    })
    await waitFor(() => expect(roleLoads).toBe(3))
    expect(roleQueries.at(-1)).toEqual({ page: '1', pageSize: '25', search: 'support' })
    expect(screen.queryByRole('dialog', { name: 'New role' })).toBeNull()
  })

  it('saves a selected user through the Drawer with the version and refreshes only the users list once', async () => {
    let payload: unknown
    let writes = 0
    server.use(
      http.patch('*/admin/iam/users/:id', async ({ request }) => {
        writes += 1
        payload = await request.json()
        return HttpResponse.json({
          data: { ...disabledUser, displayName: 'Updated regional operator', version: 3 },
        })
      })
    )
    renderPage(<UsersPage />)
    await screen.findByText('Disabled User')
    fireEvent.click(screen.getAllByRole('button', { name: 'Inspect' })[1]!)
    await screen.findByDisplayValue('Disabled User')
    fireEvent.change(
      within(document.querySelector('.ant-drawer') as HTMLElement).getByLabelText('Display name'),
      { target: { value: 'Discarded local edit' } }
    )
    fireEvent.click(
      within(document.querySelector('.ant-drawer-footer') as HTMLElement).getByRole('button', {
        name: 'Reset',
      })
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    expect(await screen.findByDisplayValue('Disabled User')).toBeTruthy()
    fireEvent.change(
      within(document.querySelector('.ant-drawer') as HTMLElement).getByLabelText('Display name'),
      { target: { value: ' Updated regional operator ' } }
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(writes).toBe(1))
    expect(payload).toEqual({
      displayName: 'Updated regional operator',
      enabled: false,
      expectedVersion: 2,
    })
    await waitFor(() => expect(userLoads).toBe(2))
    expect(userDetailLoads).toBe(1)
    expect(invitationLoads).toBe(1)
    const wrapper = document.querySelector('.ant-drawer-content-wrapper') as HTMLElement
    await waitFor(() => expect(wrapper.className).toContain('leave-active'))
    fireEvent.transitionEnd(wrapper)
    await waitFor(() => expect(document.querySelector('.ant-drawer')).toBeNull())
    expect((await screen.findAllByText('User access updated.')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(userLoads).toBe(2)
    expect(writes).toBe(1)
  })

  it('locks the access confirmation while writing and keeps one versioned write and one parent read', async () => {
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    let writes = 0
    let payload: unknown
    server.use(
      http.patch('*/admin/iam/users/:id', async ({ request }) => {
        writes += 1
        payload = await request.json()
        await pending
        return HttpResponse.json({ data: { ...disabledUser, status: 'active', version: 3 } })
      })
    )
    renderPage(<UsersPage />)
    await screen.findByText('Disabled User')
    fireEvent.click(screen.getAllByRole('button', { name: 'Inspect' })[1]!)
    const drawer = document.querySelector('.ant-drawer') as HTMLElement
    await within(drawer).findByDisplayValue('Disabled User')
    fireEvent.mouseDown(within(drawer).getByLabelText('Status'))
    fireEvent.click((await screen.findAllByText('Active')).at(-1)!)
    fireEvent.click(within(drawer).getByRole('button', { name: 'Save' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm change' }))
    await waitFor(() => expect(writes).toBe(1))
    expect(payload).toEqual({ displayName: 'Disabled User', enabled: true, expectedVersion: 2 })
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(
      true
    )
    fireEvent.click(drawer.querySelector('.ant-drawer-close') as HTMLElement)
    expect(userLoads).toBe(1)
    await act(async () => {
      release()
    })
    const confirmation = document.querySelector('.ant-modal-confirm-confirm') as HTMLElement
    await waitFor(() => expect(confirmation.className).toContain('leave-active'))
    fireEvent.transitionEnd(confirmation)
    await waitFor(() => expect(userLoads).toBe(2))
    expect(writes).toBe(1)
  })

  it('uses standard blocking error, retry, and empty states for roles', async () => {
    let fail = true
    let empty = false
    server.use(
      http.get('*/admin/iam/roles', () => {
        if (fail) {
          return HttpResponse.json(
            { error: { code: 'roles_unavailable', message: 'Roles are unavailable.' } },
            { status: 503 }
          )
        }
        return HttpResponse.json({ data: page(empty ? [] : [adminRole]) })
      })
    )

    const view = renderPage(<RolesPage />, { path: '/access/roles' })
    expect(await screen.findByText('List could not be loaded')).toBeTruthy()
    expect(screen.queryByText('Administrator')).toBeNull()

    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Administrator')).toBeTruthy()
    view.unmount()

    empty = true
    renderPage(<RolesPage />, { path: '/access/roles' })
    expect(await screen.findByText('No roles match these filters.')).toBeTruthy()
  })

  it('selects category children within caller authority and saves only leaf permissions', async () => {
    let savedBody: unknown
    server.use(
      http.patch('*/admin/iam/roles/:id', async ({ request }) => {
        savedBody = await request.json()
        return HttpResponse.json({ data: { ...supportRole, version: 4 } })
      })
    )
    renderPage(<RoleDetailPage />, {
      path: `/access/roles/${supportRole.id}`,
      permissions: [
        'iam.roles.read',
        'iam.roles.write',
        'iam.users.read',
        'catalog.read',
        'catalog.write',
      ],
    })
    await screen.findByDisplayValue('Support')
    expect(screen.getByRole('tree', { name: 'Role permissions' })).toBeTruthy()
    expect(screen.queryByText('Publish catalog', { exact: true })).toBeNull()
    fireEvent.click(
      screen
        .getByText('catalog', { exact: true })
        .closest('.ant-tree-treenode')!
        .querySelector('.ant-tree-checkbox')!
    )
    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: ' Support Plus ' } })
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: ' Updated support ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(savedBody).toEqual({
        description: 'Updated support',
        expectedVersion: 3,
        name: 'Support Plus',
        permissions: ['catalog.read', 'catalog.write', 'iam.users.read'],
      })
    )
  })

  it('keeps a category half checked and confirms permission reductions before saving', async () => {
    let savedBody: unknown
    server.use(
      http.patch('*/admin/iam/roles/:id', async ({ request }) => {
        savedBody = await request.json()
        return HttpResponse.json({ data: { ...supportRole, permissions: [], version: 4 } })
      })
    )
    renderPage(<RoleDetailPage />, { path: `/access/roles/${supportRole.id}` })
    await screen.findByDisplayValue('Support')
    expect(
      screen
        .getByText('iam', { exact: true })
        .closest('.ant-tree-treenode')!
        .querySelector('.ant-tree-checkbox-indeterminate')
    ).toBeTruthy()
    fireEvent.click(
      screen
        .getByText('View users', { exact: true })
        .closest('.ant-tree-treenode')!
        .querySelector('.ant-tree-checkbox')!
    )
    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: 'View users' }).getAttribute('aria-checked')
      ).toBe('false')
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('button', { name: 'Confirm reduction' })
    expect(savedBody).toBeUndefined()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm reduction' }))
    await waitFor(() =>
      expect(savedBody).toEqual({
        description: 'Support operators',
        expectedVersion: 3,
        name: 'Support',
        permissions: [],
      })
    )
  })

  it.each(['protected', 'self', 'outside-authority', 'no-write'] as const)(
    'keeps %s roles read only while allowing permission browsing',
    async (reason) => {
      let patches = 0
      server.use(
        http.patch('*/admin/iam/roles/:id', () => {
          patches += 1
          return HttpResponse.json({ data: supportRole })
        })
      )
      const role = reason === 'protected' ? adminRole : supportRole
      const view = renderPage(<RoleDetailPage />, {
        path: `/access/roles/${role.id}`,
        permissions:
          reason === 'no-write'
            ? ['iam.roles.read', 'iam.users.read']
            : reason === 'outside-authority'
              ? ['iam.roles.read', 'iam.roles.write']
              : undefined,
        sessionRole: reason === 'self' ? supportRole : undefined,
      })
      await screen.findByDisplayValue(role.name)
      const readonlyDescription = 'Admin has all permissions. This role cannot be edited.'
      if (reason === 'protected') {
        expect(screen.getAllByText(readonlyDescription)).toHaveLength(1)
        expect(
          within(document.querySelector('.role-detail-permissions') as HTMLElement).getByText(
            'Read only'
          )
        ).toBeTruthy()
      } else {
        expect(screen.queryByText(readonlyDescription)).toBeNull()
      }
      expect((screen.getByLabelText('Role name') as HTMLInputElement).disabled).toBe(true)
      expect(screen.queryByText('Save', { selector: 'button' })).toBeNull()
      expect(screen.queryByText('Reset', { selector: 'button' })).toBeNull()
      expect(screen.queryByText('Archive role', { selector: 'button' })).toBeNull()
      expect((screen.getByLabelText('Search permissions') as HTMLInputElement).disabled).toBe(false)
      fireEvent.click(screen.getByLabelText('Collapse all', { selector: 'button' }))
      fireEvent.click(screen.getByLabelText('Expand all', { selector: 'button' }))
      expect(screen.getByText('View users', { exact: true })).toBeTruthy()
      const groupCheckbox = screen
        .getByText('iam', { exact: true })
        .closest('.ant-tree-treenode')!
        .querySelector('.ant-tree-checkbox')!
      expect(groupCheckbox.getAttribute('aria-checked')).toBe(
        reason === 'protected' ? 'true' : 'mixed'
      )
      const userCheckbox = screen.getByRole('checkbox', { name: 'View users' })
      expect(userCheckbox.getAttribute('aria-disabled')).toBe('true')
      fireEvent.click(userCheckbox)
      expect(userCheckbox.getAttribute('aria-checked')).toBe('true')
      await act(async () => {
        fireEvent.submit(view.container.querySelector('form')!)
      })
      expect(patches).toBe(0)
    }
  )

  it('resets role fields, permission selection, search and expansion to loaded state', async () => {
    renderPage(<RoleDetailPage />, { path: `/access/roles/${supportRole.id}` })
    await screen.findByDisplayValue('Support')
    fireEvent.change(screen.getByLabelText('Role name'), { target: { value: 'Draft' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all permissions' }))
    fireEvent.change(screen.getByLabelText('Search permissions'), { target: { value: 'users' } })
    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() =>
      expect((screen.getByLabelText('Role name') as HTMLInputElement).value).toBe('Support')
    )
    expect((screen.getByLabelText('Search permissions') as HTMLInputElement).value).toBe('')
    expect(screen.getByText('View users', { exact: true })).toBeTruthy()
    expect(
      screen
        .getByText('iam', { exact: true })
        .closest('.ant-tree-treenode')!
        .querySelector('.ant-tree-checkbox-indeterminate')
    ).toBeTruthy()
  })

  it('recovers a failed role load using the standard retry action', async () => {
    let fail = true
    server.use(
      http.get('*/admin/iam/roles/:id', () =>
        fail
          ? HttpResponse.json(
              { error: { code: 'unavailable', message: 'Unavailable' } },
              { status: 503 }
            )
          : HttpResponse.json({ data: supportRole })
      )
    )
    renderPage(<RoleDetailPage />, { path: `/access/roles/${supportRole.id}` })
    await screen.findByText('Form details could not be loaded')
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByDisplayValue('Support')).toBeTruthy()
  })

  it('limits permission choices to the caller subset and explains archive dependencies', async () => {
    renderPage(<RoleDetailPage />, {
      path: `/access/roles/${supportRole.id}`,
      permissions: ['iam.roles.read', 'iam.roles.write', 'iam.users.read'],
    })
    await waitFor(() => expect(screen.getByDisplayValue('Support')).toBeTruthy())
    expect(screen.getByText('View users', { exact: true })).toBeTruthy()
    expect(screen.queryByText('Manage users', { exact: true })).toBeNull()
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
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
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
  it('saves the complete role fields and ordered permissions with its authoritative version', async () => {
    let submitted: unknown
    server.use(
      http.patch('*/admin/iam/roles/role_support', async ({ request }) => {
        submitted = await request.json()
        return HttpResponse.json({
          data: { ...supportRole, name: 'Support Plus', description: null, version: 4 },
        })
      })
    )
    renderPage(<RoleDetailPage />, { path: '/access/roles/role_support' })
    const name = await screen.findByLabelText('Role name')
    await waitFor(() => expect((name as HTMLInputElement).value).toBe('Support'))
    fireEvent.change(name, { target: { value: ' Support Plus ' } })
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /Manage users/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(submitted).toEqual({
        description: null,
        expectedVersion: 3,
        name: 'Support Plus',
        permissions: ['iam.users.read', 'iam.users.write'],
      })
    )
  })

  it.each([
    {
      kind: 'role',
      permission: 'iam.roles.read',
      path: '/access/roles/role_support',
      name: 'Support',
    },
    {
      kind: 'user',
      permission: 'iam.users.read',
      path: '/access/users/identity_disabled',
      name: 'Disabled User',
    },
  ])(
    'hard-blocks the $kind legacy readonly form even when its form event is forced',
    async ({ kind, permission, path, name }) => {
      let writes = 0
      server.use(
        http.patch('*/admin/iam/:kind/:id', () => {
          writes += 1
          return HttpResponse.json({ data: disabledUser })
        })
      )
      renderPage(kind === 'role' ? <RoleDetailPage /> : <UserDetailPage />, {
        path,
        permissions: [permission],
      })
      const input = await screen.findByDisplayValue(name)
      await act(async () => {
        fireEvent.submit(input.closest('form')!)
      })
      expect((input as HTMLInputElement).disabled).toBe(true)
      expect(writes).toBe(0)
    }
  )

  it('resends an invitation with its complete version and operation identity and only rereads invitations', async () => {
    let submitted: unknown
    server.use(
      http.get('*/admin/iam/invitations', () => {
        invitationLoads += 1
        return HttpResponse.json({ data: page([{ ...expiredInvitation, status: 'pending' }]) })
      }),
      http.post('*/admin/iam/invitations/invitation_expired/resend', async ({ request }) => {
        submitted = await request.json()
        return HttpResponse.json({ data: expiredInvitation })
      })
    )
    renderPage(<UsersPage />)
    await screen.findByText('Alice Admin')
    fireEvent.click(screen.getByRole('tab', { name: 'Invitations' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Resend' }))
    await waitFor(() =>
      expect(submitted).toEqual({
        expectedVersion: 2,
        idempotencyKey: expect.stringMatching(/^admin-invite-resend-invitation_expired-/),
      })
    )
    await waitFor(() => expect(invitationLoads).toBe(2))
    expect(userLoads).toBe(1)
  })

  it('preserves a changed user role ID only after the access consequence is confirmed', async () => {
    let submitted: unknown
    server.use(
      http.patch('*/admin/iam/users/identity_disabled', async ({ request }) => {
        submitted = await request.json()
        return HttpResponse.json({ data: { ...disabledUser, role: adminRole, version: 3 } })
      })
    )
    renderPage(<UserDetailPage />, { path: '/access/users/identity_disabled' })
    await screen.findByDisplayValue('Disabled User')
    fireEvent.mouseDown(screen.getByLabelText('Role'))
    fireEvent.click((await screen.findAllByText('Administrator')).at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(submitted).toBeUndefined()
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm change' }))
    await waitFor(() =>
      expect(submitted).toEqual({
        displayName: 'Disabled User',
        enabled: false,
        expectedVersion: 2,
        roleId: 'role_admin',
      })
    )
  })

  it('saves an edited role through the Drawer with every field and one parent read', async () => {
    let submitted: unknown
    server.use(
      http.patch('*/admin/iam/roles/role_support', async ({ request }) => {
        submitted = await request.json()
        return HttpResponse.json({ data: { ...supportRole, name: 'Support Desk', version: 4 } })
      })
    )
    renderPage(<RolesPage />, { path: '/access/roles' })
    const row = (await screen.findByText('Support')).closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: 'Inspect' }))
    const name = await screen.findByDisplayValue('Support')
    fireEvent.change(name, { target: { value: 'Support Desk' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(submitted).toEqual({
        description: 'Support operators',
        expectedVersion: 3,
        name: 'Support Desk',
        permissions: ['iam.users.read'],
      })
    )
    await waitFor(() => expect(roleLoads).toBe(2))
    expect(roleDetailLoads).toBe(1)
  })
})
