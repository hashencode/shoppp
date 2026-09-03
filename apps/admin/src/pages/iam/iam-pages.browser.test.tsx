import React, { useState } from 'react'
import { page } from '@rstest/browser'
import { afterEach, describe, expect, it } from '@rstest/core'
import { cleanup, waitFor } from '@testing-library/react'
import type { AdminInvitation, AdminPermission, AdminRole, AdminUser } from '@shoppp/contracts'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { renderInLocale } from '../../test/render-in-locale'
import { PermissionChecklist } from './permission-checklist'
import { UsersPage } from './users-page'
import { UserDetailPage } from './user-detail-page'
import {
  assertNativeBrowserAndCss,
  assertWithinViewport,
  installBrowserApi,
  renderI18nBrowser,
  switchBrowserLocale,
} from '../../test/i18n-browser-fixture'

void React

let transport: ReturnType<typeof installBrowserApi> | undefined
afterEach(() => {
  cleanup()
  transport?.restore()
})

const role: AdminRole = {
  description: 'Support operators',
  enabled: true,
  id: 'role_support',
  key: 'support',
  name: 'Support',
  permissions: ['iam.users.read'],
  protected: false,
  system: false,
  version: 1,
}
const instant = '2026-09-03T23:30:00.000Z'
const user: AdminUser = {
  createdAt: instant,
  displayName: 'Browser Operator',
  email: 'operator@example.test',
  id: 'identity_operator',
  role,
  status: 'active',
  updatedAt: instant,
  version: 1,
}
const invitation: AdminInvitation = {
  acceptedAt: null,
  acceptedIdentityId: null,
  createdAt: instant,
  delivery: { attemptCount: 0, lastErrorCode: null, status: 'pending' },
  displayName: 'Browser Invite',
  email: 'invite@example.test',
  expiresAt: instant,
  id: 'invitation_browser',
  revokedAt: null,
  role,
  status: 'pending',
  updatedAt: instant,
  version: 1,
}

const installIam = () =>
  installBrowserApi((request) => {
    if (request.method !== 'get') throw new Error(`Unexpected write ${request.url}`)
    if (request.url === '/admin/iam/users/identity_operator') return { data: { data: user } }
    const items =
      request.url === '/admin/iam/users'
        ? [user]
        : request.url === '/admin/iam/invitations'
          ? [invitation]
          : request.url === '/admin/iam/roles'
            ? [role]
            : null
    if (!items) throw new Error(`Unexpected request ${request.url}`)
    return { data: { data: { items, page: 1, pageSize: 25, total: items.length } } }
  })

describe('IAM controls in a real browser', () => {
  it('keeps Chinese permission descriptions and checkbox interaction within the native viewport', async () => {
    const Probe = () => {
      const [value, setValue] = useState<AdminPermission[]>([])
      return (
        <>
          <PermissionChecklist
            permitted={['iam.users.read', 'iam.users.write', 'iam.roles.read', 'iam.roles.write']}
            value={value}
            onChange={setValue}
          />
          <output aria-label="Selected permissions">{value.join(',')}</output>
        </>
      )
    }
    renderI18nBrowser(<Probe />, [])
    assertNativeBrowserAndCss()
    if (document.documentElement.lang !== 'zh-CN') await switchBrowserLocale()
    const read = page.getByRole('checkbox', { name: /查看用户.*查看人工管理员账号及邀请。/ })
    await expect.element(read).toBeVisible()
    await read.press('Space')
    await waitFor(() =>
      expect(document.querySelector('output')?.textContent).toBe('iam.users.read')
    )
    await page
      .getByRole('checkbox', { name: /管理用户.*邀请人工管理员、分配角色，以及启用或禁用账号。/ })
      .click()
    await waitFor(() =>
      expect(document.querySelector('output')?.textContent).toBe('iam.users.read,iam.users.write')
    )
    const checklist = document.querySelector('[aria-label="角色权限"]')!
    expect(getComputedStyle(checklist).display).toBe('grid')
    expect(checklist.scrollWidth).toBeLessThanOrEqual(checklist.clientWidth)
    for (const checkbox of checklist.querySelectorAll('.ant-checkbox-wrapper'))
      assertWithinViewport(checkbox)
    await switchBrowserLocale()
    expect(document.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true)
    await page.getByRole('checkbox', { name: /View users/ }).press('Space')
    await waitFor(() =>
      expect(document.querySelector('output')?.textContent).toBe('iam.users.write')
    )
  })

  it('formats invitation expiry in the application language and native time zone without another fetch', async () => {
    transport = installIam()
    renderI18nBrowser(
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>,
      ['iam.users.read']
    )
    await expect.element(page.getByText('operator@example.test')).toBeVisible()
    assertNativeBrowserAndCss()
    expect(document.documentElement.lang).not.toBe(navigator.language)
    await page
      .getByRole('tab', {
        name: document.documentElement.lang === 'zh-CN' ? '邀请' : 'Invitations',
      })
      .click()
    await expect.element(page.getByText('invite@example.test')).toBeVisible()
    const requests = transport.requests.length
    for (let index = 0; index < 2; index += 1) {
      await expect
        .element(
          page.getByText(new Date(instant).toLocaleDateString(document.documentElement.lang), {
            exact: true,
          })
        )
        .toBeVisible()
      await switchBrowserLocale()
    }
    expect(transport.requests).toHaveLength(requests)
    if (process.env.ADMIN_I18N_BROWSER_PROFILE) {
      expect(new Date(instant).getDate()).toBe(
        process.env.ADMIN_I18N_BROWSER_PROFILE === 'narrow' ? 3 : 4
      )
    }
  })

  it('reformats a user update without replacing dirty input or issuing a write', async () => {
    transport = installIam()
    renderI18nBrowser(
      <MemoryRouter initialEntries={['/access/users/identity_operator']}>
        <Routes>
          <Route path="/access/users/:id" element={<UserDetailPage />} />
        </Routes>
      </MemoryRouter>,
      ['iam.users.read', 'iam.users.write']
    )
    await expect
      .element(
        page.getByRole('textbox', {
          name: document.documentElement.lang === 'zh-CN' ? '显示名称' : 'Display name',
        })
      )
      .toBeVisible()
    assertNativeBrowserAndCss()
    const input = document.querySelector<HTMLInputElement>('input[value="Browser Operator"]')!
    await page
      .getByRole('textbox', {
        name: document.documentElement.lang === 'zh-CN' ? '显示名称' : 'Display name',
      })
      .fill('Unsaved / 用户')
    for (let index = 0; index < 2; index += 1) {
      await expect
        .element(
          page.getByText(new Date(instant).toLocaleString(document.documentElement.lang), {
            exact: true,
          })
        )
        .toBeVisible()
      expect(input.value).toBe('Unsaved / 用户')
      assertWithinViewport(input)
      await switchBrowserLocale()
    }
    expect(transport.requests).toHaveLength(1)
  })

  it('keeps delegated permissions keyboard-accessible in a narrow container', async () => {
    const Probe = () => {
      const [value, setValue] = useState<AdminPermission[]>([])
      return (
        <div style={{ width: 320 }}>
          <PermissionChecklist
            permitted={['iam.users.read', 'iam.roles.read']}
            value={value}
            onChange={setValue}
          />
          <output aria-label="Selected permissions">{value.join(',')}</output>
        </div>
      )
    }
    renderInLocale(<Probe />, 'en-US')

    const checkbox = page.getByRole('checkbox', { name: /View users/i })
    await expect.element(checkbox).toBeVisible()
    await checkbox.press('Space')
    await waitFor(() =>
      expect(document.querySelector('output')?.textContent).toBe('iam.users.read')
    )
    expect(
      document.querySelector('[aria-label="Role permissions"]')?.scrollWidth
    ).toBeLessThanOrEqual(320)
  })
})
