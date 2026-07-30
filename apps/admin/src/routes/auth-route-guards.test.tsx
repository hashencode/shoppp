import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../infrastructure/auth/auth-context'
import { PermissionGuard } from '../shared/components/permission-guard'
import { RedirectIfAuthenticated, RequireAuth } from './auth-route-guards'
import { templateRoutes } from './routes.config'

void React

const renderWithAuth = (isAuthenticated: boolean, entry: string) =>
  render(
    <AuthContext.Provider
      value={{
        isAuthenticated,
        role: 'admin',
        displayName: '管理员',
        accountName: 'admin',
        setRole: () => undefined,
        setDisplayName: () => undefined,
        setAccountName: () => undefined,
        login: () => undefined,
        logout: () => undefined,
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
                <div>LOGIN_PAGE</div>
              </RedirectIfAuthenticated>
            }
          />
          <Route path="/" element={<div>HOME_PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  )

describe('auth-route-guards', () => {
  it('redirects anonymous users to login when visiting protected route', () => {
    renderWithAuth(false, '/protected')

    expect(screen.getByText('LOGIN_PAGE')).toBeTruthy()
  })

  it('redirects authenticated users away from login', () => {
    renderWithAuth(true, '/login')

    expect(screen.getByText('HOME_PAGE')).toBeTruthy()
  })

  it('registers lazy read-guarded routes for theme selection and exact draft editing', () => {
    expect(
      templateRoutes.find(({ key }) => key === 'storefront-themes')
    ).toMatchObject({
      inMenu: true,
      path: '/storefront/themes',
      permission: 'themes.read',
    })
    expect(
      templateRoutes.find(({ key }) => key === 'storefront-theme-editor')
    ).toMatchObject({
      inMenu: false,
      path: '/storefront/themes/:draftId',
      permission: 'themes.read',
    })
  })

  it('allows read-only theme inspection while rejecting roles without theme access', () => {
    const renderPermission = (role: 'operations' | 'support') =>
      render(
        <AuthContext.Provider
          value={{
            isAuthenticated: true,
            role,
            displayName: role,
            accountName: role,
            setRole: () => undefined,
            setDisplayName: () => undefined,
            setAccountName: () => undefined,
            login: () => undefined,
            logout: () => undefined,
          }}
        >
          <MemoryRouter>
            <PermissionGuard permission="themes.read">
              <div>THEME_EDITOR_ROUTE</div>
            </PermissionGuard>
          </MemoryRouter>
        </AuthContext.Provider>
      )

    const allowed = renderPermission('operations')
    expect(screen.getByText('THEME_EDITOR_ROUTE')).toBeTruthy()
    allowed.unmount()

    renderPermission('support')
    expect(screen.queryByText('THEME_EDITOR_ROUTE')).toBeNull()
    expect(screen.getByText('Access denied')).toBeTruthy()
  })
})
