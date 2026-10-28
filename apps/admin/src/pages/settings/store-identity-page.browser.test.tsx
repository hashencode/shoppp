import React from 'react'
import { afterEach, expect, it } from '@rstest/core'
import { page } from '@rstest/browser'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import {
  installBrowserApi,
  renderI18nBrowser,
  switchBrowserLocale,
} from '../../test/i18n-browser-fixture'
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

it(
  'constrains content, keeps actions fixed, focuses invalid fields and fully resets edits',
  { timeout: 20_000 },
  async () => {
    const identity = {
      id: 'identity.primary',
      version: 3,
      status: 'published',
      storefrontName: 'Saved Shop',
      tagline: 'Saved tagline',
      seo: { title: '', description: '' },
      logoAssets: [{ variant: 'primary', assetId: 'asset.saved' }],
      createdAt: '2026-10-27T00:00:00.000Z',
      updatedAt: '2026-10-27T00:00:00.000Z',
    }
    transport = installBrowserApi((request) => {
      if (request.method === 'get' && request.url === '/admin/settings/store-identity')
        return { data: { data: identity } }
      if (request.method === 'put' && request.url === '/admin/settings/store-identity')
        return { status: 409, data: { error: { code: 'store_identity_version_conflict' } } }
      if (request.method === 'get' && request.url === '/admin/settings/store-identity/media')
        return {
          data: {
            data: [
              { id: 'asset.saved', productName: 'Brand', alt: 'Saved logo' },
              { id: 'asset.draft', productName: 'Brand', alt: 'Draft logo' },
            ],
          },
        }
      throw new Error(`Unexpected request ${request.method} ${request.url}`)
    })
    renderI18nBrowser(
      <div style={{ width: 1100, maxWidth: '100%' }}>
        <MemoryRouter>
          <StoreIdentityPage />
        </MemoryRouter>
      </div>,
      ['identity.read', 'identity.write'],
      'en-US'
    )
    const name = (await screen.findByLabelText('Storefront name')) as HTMLInputElement
    const form = name.closest('form')!
    const bodies = form.querySelectorAll<HTMLElement>('.ant-card-body')
    expect(bodies).toHaveLength(2)
    for (const body of bodies) {
      expect(body.getBoundingClientRect().width).toBeLessThanOrEqual(800)
      expect(body.scrollWidth).toBeLessThanOrEqual(body.clientWidth)
    }
    expect(bodies[0].getBoundingClientRect().left).toBe(bodies[1].getBoundingClientRect().left)
    const toolbar = form.querySelector<HTMLElement>('.ax-fixed-toolbar')!
    expect(getComputedStyle(toolbar).position).toBe('fixed')
    expect(Math.round(toolbar.getBoundingClientRect().bottom)).toBe(window.innerHeight)
    expect(toolbar.getBoundingClientRect().top).toBeGreaterThan(0)

    await page.getByLabel('Storefront name', { exact: true }).fill('')
    await page.getByRole('button', { name: 'Save identity', exact: true }).click()
    await waitFor(() => expect(name.getAttribute('aria-invalid')).toBe('true'))
    await waitFor(() => expect(document.activeElement).toBe(name))
    await page
      .getByRole('textbox', { name: 'Notes (optional)', exact: true })
      .fill('Unsubmitted note')
    await page.getByText('Brand · Saved logo', { exact: true }).click()
    await page.getByText('Brand · Draft logo', { exact: true }).click()
    const reads = transport.requests.filter((request) => request.method === 'get').length
    await switchBrowserLocale()
    await switchBrowserLocale()
    expect((screen.getByLabelText('Notes (optional)') as HTMLInputElement).value).toBe(
      'Unsubmitted note'
    )
    expect(transport.requests.filter((request) => request.method === 'get')).toHaveLength(reads)
    await page.getByRole('button', { name: 'Reset changes', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm', exact: true }).click()
    await waitFor(() =>
      expect((screen.getByLabelText('Storefront name') as HTMLInputElement).value).toBe(
        'Saved Shop'
      )
    )
    expect((screen.getByLabelText('Notes (optional)') as HTMLInputElement).value).toBe('')
    expect(screen.getByLabelText('Storefront name').getAttribute('aria-invalid')).toBeNull()
    const primary = screen.getByRole('combobox', { name: 'Primary Logo' }) as HTMLInputElement
    expect(primary.value).toBe('')
    expect(primary.closest('.ant-select')?.textContent).toMatch(/asset\.saved|Brand · Saved logo/)
    expect(transport.requests.filter((request) => request.method === 'put')).toHaveLength(0)
    await page.getByLabel('Storefront name', { exact: true }).fill('Edited Shop')
    screen.getByRole('combobox', { name: 'Social-share image' }).scrollIntoView()
    await page.getByRole('button', { name: 'Save identity', exact: true }).click()
    const reload = await screen.findByRole('button', { name: 'Reload' })
    await waitFor(() => expect(document.activeElement).toBe(reload))
    expect(reload.getBoundingClientRect().top).toBeGreaterThanOrEqual(0)
    expect(reload.getBoundingClientRect().bottom).toBeLessThanOrEqual(window.innerHeight)
    await page.getByRole('button', { name: 'Reload', exact: true }).click()
    const reloadConfirmation = page
      .getByRole('tooltip')
      .filter({ hasText: 'Reload and discard local edits' })
    await reloadConfirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect((screen.getByLabelText('Storefront name') as HTMLInputElement).value).toBe('Edited Shop')
    await page.getByRole('button', { name: 'Reload', exact: true }).click()
    await reloadConfirmation.getByRole('button', { name: 'Confirm', exact: true }).click()
    await waitFor(() =>
      expect((screen.getByLabelText('Storefront name') as HTMLInputElement).value).toBe(
        'Saved Shop'
      )
    )
    expect(screen.queryByText('Store details could not be saved')).toBeNull()
  }
)
