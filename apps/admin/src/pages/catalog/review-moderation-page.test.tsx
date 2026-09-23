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
})
