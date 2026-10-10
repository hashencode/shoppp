import React from 'react'
import { App } from 'antd'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter, useNavigate } from 'react-router-dom'

import { ThemeProvider } from '../../shared/contexts/theme-context'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
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
      expect(submitted).toMatchObject({
        title: 'Our Studio Stories',
        slug: 'our-story',
        reason: '',
        seo: { title: '' },
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
    fireEvent.change(paragraph, { target: { value: 'Unsaved story.' } })
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Edited business title' } })
    fireEvent.blur(screen.getByLabelText('Title'))
    expect((screen.getByLabelText('Slug') as HTMLInputElement).value).toBe('about')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(submitted).toMatchObject({
        body: [{ id: 'section.intro', kind: 'paragraph', text: 'Unsaved story.' }],
        expectedVersion: 3,
        reason: '',
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
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect((screen.getByLabelText('Title') as HTMLInputElement).disabled).toBe(true)
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
    expect(await screen.findByText('已发布')).toBeTruthy()
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
    await screen.findByRole('button', { name: 'Publish' })
    fireEvent.change(screen.getByLabelText('Transition reason'), {
      target: { value: 'Publish reviewed copy' },
    })
    expect(screen.getByRole('button', { name: 'Publish' }).hasAttribute('disabled')).toBe(false)
    expect((screen.getByLabelText('Title') as HTMLInputElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
    expect(
      await screen.findByText(
        'This content becomes available to future storefront versions. The current storefront is unchanged.'
      )
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'OK' }).hasAttribute('disabled')).toBe(false)
    expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() =>
      expect(publication).toMatchObject({
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
    fireEvent.change(screen.getByLabelText('Transition reason'), {
      target: { value: 'Publish reviewed copy' },
    })
    expect((screen.getByRole('button', { name: 'Publish' }) as HTMLButtonElement).disabled).toBe(
      true
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
})
