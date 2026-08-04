import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext, type AuthContextValue } from '../infrastructure/auth/auth-context'
import { RedirectIfAuthenticated, RequireAuth } from './auth-route-guards'

void React

const renderWithAuth = (status: AuthContextValue['status'], entry: string) =>
  render(
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
  it('renders a loading state while verifying the session', () => {
    renderWithAuth('loading', '/protected')
    expect(screen.getByRole('status')).toBeTruthy()
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
})
