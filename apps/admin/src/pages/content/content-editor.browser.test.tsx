import React from 'react'
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
    renderI18nBrowser(<RouterProvider router={router} />, ['content.read', 'content.write'], 'en-US')

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
    await page.getByRole('textbox', { name: 'Reason' }).fill('Save pasted browser draft')
    await page.getByRole('button', { name: 'Save' }).click()
    await waitFor(() => expect(updates).toBe(1))
    expect(await screen.findByText('This Content record changed. Reload it before continuing.')).toBeTruthy()
    expect(document.body.textContent).not.toContain('PRIVATE CONFLICT DETAIL')
    expect((paragraph as HTMLTextAreaElement).value).toBe(pasted)
  })
})
