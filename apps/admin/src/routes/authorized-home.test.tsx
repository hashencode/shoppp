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
    ['reporting.read'],
    ['catalog.read'],
    ['content.read'],
    ['themes.read'],
  ] as [AdminPermission][])('should expose the filtered guide to a %s-only operator', async (permission) => {
    renderHome([permission])
    expect(await screen.findByText('Setup checks destination')).toBeTruthy()
  })
  it('should expose the empty guide to an authenticated operator with no domain reads', async () => {
    renderHome([])
    expect(await screen.findByText('Setup checks destination')).toBeTruthy()
  })
})
