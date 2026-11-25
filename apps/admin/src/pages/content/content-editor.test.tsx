import React from 'react'
import { App, ConfigProvider } from 'antd'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter, useNavigate } from 'react-router-dom'

import { ThemeProvider } from '../../shared/contexts/theme-context'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { ArticleEditorPage } from './article-editor-page'
import { PageEditorPage } from './page-editor-page'

void React

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  })
}
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

const page = {
  body: [{ id: 'section.intro', kind: 'paragraph', text: 'About our studio.' }],
  createdAt: '2026-09-23T00:00:00.000Z',
  id: 'page.about',
  inclusion: { candidate: false, live: false },
  route: '/about',
  seo: { description: 'About our studio', title: 'About' },
  slug: 'about',
  status: 'draft',
  summary: 'Our story',
  title: 'About',
  updatedAt: '2026-09-23T00:00:00.000Z',
  version: 3,
}

let submitted: unknown
const server = setupServer(
  http.get('*/admin/content/pages/page.about', () => HttpResponse.json({ data: page })),
  http.put('*/admin/content/pages/page.about', async ({ request }) => {
    submitted = await request.json()
    return HttpResponse.json(
      { error: { code: 'content_conflict', message: 'Reload before saving.' } },
      { status: 409 }
    )
  })
)

const RouteChangeHarness = () => {
  const navigate = useNavigate()
  return (
    <>
      <button onClick={() => navigate('/content/pages/form?mode=modify&id=page.second')}>
        Open second page
      </button>
      <PageEditorPage />
    </>
  )
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  submitted = undefined
  server.resetHandlers()
})
afterAll(() => server.close())

describe('Content editor', () => {
  it.each(['page', 'article'] as const)(
    'requires a successful reload after a %s conflict even after reset or a failed reload',
    async (kind) => {
      const namespace = kind === 'page' ? 'pages' : 'articles'
      const current = {
        ...page,
        id: `${kind}.recovery`,
        ...(kind === 'article' ? { coverAssetId: null } : {}),
      }
      let reads = 0
      const writes: unknown[] = []
      server.use(
        http.get(`*/admin/content/${namespace}/${current.id}`, () => {
          reads += 1
          return reads === 2
            ? HttpResponse.json(
                { error: { code: 'temporarily_unavailable', message: 'Retry later.' } },
                { status: 503 }
              )
            : HttpResponse.json({ data: { ...current, version: reads === 1 ? 3 : 4 } })
        }),
        http.get('*/admin/catalog/collections/media', () => HttpResponse.json({ data: [] })),
        http.get('*/admin/content/media', () => HttpResponse.json({ data: [] })),
        http.post(`*/admin/content/${namespace}/${current.id}/publish`, async ({ request }) => {
          writes.push(await request.json())
          return writes.length === 1
            ? HttpResponse.json(
                { error: { code: 'content_conflict', message: 'Stale version.' } },
                { status: 409 }
              )
            : HttpResponse.json({ data: { ...current, version: 5, status: 'published' } })
        })
      )
      renderInLocale(
        <AuthTestProvider permissions={['content.read', 'content.write', 'content.publish']}>
          <ThemeProvider>
            <App>
              <MemoryRouter
                initialEntries={[`/content/${namespace}/form?mode=modify&id=${current.id}`]}
              >
                <ConfigProvider theme={{ token: { motion: false } }}>
                  {kind === 'page' ? <PageEditorPage /> : <ArticleEditorPage />}
                </ConfigProvider>
              </MemoryRouter>
            </App>
          </ThemeProvider>
        </AuthTestProvider>
      )
      fireEvent.click(await screen.findByRole('button', { name: 'Publish' }))
      fireEvent.change(await screen.findByLabelText('Transition reason'), {
        target: { value: 'Original reviewed version' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
      await screen.findByText('This Content record changed. Reload it before continuing.')
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(
        true
      )
      fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
      await screen.findByText('Request failed. Please try again later.')
      expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
      expect(writes).toHaveLength(1)
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
      await waitFor(() =>
        expect(
          (screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled
        ).toBe(false)
      )
      fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
      expect(await screen.findByText('About · Saved v4')).toBeTruthy()
      expect((screen.getByLabelText('Transition reason') as HTMLTextAreaElement).value).toBe('')
      fireEvent.change(screen.getByLabelText('Transition reason'), {
        target: { value: 'Reviewed new version' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
      await waitFor(() =>
        expect(writes).toEqual([
          {
            confirm: true,
            expectedVersion: 3,
            reason: 'Original reviewed version',
            redirectFromOldSlug: true,
          },
          {
            confirm: true,
            expectedVersion: 4,
            reason: 'Reviewed new version',
            redirectFromOldSlug: true,
          },
        ])
      )
    }
  )

  it.each(['page', 'article'] as const)(
    'restores saved %s lifecycle actions after a confirmed reset without writing',
    async (kind) => {
      const namespace = kind === 'page' ? 'pages' : 'articles'
      const current = {
        ...page,
        id: `${kind}.reset`,
        ...(kind === 'article' ? { coverAssetId: null } : {}),
      }
      let writes = 0
      server.use(
        http.get(`*/admin/content/${namespace}/${current.id}`, () =>
          HttpResponse.json({ data: current })
        ),
        http.get('*/admin/catalog/collections/media', () => HttpResponse.json({ data: [] })),
        http.post(`*/admin/content/${namespace}/${current.id}/publish`, () => {
          writes += 1
          return HttpResponse.json({ data: { ...current, status: 'published' } })
        })
      )
      renderInLocale(
        <AuthTestProvider permissions={['content.read', 'content.write', 'content.publish']}>
          <ThemeProvider>
            <App>
              <MemoryRouter
                initialEntries={[`/content/${namespace}/form?mode=modify&id=${current.id}`]}
              >
                {kind === 'page' ? <PageEditorPage /> : <ArticleEditorPage />}
              </MemoryRouter>
            </App>
          </ThemeProvider>
        </AuthTestProvider>
      )
      await waitFor(() =>
        expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('About')
      )
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Unsaved title' } })
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Publish' }).hasAttribute('disabled')).toBe(true)
      )
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
      await waitFor(() =>
        expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('About')
      )
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Publish' }).hasAttribute('disabled')).toBe(false)
      )
      fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
      expect(await screen.findByRole('dialog')).toBeTruthy()
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
      expect(writes).toBe(0)
    }
  )

  it.each(['page', 'article'] as const)(
    'retains a failed %s confirmation and locks a pending write',
    async (kind) => {
      const namespace = kind === 'page' ? 'pages' : 'articles'
      const current = {
        ...page,
        id: `${kind}.confirmation`,
        ...(kind === 'article' ? { coverAssetId: null } : {}),
      }
      let attempts = 0
      let release!: () => void
      const pending = new Promise<void>((resolve) => {
        release = resolve
      })
      let body: unknown
      server.use(
        http.get(`*/admin/content/${namespace}/${current.id}`, () =>
          HttpResponse.json({ data: current })
        ),
        http.get('*/admin/catalog/collections/media', () => HttpResponse.json({ data: [] })),
        http.post(`*/admin/content/${namespace}/${current.id}/publish`, async ({ request }) => {
          attempts += 1
          body = await request.json()
          if (attempts === 1) {
            await pending
            return HttpResponse.json(
              { error: { code: 'temporarily_unavailable', message: 'Retry later.' } },
              { status: 503 }
            )
          }
          return HttpResponse.json({ data: { ...current, status: 'published' } })
        })
      )
      renderInLocale(
        <AuthTestProvider permissions={['content.read', 'content.publish']}>
          <ThemeProvider>
            <App>
              <MemoryRouter
                initialEntries={[`/content/${namespace}/form?mode=readonly&id=${current.id}`]}
              >
                {kind === 'page' ? <PageEditorPage /> : <ArticleEditorPage />}
              </MemoryRouter>
            </App>
          </ThemeProvider>
        </AuthTestProvider>
      )
      fireEvent.click(await screen.findByRole('button', { name: 'Publish' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
      expect(attempts).toBe(0)
      fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
      const reason = await screen.findByRole('textbox', { name: 'Transition reason' })
      fireEvent.change(reason, { target: { value: '  x  ' } })
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
      await waitFor(() => expect(reason.getAttribute('aria-invalid')).toBe('true'))
      expect(attempts).toBe(0)
      fireEvent.change(reason, { target: { value: 'a'.repeat(501) } })
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
      await waitFor(() => expect(reason.getAttribute('aria-invalid')).toBe('true'))
      expect(attempts).toBe(0)
      fireEvent.change(reason, { target: { value: '  Reviewed for publication  ' } })
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
      await waitFor(() => expect(attempts).toBe(1))
      expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(
        true
      )
      expect((reason as HTMLTextAreaElement).disabled).toBe(true)
      await act(async () => {
        release()
        await pending
      })
      expect(
        await within(screen.getByRole('dialog')).findByText(
          'Request failed. Please try again later.'
        )
      ).toBeTruthy()
      expect((reason as HTMLTextAreaElement).value).toBe('  Reviewed for publication  ')
      fireEvent.click(await screen.findByRole('button', { name: /^(loading )?Confirm$/ }))
      await waitFor(() => expect(attempts).toBe(2))
      expect(body).toEqual({
        confirm: true,
        expectedVersion: 3,
        reason: 'Reviewed for publication',
        redirectFromOldSlug: true,
      })
    }
  )

  it('invalidates an open confirmation when the route changes', async () => {
    server.use(
      http.get('*/admin/content/pages/page.second', () =>
        HttpResponse.json({ data: { ...page, id: 'page.second', title: 'Second page' } })
      )
    )
    renderInLocale(
      <AuthTestProvider permissions={['content.read', 'content.write', 'content.publish']}>
        <ThemeProvider>
          <App>
            <MemoryRouter initialEntries={['/content/pages/form?mode=readonly&id=page.about']}>
              <RouteChangeHarness />
            </MemoryRouter>
          </App>
        </ThemeProvider>
      </AuthTestProvider>
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }))
    fireEvent.change(await screen.findByRole('textbox', { name: 'Transition reason' }), {
      target: { value: 'Old confirmation' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open second page' }))
    await screen.findByDisplayValue('Second page')
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(
        false
      )
    )
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(await screen.findByText('Second page · Saved v3')).toBeTruthy()
    expect(
      (screen.getByRole('textbox', { name: 'Transition reason' }) as HTMLTextAreaElement).value
    ).toBe('')
    expect(submitted).toBeUndefined()
  })

  it('prefills only a new English slug and saves without duplicate SEO or notes', async () => {
    server.use(
      http.post('*/admin/content/pages', async ({ request }) => {
        submitted = await request.json()
        return HttpResponse.json({ data: page }, { status: 201 })
      })
    )
    renderInLocale(
      <AuthTestProvider permissions={['content.read', 'content.write']}>
        <ThemeProvider>
          <App>
            <MemoryRouter initialEntries={['/content/pages/form?mode=add']}>
              <PageEditorPage />
            </MemoryRouter>
          </App>
        </ThemeProvider>
      </AuthTestProvider>
    )
    await act(async () => {})
    const title = screen.getByLabelText('Title')
    const slug = screen.getByLabelText('Slug') as HTMLInputElement
    fireEvent.change(title, { target: { value: 'Our Studio & Story' } })
    fireEvent.blur(title)
    expect(slug.value).toBe('our-studio-story')
    fireEvent.change(slug, { target: { value: 'our-story' } })
    fireEvent.change(title, { target: { value: 'Our Studio Stories' } })
    fireEvent.blur(title)
    expect(slug.value).toBe('our-story')
    fireEvent.click(screen.getByRole('button', { name: 'Add Paragraph' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Paragraph 1' }), {
      target: { value: 'Our story.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(submitted).toEqual({
        body: [
          {
            id: expect.stringMatching(/^section\.[0-9a-f-]{36}$/),
            kind: 'paragraph',
            text: 'Our story.',
          },
        ],
        title: 'Our Studio Stories',
        slug: 'our-story',
        reason: '',
        seo: { title: '', description: '' },
        summary: '',
      })
    )
  })

  it('leaves a new non-English slug for the author to supply', async () => {
    renderInLocale(
      <AuthTestProvider permissions={['content.read', 'content.write']}>
        <ThemeProvider>
          <App>
            <MemoryRouter initialEntries={['/content/pages/form?mode=add']}>
              <PageEditorPage />
            </MemoryRouter>
          </App>
        </ThemeProvider>
      </AuthTestProvider>
    )
    await act(async () => {})
    const title = screen.getByLabelText('Title')
    fireEvent.change(title, { target: { value: '关于我们的工作室' } })
    fireEvent.blur(title)
    expect((screen.getByLabelText('Slug') as HTMLInputElement).value).toBe('')
  })

  it('preserves unsaved structured content when optimistic save fails', async () => {
    renderInLocale(
      <AuthTestProvider permissions={['content.read', 'content.write']}>
        <ThemeProvider>
          <App>
            <MemoryRouter initialEntries={['/content/pages/form?mode=modify&id=page.about']}>
              <PageEditorPage />
            </MemoryRouter>
          </App>
        </ThemeProvider>
      </AuthTestProvider>
    )
    const paragraph = await screen.findByRole('textbox', { name: 'Paragraph 1' })
    expect((screen.getByLabelText('Content status') as HTMLInputElement).value).toBe('Draft')
    expect((screen.getByLabelText('Content status') as HTMLInputElement).readOnly).toBe(true)
    expect((screen.getByLabelText('Saved version') as HTMLInputElement).value).toBe('v3')
    fireEvent.change(paragraph, { target: { value: 'Unsaved story.' } })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Edited business title' } })
    fireEvent.blur(screen.getByLabelText('Title'))
    expect((screen.getByLabelText('Slug') as HTMLInputElement).value).toBe('about')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(submitted).toEqual({
        body: [{ id: 'section.intro', kind: 'paragraph', text: 'Unsaved story.' }],
        expectedVersion: 3,
        reason: '',
        seo: { description: 'About our studio', title: 'About' },
        slug: 'about',
        summary: 'Our story',
        title: 'Edited business title',
      })
    )
    expect(
      await screen.findByText('This Content record changed. Reload it before continuing.')
    ).toBeTruthy()
    expect((paragraph as HTMLTextAreaElement).value).toBe('Unsaved story.')
  })

  it('does not expose publication controls without content.publish', async () => {
    renderInLocale(
      <AuthTestProvider permissions={['content.read', 'content.write']}>
        <ThemeProvider>
          <App>
            <MemoryRouter initialEntries={['/content/pages/form?mode=modify&id=page.about']}>
              <PageEditorPage />
            </MemoryRouter>
          </App>
        </ThemeProvider>
      </AuthTestProvider>
    )
    expect(((await screen.findByLabelText('Title')) as HTMLInputElement).value).toBe('About')
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
  })

  it('provides lifecycle controls in readonly mode to a publisher without write access', async () => {
    renderInLocale(
      <AuthTestProvider permissions={['content.read', 'content.publish']}>
        <ThemeProvider>
          <App>
            <MemoryRouter initialEntries={['/content/pages/form?mode=readonly&id=page.about']}>
              <PageEditorPage />
            </MemoryRouter>
          </App>
        </ThemeProvider>
      </AuthTestProvider>
    )
    expect(await screen.findByRole('button', { name: 'Publish' })).toBeTruthy()
    expect((screen.getByLabelText('Content status') as HTMLInputElement).readOnly).toBe(true)
    expect((screen.getByLabelText('Saved version') as HTMLInputElement).readOnly).toBe(true)
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(
      false
    )
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect((screen.getByLabelText('Title') as HTMLInputElement).disabled).toBe(true)
    await act(async () => {
      fireEvent.submit(screen.getByLabelText('Title').closest('form')!)
    })
    expect(submitted).toBeUndefined()
  })

  it('renders the editor lifecycle status with a complete translation key', async () => {
    server.use(
      http.get('*/admin/content/pages/page.about', () =>
        HttpResponse.json({
          data: { ...page, status: 'published', inclusion: { candidate: true, live: true } },
        })
      )
    )
    renderInLocale(
      <AuthTestProvider permissions={['content.read']}>
        <ThemeProvider>
          <App>
            <MemoryRouter initialEntries={['/content/pages/form?mode=readonly&id=page.about']}>
              <PageEditorPage />
            </MemoryRouter>
          </App>
        </ThemeProvider>
      </AuthTestProvider>,
      'zh-CN'
    )
    expect(((await screen.findByLabelText('内容状态')) as HTMLInputElement).value).toBe('已发布')
    expect(screen.queryByText('published')).toBeNull()
    const details = screen.getByText('内容版本详情').closest('details')
    expect(details?.open).toBe(false)
    expect(screen.getByText('此来源曾被已部署的店铺版本使用。')).toBeTruthy()
    expect(screen.queryByText('已上线')).toBeNull()
  })

  it('publishes a saved source with its version confirmation and future-storefront boundary', async () => {
    let publication: unknown
    server.use(
      http.post('*/admin/content/pages/page.about/publish', async ({ request }) => {
        publication = await request.json()
        return HttpResponse.json({
          data: { ...page, status: 'published', inclusion: { candidate: true, live: true } },
        })
      })
    )
    renderInLocale(
      <AuthTestProvider permissions={['content.read', 'content.publish']}>
        <ThemeProvider>
          <App>
            <MemoryRouter initialEntries={['/content/pages/form?mode=readonly&id=page.about']}>
              <PageEditorPage />
            </MemoryRouter>
          </App>
        </ThemeProvider>
      </AuthTestProvider>
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }))
    fireEvent.change(await screen.findByLabelText('Transition reason'), {
      target: { value: 'Publish reviewed copy' },
    })
    expect(screen.getByRole('button', { name: 'Publish' }).hasAttribute('disabled')).toBe(false)
    expect((screen.getByLabelText('Title') as HTMLInputElement).disabled).toBe(true)
    expect(
      await screen.findByText(
        'This content becomes available to future storefront versions. The current storefront is unchanged.'
      )
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirm' }).hasAttribute('disabled')).toBe(false)
    expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() =>
      expect(publication).toEqual({
        confirm: true,
        expectedVersion: 3,
        reason: 'Publish reviewed copy',
        redirectFromOldSlug: true,
      })
    )
    expect(
      await screen.findByText('Content published for future storefront versions.')
    ).toBeTruthy()
    expect(screen.queryByText('Live included')).toBeNull()
  })

  it('blocks lifecycle actions while authoring input is unsaved', async () => {
    renderInLocale(
      <AuthTestProvider permissions={['content.read', 'content.write', 'content.publish']}>
        <ThemeProvider>
          <App>
            <MemoryRouter initialEntries={['/content/pages/form?mode=modify&id=page.about']}>
              <PageEditorPage />
            </MemoryRouter>
          </App>
        </ThemeProvider>
      </AuthTestProvider>
    )
    fireEvent.change(await screen.findByLabelText('Title'), { target: { value: 'Unsaved title' } })
    expect(screen.queryByRole('textbox', { name: 'Transition reason' })).toBeNull()
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(
        true
      )
    )
  })

  it('binds async detail state to the current route generation', async () => {
    let firstStarted = false
    server.use(
      http.get('*/admin/content/pages/page.about', async () => {
        firstStarted = true
        await new Promise((resolve) => setTimeout(resolve, 80))
        return HttpResponse.json({ data: page })
      }),
      http.get('*/admin/content/pages/page.second', () =>
        HttpResponse.json({
          data: { ...page, id: 'page.second', slug: 'second', title: 'Second page' },
        })
      )
    )
    renderInLocale(
      <AuthTestProvider permissions={['content.read', 'content.write']}>
        <ThemeProvider>
          <App>
            <MemoryRouter initialEntries={['/content/pages/form?mode=modify&id=page.about']}>
              <RouteChangeHarness />
            </MemoryRouter>
          </App>
        </ThemeProvider>
      </AuthTestProvider>
    )
    await waitFor(() => expect(firstStarted).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: 'Open second page' }))
    await waitFor(() =>
      expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Second page')
    )
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Second page')
  })
  it.each(['add', 'modify', 'readonly'] as const)(
    'preserves the article %s contract including its nullable cover and structured body',
    async (mode) => {
      const article = { ...page, id: 'article.about', route: '/articles/about', coverAssetId: null }
      const requests: unknown[] = []
      server.use(
        http.get('*/admin/catalog/collections/media', () => HttpResponse.json({ data: [] })),
        http.get('*/admin/content/articles/article.about', () =>
          HttpResponse.json({ data: article })
        ),
        http.post('*/admin/content/articles', async ({ request }) => {
          requests.push(await request.json())
          return HttpResponse.json({ data: article }, { status: 201 })
        }),
        http.put('*/admin/content/articles/article.about', async ({ request }) => {
          requests.push(await request.json())
          return HttpResponse.json({ data: article })
        })
      )
      renderInLocale(
        <AuthTestProvider permissions={['content.read', 'content.write']}>
          <ThemeProvider>
            <App>
              <MemoryRouter
                initialEntries={[
                  `/content/articles/form?mode=${mode}${mode === 'add' ? '' : '&id=article.about'}`,
                ]}
              >
                <ArticleEditorPage />
              </MemoryRouter>
            </App>
          </ThemeProvider>
        </AuthTestProvider>
      )
      const title = await screen.findByLabelText('Title')
      await act(async () => {})
      if (mode !== 'add')
        await waitFor(() => expect((title as HTMLInputElement).value).toBe('About'))
      if (mode === 'readonly') {
        await act(async () => {
          fireEvent.submit(title.closest('form')!)
        })
        expect((title as HTMLInputElement).disabled).toBe(true)
        expect(requests).toEqual([])
        return
      }
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Article story' } })
      if (mode === 'add') {
        fireEvent.change(screen.getByLabelText('Slug'), { target: { value: 'article-story' } })
        fireEvent.click(screen.getByRole('button', { name: 'Add Paragraph' }))
      }
      fireEvent.change(screen.getByRole('textbox', { name: 'Paragraph 1' }), {
        target: { value: 'Article body' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Save' }))
      await waitFor(() => expect(requests.length).toBe(1))
      await waitFor(() =>
        expect(requests).toEqual([
          {
            body: [
              {
                id:
                  mode === 'add'
                    ? expect.stringMatching(/^section\.[0-9a-f-]{36}$/)
                    : 'section.intro',
                kind: 'paragraph',
                text: 'Article body',
              },
            ],
            coverAssetId: null,
            ...(mode === 'modify' ? { expectedVersion: 3 } : {}),
            reason: '',
            seo:
              mode === 'add'
                ? { description: '', title: '' }
                : { description: 'About our studio', title: 'About' },
            slug: mode === 'add' ? 'article-story' : 'about',
            summary: mode === 'add' ? '' : 'Our story',
            title: 'Article story',
          },
        ])
      )
    }
  )

  it.each([
    { kind: 'page' as const, action: 'archive' as const },
    { kind: 'article' as const, action: 'publish' as const },
    { kind: 'article' as const, action: 'archive' as const },
  ])(
    'preserves the complete $kind $action lifecycle request independently of readonly field writes',
    async ({ kind, action }) => {
      const namespace = kind === 'page' ? 'pages' : 'articles'
      const current = {
        ...page,
        id: `${kind}.about`,
        status: action === 'archive' ? 'published' : 'draft',
        ...(kind === 'article' ? { coverAssetId: null } : {}),
      }
      let submitted: unknown
      server.use(
        http.get(`*/admin/content/${namespace}/${kind}.about`, () =>
          HttpResponse.json({ data: current })
        ),
        http.get('*/admin/catalog/collections/media', () => HttpResponse.json({ data: [] })),
        http.post(`*/admin/content/${namespace}/${kind}.about/${action}`, async ({ request }) => {
          submitted = await request.json()
          return HttpResponse.json({
            data: { ...current, status: action === 'archive' ? 'archived' : 'published' },
          })
        })
      )
      renderInLocale(
        <AuthTestProvider permissions={['content.read', 'content.publish']}>
          <ThemeProvider>
            <App>
              <MemoryRouter
                initialEntries={[`/content/${namespace}/form?mode=readonly&id=${kind}.about`]}
              >
                {kind === 'page' ? <PageEditorPage /> : <ArticleEditorPage />}
              </MemoryRouter>
            </App>
          </ThemeProvider>
        </AuthTestProvider>
      )
      const button = await screen.findByRole('button', {
        name: action === 'archive' ? 'Archive' : 'Publish',
      })
      fireEvent.click(button)
      fireEvent.change(await screen.findByLabelText('Transition reason'), {
        target: { value: 'Reviewed source transition' },
      })
      expect(submitted).toBeUndefined()
      fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
      await waitFor(() =>
        expect(submitted).toEqual({
          confirm: true,
          expectedVersion: 3,
          reason: 'Reviewed source transition',
          redirectFromOldSlug: action === 'publish',
        })
      )
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    }
  )
})
