import React from 'react'
import { act, screen } from '@testing-library/react'
import { describe, expect, it, rstest } from '@rstest/core'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../infrastructure/auth/auth-context'
import { PermissionGuard } from '../shared/components/permission-guard'
import { RedirectIfAuthenticated, RequireAuth } from './auth-route-guards'
import { templateRoutes } from './routes.config'
import { renderInLocale } from '../test/render-in-locale'

void React

const renderWithAuth = (status: AuthContextValue['status'], entry: string) =>
  renderInLocale(
    <AuthContext.Provider
      value={{
        accountName: '',
        displayName: '',
        isAuthenticated: status === 'authenticated',
        isLoading: status === 'loading',
        login: async () => undefined,
        logout: () => undefined,
        permissions: undefined,
        principalKind: undefined,
        refreshSession: async () => undefined,
        role: 'unauthenticated',
        session: null,
        sessionError: null,
        status,
      }}
    >
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <RequireAuth>
                <div>PROTECTED_PAGE</div>
              </RequireAuth>
            }
          />
          <Route
            path="/login"
            element={
              <RedirectIfAuthenticated>
                <div>ACCESS_STATE_PAGE</div>
              </RedirectIfAuthenticated>
            }
          />
          <Route path="/" element={<div>HOME_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )

describe('auth-route-guards', () => {
  it('waits three seconds before rendering a viewport-centered text-free session spinner', async () => {
    rstest.useFakeTimers()
    try {
      const view = renderWithAuth('loading', '/protected')

      expect(screen.queryByText('Verifying login status…')).toBeNull()
      expect(view.container.querySelector('.ant-spin')).toBeNull()

      await act(async () => rstest.advanceTimersByTime(2_999))
      expect(view.container.querySelector('.ant-spin')).toBeNull()

      await act(async () => rstest.advanceTimersByTime(1))
      expect(view.container.querySelector('.ant-spin')).toBeTruthy()
      expect(screen.getByTestId('auth-loading-indicator').className).toContain('fixed')
      expect(screen.getByTestId('auth-loading-indicator').className).toContain('inset-0')
      expect(screen.getByTestId('auth-loading-indicator').className).toContain('items-center')
      expect(screen.getByTestId('auth-loading-indicator').className).toContain('justify-center')
      expect(screen.queryByText('Verifying login status…')).toBeNull()
    } finally {
      rstest.useRealTimers()
    }
  })

  it.each(['login-required', 'disabled', 'forbidden'] as const)(
    'redirects %s sessions to the login page',
    (status) => {
      renderWithAuth(status, '/protected')
      expect(screen.getByText('ACCESS_STATE_PAGE')).toBeTruthy()
    }
  )

  it('redirects authenticated users away from the login page', () => {
    renderWithAuth('authenticated', '/login')
    expect(screen.getByText('HOME_PAGE')).toBeTruthy()
  })

  it('registers lazy read-guarded routes for theme selection and exact draft editing', () => {
    expect(templateRoutes.find(({ key }) => key === 'storefront-themes')).toMatchObject({
      inMenu: true,
      path: '/storefront/themes',
      permission: 'themes.read',
    })
    expect(templateRoutes.find(({ key }) => key === 'storefront-theme-editor')).toMatchObject({
      inMenu: false,
      path: '/storefront/themes/:draftId',
      permission: 'themes.read',
    })
  })

  it('registers the independent Collection list and editor behind catalog.read', () => {
    expect(templateRoutes.find(({ key }) => key === 'catalog-collections')).toMatchObject({
      inMenu: false,
      path: '/catalog/collections',
      permission: 'catalog.read',
    })
    expect(templateRoutes.find(({ key }) => key === 'catalog-collection-form')).toMatchObject({
      inMenu: false,
      path: '/catalog/collections/form',
      permission: 'catalog.read',
    })
  })

  it('registers direct Content lists and editors behind content.read', () => {
    expect(templateRoutes.find(({ key }) => key === 'content-pages')).toMatchObject({
      inMenu: true,
      path: '/content/pages',
      permission: 'content.read',
    })
    expect(templateRoutes.find(({ key }) => key === 'content-page-form')).toMatchObject({
      inMenu: false,
      path: '/content/pages/form',
      permission: 'content.read',
    })
    expect(templateRoutes.find(({ key }) => key === 'content-articles')).toMatchObject({
      inMenu: true,
      path: '/content/articles',
      permission: 'content.read',
    })
  })

  it('registers reusable Navigation behind its independent read permission', () => {
    expect(templateRoutes.find(({ key }) => key === 'storefront-navigation')).toMatchObject({
      breadcrumb: ['Storefront', 'Navigation'],
      inMenu: true,
      menuMode: 'standalone',
      path: '/storefront/navigation',
      permission: 'navigation.read',
    })
  })

  it('uses the API permission set as the authority for theme routes', () => {
    const renderPermission = (permissions: readonly 'themes.read'[]) =>
      renderInLocale(
        <AuthContext.Provider
          value={{
            accountName: 'operator@example.com',
            displayName: 'Operator',
            isAuthenticated: true,
            isLoading: false,
            login: async () => undefined,
            logout: () => undefined,
            permissions,
            principalKind: 'human',
            refreshSession: async () => undefined,
            role: 'operations',
            session: null,
            sessionError: null,
            status: 'authenticated',
          }}
        >
          <MemoryRouter>
            <PermissionGuard permission="themes.read">
              <div>THEME_EDITOR_ROUTE</div>
            </PermissionGuard>
          </MemoryRouter>
        </AuthContext.Provider>
      )

    const allowed = renderPermission(['themes.read'])
    expect(screen.getByText('THEME_EDITOR_ROUTE')).toBeTruthy()
    allowed.unmount()

    renderPermission([])
    expect(screen.queryByText('THEME_EDITOR_ROUTE')).toBeNull()
    expect(screen.getByText('Access denied')).toBeTruthy()
  })
})
