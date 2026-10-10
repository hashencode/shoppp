import React from 'react'
import { afterEach, expect, it } from '@rstest/core'
import { page } from '@rstest/browser'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { installBrowserApi, renderI18nBrowser } from '../../test/i18n-browser-fixture'
import { StoreIdentityPage } from './store-identity-page'

void React

let transport: ReturnType<typeof installBrowserApi> | undefined
afterEach(() => {
  cleanup()
  transport?.restore()
})

it(
  'selects brand media with identity permissions and saves without duplicate SEO or notes',
  { timeout: 20_000 },
  async () => {
    const identity = {
      id: 'identity.primary',
      version: 1,
      status: 'published',
      storefrontName: 'Shoppp',
      tagline: '',
      seo: { title: 'Shoppp', description: '' },
      logoAssets: [
        { variant: 'primary', assetId: 'asset.old' },
        { variant: 'light', assetId: 'asset.optional' },
      ],
      createdAt: '2026-09-30T00:00:00.000Z',
      updatedAt: '2026-09-30T00:00:00.000Z',
    }
    let submitted: Record<string, unknown> | undefined
    transport = installBrowserApi((request) => {
      if (request.method === 'get' && request.url === '/admin/settings/store-identity')
        return { data: { data: identity } }
      if (request.method === 'get' && request.url === '/admin/settings/store-identity/media')
        return {
          data: {
            data:
              request.params?.query === 'Archive'
                ? [
                    {
                      id: 'asset.logo',
                      productName: 'Archive brand',
                      alt: 'Primary logo',
                      src: 'https://media.example.test/logo.png',
                      width: 80,
                      height: 80,
                    },
                  ]
                : Array.from({ length: 100 }, (_, index) => ({
                    id: `asset.recent-${index}`,
                    productName: 'Recent brand',
                    alt: `Logo ${index}`,
                    src: 'https://media.example.test/recent.png',
                    width: 80,
                    height: 80,
                  })),
          },
        }
      if (request.method === 'put' && request.url === '/admin/settings/store-identity') {
        submitted = JSON.parse(request.data as string)
        return { data: { data: { ...identity, logoAssets: submitted!.logoAssets, version: 2 } } }
      }
      throw new Error(`Unexpected request ${request.method} ${request.url}`)
    })
    renderI18nBrowser(
      <MemoryRouter>
        <StoreIdentityPage />
      </MemoryRouter>,
      ['identity.read', 'identity.write'],
      'en-US'
    )
    expect(await screen.findByRole('combobox', { name: 'Primary Logo' })).toBeTruthy()
    await page.getByText('asset.old', { exact: true }).click()
    await page.getByLabel('Primary Logo', { exact: true }).fill('Archive')
    await page.getByText('Archive brand · Primary logo', { exact: true }).click()
    const light = screen.getByRole('combobox', { name: 'Light Logo' })
    const clear = light.closest('.ant-select')?.querySelector<HTMLElement>('.ant-select-clear')
    expect(clear).toBeTruthy()
    fireEvent.mouseDown(clear!)
    fireEvent.click(clear!)
    await page.getByRole('textbox', { name: 'SEO title', exact: true }).fill('')
    await page.getByRole('button', { name: 'Save identity', exact: true }).click()
    await waitFor(() =>
      expect(submitted).toMatchObject({
        expectedVersion: 1,
        logoAssets: [{ variant: 'primary', assetId: 'asset.logo' }],
        reason: '',
        seo: { title: '' },
      })
    )
    expect(transport.requests.every(({ url }) => !url?.startsWith('/admin/content/'))).toBe(true)
    expect(transport.requests.some(({ params }) => params?.query === 'Archive')).toBe(true)
  }
)
