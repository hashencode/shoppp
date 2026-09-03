import React from 'react'
import { page } from '@rstest/browser'
import { afterEach, describe, expect, it } from '@rstest/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AxiosError } from 'axios'
import { AdminUiProvider } from './admin-ui-provider'
import { AuthContext } from '../infrastructure/auth/auth-context'
import { apiClient } from '../infrastructure/http/api-client'
import { authContextFixture } from '../test/auth-context-fixture'
import { I18nProvider, LANGUAGE_STORAGE_KEY } from '../shared/contexts/i18n-context'
import { ThemeProvider, THEME_STORAGE_KEY } from '../shared/contexts/theme-context'
import { AppShell } from '../shared/layout/app-shell'
import { UserDetailPage } from '../pages/iam/user-detail-page'

void React
const originalAdapter = apiClient.defaults.adapter

afterEach(() => {
  cleanup()
  apiClient.defaults.adapter = originalAdapter
  localStorage.clear()
})

const renderRoute = (child: React.ReactNode, route = '/') => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en-US')
  localStorage.setItem(THEME_STORAGE_KEY, 'light')
  return render(
    <I18nProvider>
      <ThemeProvider>
        <AdminUiProvider>
          <AuthContext.Provider
            value={authContextFixture({ accountName: 'operator@example.test' })}
          >
            <MemoryRouter initialEntries={[route]}>
              <Routes>
                <Route path="/" element={<AppShell />}>
                  <Route index element={child} />
                  <Route path="access/users/:id" element={child} />
                </Route>
              </Routes>
            </MemoryRouter>
          </AuthContext.Provider>
        </AdminUiProvider>
      </ThemeProvider>
    </I18nProvider>
  )
}

describe('Ant App feedback context', () => {
  it('announces a committed theme and language once in their new context', async () => {
    const view = renderRoute(<div>Workspace content</div>)
    expect(screen.getByText('Workspace content')).toBeTruthy()
    fireEvent.click(screen.getAllByText('operator@example.test', { exact: true })[0])
    await expect.element(page.getByText('Appearance', { exact: true })).toBeVisible()
    fireEvent.mouseEnter(screen.getByText('Appearance', { exact: true }))
    fireEvent.click(await screen.findByText('Dark', { exact: true }))
    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark')
      expect(screen.getAllByText('Switched to Dark.')).toHaveLength(1)
    })
    const notice = screen.getByText('Switched to Dark.').closest('.ant-message-notice')!
    const color = getComputedStyle(notice).backgroundColor.match(/\d+/g)!.slice(0, 3).map(Number)
    expect(color.every((value) => value < 100)).toBe(true)

    fireEvent.click(screen.getAllByText('operator@example.test', { exact: true })[0])
    fireEvent.mouseEnter(await screen.findByText('Language', { exact: true }))
    fireEvent.click(await screen.findByText('Simplified Chinese', { exact: true }))
    await waitFor(() => {
      expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('zh-CN')
      expect(screen.getAllByText('语言已切换为简体中文。')).toHaveLength(1)
    })
    view.unmount()
    expect(document.querySelector('.ant-message')).toBeNull()
  }, 15_000)

  it('requires the existing IAM modal confirmation and keeps 401 feedback in the page', async () => {
    const role = {
      id: 'role_support',
      key: 'support',
      name: 'Support',
      permissions: ['iam.users.read'],
      enabled: true,
      protected: false,
      system: false,
      version: 1,
      description: 'Support',
    }
    const user = {
      id: 'identity_test',
      email: 'user@example.test',
      displayName: 'Test User',
      role,
      status: 'active',
      version: 2,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }
    let writes = 0
    apiClient.defaults.adapter = async (config) => {
      const response = {
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        data: {
          data: config.url?.endsWith('/roles')
            ? { items: [role], page: 1, pageSize: 100, total: 1 }
            : user,
        },
      }
      if (config.method === 'patch') {
        writes++
        throw new AxiosError(
          'Login required',
          'ERR_BAD_REQUEST',
          config,
          {},
          {
            ...response,
            status: 401,
            data: {
              error: { code: 'admin_login_required', message: 'Administrator login is required.' },
            },
          }
        )
      }
      return response
    }
    renderRoute(<UserDetailPage />, '/access/users/identity_test')
    await page.getByLabel('Status', { exact: true }).click()
    await page.getByText('Disabled', { exact: true }).click()
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await expect.element(page.getByRole('dialog', { name: 'Confirm access change' })).toBeVisible()
    expect(writes).toBe(0)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect(writes).toBe(0)
    await page.getByRole('button', { name: 'Save changes', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm change', exact: true }).click()
    await waitFor(() => expect(writes).toBe(1))
    await expect
      .element(page.getByText('Administrator login is required.', { exact: true }))
      .toBeVisible()
    expect(document.querySelector('.ant-message-notice-error')).toBeNull()
  })
})
