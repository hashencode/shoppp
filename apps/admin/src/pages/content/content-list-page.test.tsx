import React from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, rstest } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'

import { ThemeProvider } from '../../shared/contexts/theme-context'
import { useI18n } from '../../shared/contexts/i18n-context'
import { AuthTestProvider } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { ContentArticlesListPage } from './content-list-page'

void React

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  })
}
if (!window.ResizeObserver) {
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
}

const serverRecord = {
  body: [{ id: 'section.intro', kind: 'paragraph', text: 'Useful notes.' }],
  createdAt: '2026-09-23T00:00:00.000Z',
  id: 'article.useful-notes',
  inclusion: { candidate: true, live: false },
  route: '/magazine/useful-notes',
  seo: { description: 'Useful notes', title: 'Useful notes' },
  slug: 'useful-notes',
  status: 'published',
  summary: 'Useful notes',
  title: 'Useful notes',
  updatedAt: '2026-09-23T00:00:00.000Z',
  version: 2,
} as const

const requestQueries: string[] = []
let responseMode: 'data' | 'empty' | 'error' = 'data'
const server = setupServer(
  http.get('*/admin/content/articles', ({ request }) => {
    const query = new URL(request.url).searchParams.get('query') ?? ''
    requestQueries.push(query)
    if (responseMode === 'error') {
      return HttpResponse.json(
        { error: { code: 'private_failure', message: 'Private server prose' } },
        { status: 503 }
      )
    }
    return HttpResponse.json({
      data: responseMode === 'empty' ? [] : [serverRecord],
      meta: { total: responseMode === 'empty' ? 0 : 1 },
    })
  })
)

const LocaleHarness = () => {
  const { locale, setLocale } = useI18n()
  return (
    <>
      <button onClick={() => setLocale(locale === 'en-US' ? 'zh-CN' : 'en-US')}>Switch locale</button>
      <ContentArticlesListPage />
    </>
  )
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  requestQueries.length = 0
  responseMode = 'data'
  server.resetHandlers()
})
afterAll(() => server.close())

describe.sequential('ContentArticlesListPage', () => {
  it('shows released state and hides every mutation action for a read-only operator', async () => {
    renderInLocale(
      <AuthTestProvider permissions={['content.read']}>
        <ThemeProvider>
          <MemoryRouter>
            <ContentArticlesListPage />
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>
    )
    await waitFor(() => expect(screen.getByText('Useful notes')).toBeTruthy())
    expect(screen.getByText('/magazine/useful-notes')).toBeTruthy()
    expect(screen.getByText('Candidate included')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'New article' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Publish' })).toBeNull()
    expect(screen.getByRole('button', { name: 'View' })).toBeTruthy()
  })

  it('opens publisher lifecycle access in a new readonly window without write permission', async () => {
    server.use(
      http.get('*/admin/content/articles', () =>
        HttpResponse.json({
          data: [{ ...serverRecord, status: 'draft' }],
          meta: { total: 1 },
        })
      )
    )
    const originalOpen = window.open
    const open = rstest.fn()
    window.open = open as typeof window.open
    renderInLocale(
      <AuthTestProvider permissions={['content.read', 'content.publish']}>
        <ThemeProvider>
          <MemoryRouter>
            <ContentArticlesListPage />
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>
    )
    fireEvent.click(await screen.findByRole('button', { name: 'Publish' }))
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining('/content/articles/form?mode=readonly&id=article.useful-notes'),
      '_blank',
      'noopener,noreferrer'
    )
    expect(screen.getByText('Useful notes')).toBeTruthy()
    window.open = originalOpen
  })

  it('renders truthful empty and recoverable error states and does not refetch on locale changes', async () => {
    server.use(
      http.get('*/admin/content/articles', ({ request }) => {
        requestQueries.push(new URL(request.url).searchParams.get('query') ?? '')
        return HttpResponse.json({ data: [], meta: { total: 0 } })
      })
    )
    renderInLocale(
      <AuthTestProvider permissions={['content.read']}>
        <ThemeProvider>
          <MemoryRouter>
            <LocaleHarness />
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>,
      'en-US'
    )
    await waitFor(() => expect(requestQueries.length).toBeGreaterThan(0))
    expect(screen.queryByText('Useful notes')).toBeNull()
    const countBeforeLocale = requestQueries.length
    fireEvent.click(screen.getByRole('button', { name: 'Switch locale' }))
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect(requestQueries).toHaveLength(countBeforeLocale)
  })

  it('renders a safe error and retries the list request', async () => {
    let fail = true
    server.use(
      http.get('*/admin/content/articles', () =>
        fail
          ? HttpResponse.json(
              { error: { code: 'private_failure', message: 'Private server prose' } },
              { status: 503 }
            )
          : HttpResponse.json({ data: [serverRecord], meta: { total: 1 } })
      )
    )
    renderInLocale(
      <AuthTestProvider permissions={['content.read']}>
        <ThemeProvider>
          <MemoryRouter>
            <ContentArticlesListPage />
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>,
      'zh-CN'
    )
    expect(await screen.findByText('内容加载失败')).toBeTruthy()
    expect(screen.queryByText('Private server prose')).toBeNull()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: /重\s*试/ }))
    expect(await screen.findByText('Useful notes')).toBeTruthy()
  })

  it('applies a typed query only on Search and reset restores the unfiltered request', async () => {
    renderInLocale(
      <AuthTestProvider permissions={['content.read']}>
        <ThemeProvider>
          <MemoryRouter>
            <ContentArticlesListPage />
          </MemoryRouter>
        </ThemeProvider>
      </AuthTestProvider>
    )
    await waitFor(() => expect(requestQueries).toEqual(['']))
    await screen.findByText('Useful notes')
    fireEvent.change(screen.getByPlaceholderText('Search title or slug'), {
      target: { value: '  release notes  ' },
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(requestQueries).toEqual([''])
    fireEvent.click(document.querySelector('button[type="submit"]')!)
    await waitFor(() => expect(requestQueries).toEqual(['', 'release notes']))
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(requestQueries).toEqual(['', 'release notes', '']))
    expect((screen.getByPlaceholderText('Search title or slug') as HTMLInputElement).value).toBe('')
  })
})
