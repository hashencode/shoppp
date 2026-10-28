import { App } from 'antd'
import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'

import { AuthTestProvider } from '../../test/auth-context-fixture'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import { ReviewModerationPage } from './review-moderation-page'
import { renderInLocale } from '../../test/render-in-locale'

void React

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      addListener: () => undefined,
      removeListener: () => undefined,
    }),
  })
}

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

const review = {
  body: 'A clear review about this product and how it fit.',
  displayName: 'Sample shopper',
  id: 'review-001',
  moderatedAt: null,
  moderatedBy: null,
  moderationReason: null,
  productId: 'product-001',
  rating: 4,
  status: 'pending',
  submittedAt: '2026-09-17T00:00:00.000Z',
}

const decisions: unknown[] = []
const server = setupServer(
  http.get('*/admin/catalog/reviews', () =>
    HttpResponse.json({ data: { items: [review], nextCursor: null } })
  ),
  http.get('*/admin/catalog/reviews/review-001', () => HttpResponse.json({ data: review })),
  http.post('*/admin/catalog/reviews/review-001/moderate', async ({ request }) => {
    decisions.push(await request.json())
    return HttpResponse.json({ data: { ...review, status: 'approved' } })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  decisions.length = 0
})
afterAll(() => server.close())

describe('ReviewModerationPage', () => {
  it('does not restart the list from a stale-data recovery action while a cursor page is loading', async () => {
    let reads = 0
    let finishPage!: () => void
    const pendingPage = new Promise<void>((resolve) => {
      finishPage = resolve
    })
    server.use(
      http.get('*/admin/catalog/reviews', async ({ request }) => {
        reads += 1
        if (new URL(request.url).searchParams.has('after')) {
          await pendingPage
          return HttpResponse.json({
            data: {
              items: [{ ...review, id: 'review-002', displayName: 'Next shopper' }],
              nextCursor: null,
            },
          })
        }
        if (reads === 2)
          return HttpResponse.json(
            { error: { code: 'read_failed', message: 'Try reviews again.' } },
            { status: 503 }
          )
        return HttpResponse.json({ data: { items: [review], nextCursor: 'next-page' } })
      })
    )
    renderInLocale(
      <MemoryRouter>
        <AuthTestProvider>
          <ThemeProvider>
            <ReviewModerationPage />
          </ThemeProvider>
        </AuthTestProvider>
      </MemoryRouter>
    )
    await screen.findByText('Sample shopper · 4/5')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await screen.findByText('Refresh failed. Showing previously loaded data.')
    fireEvent.click(screen.getByRole('button', { name: 'Load more reviews' }))
    await waitFor(() => expect(reads).toBe(3))
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    finishPage()
    await screen.findByText('Next shopper · 4/5')
    expect(reads).toBe(3)
    expect(screen.getByText('Sample shopper · 4/5')).toBeTruthy()
    expect(decisions).toEqual([])
  })
  it('retains pending reviews after a failed refresh and retries only the read', async () => {
    let reads = 0
    server.use(
      http.get('*/admin/catalog/reviews', () => {
        reads += 1
        return reads === 2
          ? HttpResponse.json(
              { error: { code: 'read_failed', message: 'Try reviews again.' } },
              { status: 503 }
            )
          : HttpResponse.json({ data: { items: [review], nextCursor: null } })
      })
    )
    renderInLocale(
      <MemoryRouter>
        <AuthTestProvider>
          <ThemeProvider>
            <ReviewModerationPage />
          </ThemeProvider>
        </AuthTestProvider>
      </MemoryRouter>
    )
    await screen.findByText('Sample shopper · 4/5')
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    await screen.findByText('Refresh failed. Showing previously loaded data.')
    expect(screen.getByText('Sample shopper · 4/5')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    await waitFor(() =>
      expect(screen.queryByText('Refresh failed. Showing previously loaded data.')).toBeNull()
    )
    expect(screen.getByText('Sample shopper · 4/5')).toBeTruthy()
    expect(reads).toBe(3)
    expect(decisions).toEqual([])
  })
  it('reviews a pending submission and states the release delay after approval', async () => {
    render(
      <MemoryRouter>
        <AuthTestProvider>
          <ThemeProvider>
            <App>
              <ReviewModerationPage />
            </App>
          </ThemeProvider>
        </AuthTestProvider>
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { level: 4, name: '评价审核' })).toBeTruthy()
    expect(screen.getAllByRole('heading', { level: 4 })).toHaveLength(1)
    expect(
      screen.queryByText('Only approved reviews can be included in a later Catalog release.')
    ).toBeNull()
    expect(await screen.findByText('Sample shopper · 4/5')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /评\s*价/ }))
    expect(await screen.findByText('审核评价')).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: '审核原因' }), {
      target: { value: 'Content reviewed' },
    })
    expect(
      screen.getByText('批准结果会立即保存，公开页面会在新的商品目录版本部署后更新。')
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /批\s*准/ }))
    await waitFor(() =>
      expect(decisions).toEqual([{ decision: 'approved', reason: 'Content reviewed' }])
    )
    expect(await screen.findByText('评价已批准，将在新的商品目录版本部署后公开。')).toBeTruthy()
  })
  it('rejects with the complete trimmed decision and retries a failed write without losing the reason', async () => {
    let fail = true
    server.use(
      http.post('*/admin/catalog/reviews/review-001/moderate', async ({ request }) => {
        decisions.push(await request.json())
        return fail
          ? HttpResponse.json(
              { error: { code: 'review_write_failed', message: 'Retry moderation.' } },
              { status: 503 }
            )
          : HttpResponse.json({ data: { ...review, status: 'rejected' } })
      })
    )
    render(
      <MemoryRouter>
        <AuthTestProvider>
          <ThemeProvider>
            <App>
              <ReviewModerationPage />
            </App>
          </ThemeProvider>
        </AuthTestProvider>
      </MemoryRouter>
    )
    await screen.findByText('Sample shopper · 4/5')
    fireEvent.click(screen.getByRole('button', { name: /评\s*价/ }))
    const reason = await screen.findByRole('textbox', { name: '审核原因' })
    expect((screen.getByRole('button', { name: /拒\s*绝/ }) as HTMLButtonElement).disabled).toBe(
      true
    )
    expect(decisions).toEqual([])
    fireEvent.change(reason, { target: { value: '  Rejected spam  ' } })
    fireEvent.click(screen.getByRole('button', { name: /拒\s*绝/ }))
    await screen.findByText('Retry moderation.')
    expect((reason as HTMLTextAreaElement).value).toBe('  Rejected spam  ')
    expect(decisions).toEqual([{ decision: 'rejected', reason: 'Rejected spam' }])
    fail = false
    fireEvent.click(screen.getByRole('button', { name: /拒\s*绝/ }))
    await screen.findByText('评价已拒绝。')
    expect(decisions).toEqual([
      { decision: 'rejected', reason: 'Rejected spam' },
      { decision: 'rejected', reason: 'Rejected spam' },
    ])
  })
})
