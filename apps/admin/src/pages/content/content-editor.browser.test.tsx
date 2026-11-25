import React from 'react'
import { ConfigProvider } from 'antd'
import { afterEach, describe, expect, it } from '@rstest/core'
import { page } from '@rstest/browser'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'

import { installBrowserApi, renderI18nBrowser } from '../../test/i18n-browser-fixture'
import { PageEditorPage } from './page-editor-page'

void React

const record = {
  body: [{ id: 'section.intro', kind: 'paragraph', text: 'Saved story.' }],
  createdAt: '2026-09-23T00:00:00.000Z',
  id: 'page.browser-story',
  inclusion: { candidate: false, candidateStale: false, live: false, liveStale: false },
  route: '/pages/browser-story',
  seo: { description: 'Browser story', title: 'Browser story' },
  slug: 'browser-story',
  status: 'draft',
  summary: 'Browser story',
  title: 'Browser story',
  updatedAt: '2026-09-23T00:00:00.000Z',
  version: 1,
}

let transport: ReturnType<typeof installBrowserApi> | undefined

afterEach(() => {
  cleanup()
  transport?.restore()
})

describe('Content editor browser recovery', () => {
  it('keeps a publication reason after failure and requires a new version confirmation after conflict', async () => {
    let writes = 0
    let version = 1
    transport = installBrowserApi((request) => {
      if (request.method === 'get') return { data: { data: { ...record, version } } }
      if (request.method === 'post' && request.url?.endsWith('/publish')) {
        writes += 1
        return writes === 1
          ? {
              status: 503,
              data: {
                error: { code: 'temporarily_unavailable', message: 'Retry reviewed publication.' },
              },
            }
          : { status: 409, data: { error: { code: 'content_conflict', message: 'Stale version' } } }
      }
      throw new Error(`Unexpected request ${request.url}`)
    })
    const router = createMemoryRouter(
      [{ path: '/content/pages/form', element: <PageEditorPage /> }],
      { initialEntries: ['/content/pages/form?mode=readonly&id=page.browser-story'] }
    )
    renderI18nBrowser(
      <ConfigProvider theme={{ token: { motion: false } }}>
        <RouterProvider router={router} />
      </ConfigProvider>,
      ['content.read', 'content.publish'],
      'en-US'
    )
    await screen.findByLabelText('Title')
    await expect.element(page.getByLabel('Title', { exact: true })).toHaveValue('Browser story')
    await expect.element(page.getByRole('button', { name: 'Publish', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await page
      .getByLabel('Transition reason', { exact: true })
      .fill('Reviewed source for publication')
    await page.getByRole('button', { name: /^(loading )?Confirm$/ }).click()
    await expect
      .element(page.getByText('Request failed. Please try again later.', { exact: true }))
      .toBeVisible()
    await expect
      .element(page.getByLabel('Transition reason', { exact: true }))
      .toHaveValue('Reviewed source for publication')
    await page.getByRole('button', { name: /^(loading )?Confirm$/ }).click()
    await expect.element(page.getByRole('dialog')).not.toBeVisible()
    await expect.element(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled()
    expect(writes).toBe(2)
    version = 2
    await page.getByRole('button', { name: 'Reload', exact: true }).click()
    await page.getByRole('button', { name: 'Publish', exact: true }).click()
    await expect.element(page.getByText('Browser story · Saved v2', { exact: true })).toBeVisible()
    await expect.element(page.getByLabel('Transition reason', { exact: true })).toHaveValue('')
    await page.getByLabel('Transition reason', { exact: true }).press('Escape')
    await expect.element(page.getByRole('dialog')).not.toBeVisible()
    expect(writes).toBe(2)
  })
  it('preserves pasted keyboard input through validation and optimistic failure', async () => {
    let updates = 0
    transport = installBrowserApi((request) => {
      if (request.method === 'get' && request.url === '/admin/content/pages/page.browser-story') {
        return { data: { data: record } }
      }
      if (request.method === 'put' && request.url === '/admin/content/pages/page.browser-story') {
        updates += 1
        return {
          status: 409,
          data: { error: { code: 'content_conflict', message: 'PRIVATE CONFLICT DETAIL' } },
        }
      }
      throw new Error(`Unexpected request ${request.method} ${request.url}`)
    })
    const router = createMemoryRouter(
      [{ path: '/content/pages/form', element: <PageEditorPage /> }],
      { initialEntries: ['/content/pages/form?mode=modify&id=page.browser-story'] }
    )
    renderI18nBrowser(
      <RouterProvider router={router} />,
      ['content.read', 'content.write'],
      'en-US'
    )

    const paragraph = await screen.findByRole('textbox', { name: 'Paragraph 1' })
    const pasted = 'Pasted browser draft that must survive.'
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', pasted)
    fireEvent.paste(paragraph, {
      clipboardData,
    })
    fireEvent.input(paragraph, { inputType: 'insertFromPaste', target: { value: pasted } })
    const slug = page.getByRole('textbox', { name: 'Slug' })
    await slug.fill('Invalid Slug')
    fireEvent.keyDown(screen.getByLabelText('Slug'), { key: 'Enter' })
    await page.getByRole('button', { name: 'Save' }).click()
    expect(await screen.findByText('Use lowercase URL-safe text.')).toBeTruthy()
    expect(updates).toBe(0)
    expect((paragraph as HTMLTextAreaElement).value).toBe(pasted)

    await slug.fill('browser-story')
    await page.getByRole('button', { name: 'Save' }).click()
    await waitFor(() => expect(updates).toBe(1))
    expect(
      await screen.findByText('This Content record changed. Reload it before continuing.')
    ).toBeTruthy()
    expect(document.body.textContent).not.toContain('PRIVATE CONFLICT DETAIL')
    expect((paragraph as HTMLTextAreaElement).value).toBe(pasted)
  })
})
