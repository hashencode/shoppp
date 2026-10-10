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
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
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
  it('shows the newly saved published source and keeps deployment history in details', async () => {
    let submitted: unknown
    const current = { ...identity, inclusion: { candidate: true, live: true } }
    server.use(
      http.get('*/admin/settings/store-identity', () => HttpResponse.json({ data: current })),
      http.put('*/admin/settings/store-identity', async ({ request }) => {
        submitted = await request.json()
        return HttpResponse.json({
          data: { ...identity, storefrontName: 'Updated Shoppp', version: 2 },
        })
      })
    )
    renderInLocale(
      <AntApp>
        <AuthTestProvider permissions={['identity.read', 'identity.write']}>
          <MemoryRouter>
            <StoreIdentityPage />
          </MemoryRouter>
        </AuthTestProvider>
      </AntApp>
    )
    const name = await screen.findByLabelText('Storefront name')
    expect(screen.getByText('Published store details · version 1')).toBeTruthy()
    const history = screen.getByText('Deployment history includes this version.')
    expect(history.closest('details')?.open).toBe(false)
    expect(
      screen.queryByText('This exact saved version is included in the deployed Release.')
    ).toBeNull()
    expect(
      screen.getByText(
        'Saving creates a published source version for the next store preview. Existing storefront versions stay unchanged.'
      )
    ).toBeTruthy()
    fireEvent.change(name, { target: { value: 'Updated Shoppp' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save identity' }))
    expect(await screen.findByText('Published store details · version 2')).toBeTruthy()
    expect(submitted).toMatchObject({ expectedVersion: 1, storefrontName: 'Updated Shoppp' })
    expect(screen.queryByText('Deployment history includes this version.')).toBeNull()
  })
  it('preserves Form required and error associations on the primary media selector', async () => {
    server.use(http.get('*/admin/settings/store-identity', () => HttpResponse.json({ data: null })))
    renderInLocale(
      <AntApp>
        <AuthTestProvider permissions={['identity.read', 'identity.write']}>
          <MemoryRouter>
            <StoreIdentityPage />
          </MemoryRouter>
        </AuthTestProvider>
      </AntApp>
    )
    const primary = await screen.findByRole('combobox', { name: 'Primary Logo' })
    expect(primary.getAttribute('aria-required')).toBe('true')
    fireEvent.change(screen.getByLabelText('Storefront name'), { target: { value: 'Shoppp' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save identity' }))
    await waitFor(() => expect(primary.getAttribute('aria-invalid')).toBe('true'))
    const errorId = primary.getAttribute('aria-describedby')
    expect(errorId).toBeTruthy()
    await waitFor(() =>
      expect(
        errorId!
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent ?? '')
          .join(' ')
          .trim()
      ).toBeTruthy()
    )
  })

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
          <MemoryRouter>
            <StoreIdentityPage />
          </MemoryRouter>
        </AuthTestProvider>
      </AntApp>
    )
    const name = await screen.findByLabelText('Storefront name')
    fireEvent.change(name, { target: { value: 'Unsaved Shoppp' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save identity' }))
    expect(
      (await screen.findByRole('link', { name: 'Repair draft.logo' })).getAttribute('href')
    ).toBe('/storefront/themes/draft.logo')
    expect((name as HTMLInputElement).value).toBe('Unsaved Shoppp')
  })

  it('hides mutation controls with read-only domain permission', async () => {
    server.use(
      http.get('*/admin/settings/store-identity', () => HttpResponse.json({ data: identity }))
    )
    renderInLocale(
      <AntApp>
        <AuthTestProvider permissions={['identity.read']}>
          <MemoryRouter>
            <StoreIdentityPage />
          </MemoryRouter>
        </AuthTestProvider>
      </AntApp>
    )
    await screen.findByLabelText('Storefront name')
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save identity' })).toBeNull())
  })

  it('blocks all media choices and clearing while an Identity save is pending', async () => {
    const variants = ['primary', 'light', 'dark', 'compact'] as const
    const mediaIds = ['primary', 'light', 'dark', 'compact', 'favicon', 'social', 'replacement']
    const savedIdentity = {
      ...identity,
      faviconAssetId: 'asset.logo.favicon',
      logoAssets: variants.map((variant) => ({ assetId: `asset.logo.${variant}`, variant })),
      socialShareAssetId: 'asset.logo.social',
    }
    let finishSave!: () => void
    const pendingSave = new Promise<void>((resolve) => {
      finishSave = resolve
    })
    let submitted: { logoAssets: typeof savedIdentity.logoAssets } | undefined
    server.use(
      http.get('*/admin/settings/store-identity', () => HttpResponse.json({ data: savedIdentity })),
      http.get('*/admin/settings/store-identity/media', () =>
        HttpResponse.json({
          data: mediaIds.map((id) => ({
            alt: id,
            height: 80,
            id: `asset.logo.${id}`,
            productName: 'Brand',
            src: `https://media.example.test/${id}.png`,
            width: 80,
          })),
          meta: { page: 1, pageSize: 100, total: mediaIds.length },
        })
      ),
      http.put('*/admin/settings/store-identity', async ({ request }) => {
        submitted = (await request.json()) as typeof submitted
        await pendingSave
        return HttpResponse.json({
          data: { ...savedIdentity, logoAssets: submitted!.logoAssets, version: 2 },
        })
      })
    )
    renderInLocale(
      <AntApp>
        <AuthTestProvider permissions={['identity.read', 'identity.write']}>
          <MemoryRouter>
            <StoreIdentityPage />
          </MemoryRouter>
        </AuthTestProvider>
      </AntApp>
    )
    try {
      const primary = await screen.findByRole('combobox', { name: 'Primary Logo' })
      await waitFor(() => expect(screen.getAllByRole('combobox').length).toBe(6))
      fireEvent.mouseDown(primary)
      fireEvent.click(await screen.findByText('Brand · replacement'))
      await waitFor(() => expect(document.querySelectorAll('.ant-select-clear').length).toBe(5))
      fireEvent.click(screen.getByRole('button', { name: 'Save identity' }))
      await waitFor(() =>
        expect(submitted?.logoAssets).toContainEqual({
          assetId: 'asset.logo.replacement',
          variant: 'primary',
        })
      )
      await waitFor(() => {
        for (const picker of screen.getAllByRole('combobox')) {
          expect((picker as HTMLInputElement).disabled).toBe(true)
        }
      })
      expect(document.querySelectorAll('.ant-select-clear').length).toBe(0)
      fireEvent.mouseDown(primary)
      expect(primary.getAttribute('aria-expanded')).toBe('false')
      finishSave()
      await waitFor(() => {
        for (const picker of screen.getAllByRole('combobox')) {
          expect((picker as HTMLInputElement).disabled).toBe(false)
        }
      })
      expect(primary.closest('.ant-select')?.textContent).toContain('Brand · replacement')
      expect(submitted?.logoAssets).toEqual([
        { assetId: 'asset.logo.replacement', variant: 'primary' },
        { assetId: 'asset.logo.light', variant: 'light' },
        { assetId: 'asset.logo.dark', variant: 'dark' },
        { assetId: 'asset.logo.compact', variant: 'compact' },
      ])
    } finally {
      finishSave()
    }
  })
})

const server = setupServer(
  http.get('*/admin/settings/store-identity/media', () =>
    HttpResponse.json({
      data: [
        {
          id: 'asset.logo.primary',
          productName: 'Brand',
          alt: 'Primary logo',
          src: 'https://media.example.test/logo.png',
          height: 80,
          width: 80,
        },
      ],
      meta: { page: 1, pageSize: 100, total: 1 },
    })
  )
)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
