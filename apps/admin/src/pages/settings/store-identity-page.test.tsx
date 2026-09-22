import React from 'react'
import { App as AntApp } from 'antd'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'

import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { StoreIdentityPage } from './store-identity-page'

void React

if (!window.ResizeObserver) {
  class ResizeObserverMock { observe() {} unobserve() {} disconnect() {} }
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

const identity = {
  createdAt: '2026-09-23T00:00:00.000Z',
  id: 'identity.primary',
  logoAssets: [{ assetId: 'asset.logo.primary', variant: 'primary' }],
  seo: { description: 'Design objects', title: 'Shoppp' },
  status: 'published',
  storefrontName: 'Shoppp',
  tagline: 'Objects with a point of view',
  updatedAt: '2026-09-23T00:00:00.000Z',
  version: 1,
}

describe('StoreIdentityPage', () => {
  it('preserves attempted values and shows Theme repair links after backlink rejection', async () => {
    server.use(
      http.get('*/admin/settings/store-identity', () => HttpResponse.json({ data: identity })),
      http.put('*/admin/settings/store-identity', () =>
        HttpResponse.json(
          {
            error: {
              code: 'store_identity_logo_in_use',
              details: {
                backlinks: [{ href: '/storefront/themes/draft.logo', id: 'draft.logo' }],
              },
              message: 'A mutable Theme draft still uses this Logo.',
            },
          },
          { status: 409 }
        )
      )
    )
    renderInLocale(
      <AntApp>
        <AuthTestProvider permissions={['identity.read', 'identity.write']}>
          <MemoryRouter><StoreIdentityPage /></MemoryRouter>
        </AuthTestProvider>
      </AntApp>
    )
    const name = await screen.findByLabelText('Storefront name')
    fireEvent.change(name, { target: { value: 'Unsaved Shoppp' } })
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Refresh the brand' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save identity' }))
    expect((await screen.findByRole('link', { name: 'Repair draft.logo' })).getAttribute('href')).toBe(
      '/storefront/themes/draft.logo'
    )
    expect((name as HTMLInputElement).value).toBe('Unsaved Shoppp')
  })

  it('hides mutation controls with read-only domain permission', async () => {
    server.use(
      http.get('*/admin/settings/store-identity', () => HttpResponse.json({ data: identity }))
    )
    renderInLocale(
      <AntApp>
        <AuthTestProvider permissions={['identity.read']}>
          <MemoryRouter><StoreIdentityPage /></MemoryRouter>
        </AuthTestProvider>
      </AntApp>
    )
    await screen.findByLabelText('Storefront name')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save identity' })).toBeNull())
  })
})

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
