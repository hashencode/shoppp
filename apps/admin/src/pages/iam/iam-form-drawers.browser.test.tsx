import React from 'react'
import { afterEach, describe, expect, it } from '@rstest/core'
import { page } from '@rstest/browser'
import { cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RolesPage } from './roles-page'
import { installBrowserApi, renderI18nBrowser } from '../../test/i18n-browser-fixture'

void React

let transport: ReturnType<typeof installBrowserApi> | undefined
afterEach(() => {
  cleanup()
  transport?.restore()
})
const support = {
  id: 'role_support',
  key: 'support',
  name: 'Support operations for international tracked delivery',
  description: 'Regional support',
  permissions: ['iam.users.read'],
  protected: false,
  enabled: true,
  system: false,
  version: 3,
}
const protectedRole = {
  ...support,
  id: 'role_protected',
  name: 'Protected administrator',
  protected: true,
  system: true,
}

describe('IAM desktop form Drawers', () => {
  it('resets an editable role and shows only Close for a protected role without changing the list route', async () => {
    transport = installBrowserApi((request) => {
      if (request.method === 'get' && request.url === '/admin/iam/roles')
        return {
          data: { data: { items: [support, protectedRole], page: 1, pageSize: 25, total: 2 } },
        }
      if (request.method === 'get' && request.url === '/admin/iam/roles/role_support')
        return { data: { data: support } }
      if (request.method === 'get' && request.url === '/admin/iam/roles/role_protected')
        return { data: { data: protectedRole } }
      throw new Error(`Unexpected request ${request.method} ${request.url}`)
    })
    renderI18nBrowser(
      <MemoryRouter initialEntries={['/access/roles']}>
        <RolesPage />
      </MemoryRouter>,
      ['iam.roles.read', 'iam.roles.write', 'iam.users.read'],
      'en-US'
    )
    await expect.element(page.getByText(support.name, { exact: true })).toBeVisible()
    expect(window.innerWidth).toBeGreaterThanOrEqual(720)
    await page.getByRole('button', { name: 'Inspect', exact: true }).nth(0).click()
    await expect.element(page.getByLabel('Role name', { exact: true })).toHaveValue(support.name)
    const wrapper = document.querySelector('.ant-drawer-content-wrapper') as HTMLElement
    const body = document.querySelector('.ant-drawer-body') as HTMLElement
    await waitFor(() => expect(Math.round(wrapper.getBoundingClientRect().width)).toBe(720))
    expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth)
    await expect.element(page.getByRole('tree', { name: 'Role permissions' })).toBeVisible()
    const sections = body.querySelectorAll('.role-detail-layout > section')
    expect(sections[1]!.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      sections[0]!.getBoundingClientRect().bottom
    )
    expect(getComputedStyle(sections[1]!).borderTopWidth).toBe('1px')
    const footer = document.querySelector('.ant-drawer-footer')!.getBoundingClientRect()
    expect(footer.bottom).toBeLessThanOrEqual(window.innerHeight + 1)
    await page.getByLabel('Role name', { exact: true }).fill('Changed support label')
    await page.getByRole('checkbox', { name: 'Select all permissions' }).check()
    await page.getByLabel('Search permissions', { exact: true }).fill('users')
    await page.getByRole('button', { name: 'Collapse all', exact: true }).click()
    await page
      .getByRole('dialog', { name: support.name })
      .getByRole('button', { name: 'Reset', exact: true })
      .click()
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    await waitFor(() => {
      const popover = document.querySelector<HTMLElement>('.ant-popconfirm')
      expect(!popover || getComputedStyle(popover).display === 'none').toBe(true)
    })
    await expect.element(page.getByLabel('Role name', { exact: true })).toHaveValue(support.name)
    await expect.element(page.getByLabel('Search permissions', { exact: true })).toHaveValue('')
    await expect.element(page.getByText('View users', { exact: true })).toBeVisible()
    await expect.element(page.getByRole('checkbox', { name: 'View users' })).toBeChecked()
    await expect.element(page.getByRole('checkbox', { name: 'View roles' })).not.toBeChecked()
    await page.getByRole('checkbox', { name: 'View users' }).uncheck()
    await page
      .getByRole('dialog', { name: support.name })
      .getByRole('button', { name: 'Save', exact: true })
      .click()
    await expect.element(page.getByRole('button', { name: 'Confirm reduction' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect.element(page.getByRole('button', { name: 'Confirm reduction' })).not.toBeVisible()
    await expect
      .element(
        page
          .getByRole('dialog', { name: support.name })
          .getByRole('button', { name: 'Save', exact: true })
      )
      .toBeEnabled()
    await expect.element(page.getByRole('checkbox', { name: 'View users' })).not.toBeChecked()
    await page
      .getByRole('dialog', { name: support.name })
      .getByRole('button', { name: 'Reset', exact: true })
      .click()
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    await expect.element(page.getByRole('checkbox', { name: 'View users' })).toBeChecked()
    await waitFor(() => {
      const popover = document.querySelector<HTMLElement>('.ant-popconfirm')
      expect(!popover || getComputedStyle(popover).display === 'none').toBe(true)
    })
    await page.getByRole('dialog', { name: support.name }).press('Escape')
    await waitFor(() => expect(document.querySelector('.ant-drawer')).toBeNull())
    await page.getByRole('button', { name: 'Inspect', exact: true }).nth(1).click()
    await expect.element(page.getByLabel('Role name', { exact: true })).toBeDisabled()
    await expect
      .element(
        page.getByText('Admin has all permissions. This role cannot be edited.', { exact: true })
      )
      .toBeVisible()
    expect(document.querySelectorAll('.role-detail-permissions .ant-tag')).toHaveLength(1)
    expect(document.querySelector('.ant-drawer-footer')?.textContent).toBe('Close')
    await expect.element(page.getByLabel('Search permissions', { exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Collapse all', exact: true }).click()
    await page.getByRole('button', { name: 'Expand all', exact: true }).click()
    await expect.element(page.getByRole('checkbox', { name: 'View users' })).toBeDisabled()
    await page
      .getByRole('dialog', { name: protectedRole.name })
      .getByRole('button', { name: 'Close', exact: true })
      .last()
      .click()
    await waitFor(() => expect(document.querySelector('.ant-drawer')).toBeNull())
    expect(transport.requests.filter((request) => request.url === '/admin/iam/roles')).toHaveLength(
      1
    )
    expect(transport.requests.filter((request) => request.method !== 'get')).toHaveLength(0)
  }, 10_000)
})
