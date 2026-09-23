import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { renderInLocale } from '../../test/render-in-locale'
import { SetupGuideReturn } from './setup-guide-return'

void React
const renderReturn = (path: string, basename = '/') =>
  renderInLocale(
    <MemoryRouter basename={basename} initialEntries={[path]}>
      <Routes>
        <Route path="/welcome" element={<div>Guide reloaded</div>} />
        <Route path="*" element={<SetupGuideReturn />} />
      </Routes>
    </MemoryRouter>
  )
describe('SetupGuideReturn', () => {
  it.each([
    '/settings/launch',
    '/settings/shipping',
    '/settings/identity',
    '/settings/contact',
    '/settings/policies',
    '/catalog/products',
    '/catalog/products/form?mode=add',
    '/catalog/collections',
    '/catalog/collections/form?mode=add',
    '/content/pages',
    '/content/pages/new',
    '/content/articles',
    '/content/articles/new',
    '/storefront/navigation',
    '/storefront/navigation/header',
    '/storefront/themes',
    '/storefront/themes/draft-1',
    '/inventory',
    '/orders',
    '/orders/order-1',
  ])('returns from %s using the fixed guide route', (path) => {
    renderReturn(`${path}${path.includes('?') ? '&' : '?'}from=setup-guide`)
    fireEvent.click(screen.getByRole('link', { name: 'Back to store setup guide' }))
    expect(screen.getByText('Guide reloaded')).toBeTruthy()
  })
  it.each([
    '/settings/launch?from=https://outside.example',
    '/settings/launch',
    '/settings/launch/unknown?from=setup-guide',
  ])('ignores unsupported return context %s', (path) => {
    renderReturn(path)
    expect(screen.queryByRole('link')).toBeNull()
  })
  it('preserves the deployment base in the fixed return link', () => {
    renderReturn('/admin/settings/shipping?from=setup-guide', '/admin')
    expect(screen.getByRole('link').getAttribute('href')).toBe('/admin/welcome')
  })
})
