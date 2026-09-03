import React from 'react'
import { screen } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { AdminPermission } from '@shoppp/contracts'
import { AuthTestProvider } from '../test/auth-context-fixture'
import { renderInLocale } from '../test/render-in-locale'
import { AuthorizedHome } from './authorized-home'

void React

const renderHome = (permissions: AdminPermission[]) =>
  renderInLocale(
    <AuthTestProvider permissions={permissions}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<AuthorizedHome />} />
          <Route path="/welcome" element={<div>Setup checks destination</div>} />
          <Route path="/dashboard" element={<div>Reporting destination</div>} />
          <Route path="/catalog/products" element={<div>Catalog destination</div>} />
        </Routes>
      </MemoryRouter>
    </AuthTestProvider>
  )

describe('AuthorizedHome', () => {
  it('should prefer the guide for settings readers even with dashboard permission', async () => {
    renderHome(['settings.read', 'reporting.read'])
    expect(await screen.findByText('Setup checks destination')).toBeTruthy()
  })
  it.each([
    { permissions: ['reporting.read'] as AdminPermission[], destination: 'Reporting destination' },
    { permissions: ['catalog.read'] as AdminPermission[], destination: 'Catalog destination' },
  ])(
    'should retain the authorized business fallback for $permissions',
    async ({ permissions, destination }) => {
      renderHome(permissions)
      expect(await screen.findByText(destination)).toBeTruthy()
    }
  )
  it('should retain denied access when no business route is authorized', async () => {
    renderHome([])
    expect(
      await screen.findByText(
        'Your administrator account does not have permission for this operation.'
      )
    ).toBeTruthy()
  })
})
