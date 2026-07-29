import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeAll, afterAll, afterEach } from '@rstest/core'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { AuthProvider } from '../../../infrastructure/auth/auth-context'
import { templateHandlers } from '../../../infrastructure/msw/handlers/template-handlers'
import { ThemeProvider } from '../../../shared/contexts/theme-context'
import { TableQueryPage } from './table-query-page'

void React

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
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

if (!window.BroadcastChannel) {
  class BroadcastChannelMock {
    name: string
    onmessage: ((event: MessageEvent) => void) | null = null
    constructor(name: string) {
      this.name = name
    }
    postMessage(data: unknown) {
      void data
    }
    close() {}
  }

  window.BroadcastChannel = BroadcastChannelMock as unknown as typeof BroadcastChannel
}

const server = setupServer(...templateHandlers)

const renderPage = () => {
  return render(
    <AuthProvider>
      <ThemeProvider>
        <TableQueryPage />
      </ThemeProvider>
    </AuthProvider>
  )
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})

describe('TableQueryPage', () => {
  it('loads list data from template handlers', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('TradeCode 0')).toBeTruthy()
      expect(screen.getByText('规则列表')).toBeTruthy()
    })
  })

  it('opens add form page when clicking 新增规则', async () => {
    const openSpy = (window.open = ((...args: unknown[]) => {
      void args
      return null
    }) as typeof window.open)

    const mockCalls: unknown[][] = []
    window.open = ((...args: unknown[]) => {
      mockCalls.push(args)
      return null
    }) as typeof window.open

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('TradeCode 0')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: /新增规则/ }))

    expect(mockCalls.length).toBe(1)
    expect(mockCalls[0]?.[0]).toBe('/template/list/table/form?mode=add')

    window.open = openSpy
  })

  it('shows error state when list request fails', async () => {
    server.use(
      http.get('*/api/template/rules', () =>
        HttpResponse.json({ errorCode: 'QUERY_SERVER_ERROR', message: '服务异常' }, { status: 500 })
      )
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('规则列表加载失败')).toBeTruthy()
      expect(screen.getByText('请求失败，请稍后重试。')).toBeTruthy()
    })
  })

  it('shows partial state when list response is partial', async () => {
    server.use(
      http.get('*/api/template/rules', () =>
        HttpResponse.json({
          data: [
            {
              key: '1',
              name: 'TradeCode X',
              desc: 'partial',
              callNo: 1,
              status: 1,
              updatedAt: new Date().toISOString(),
            },
          ],
          partial: true,
          partialMessage: '仅部分返回',
        })
      )
    )

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('当前仅返回部分数据')).toBeTruthy()
      expect(screen.getByText('仅部分返回')).toBeTruthy()
      expect(screen.getByText('TradeCode X')).toBeTruthy()
    })
  })

  it('does not re-query when changing filters until submit', async () => {
    let requestCount = 0
    server.use(
      http.get('*/api/template/rules', () => {
        requestCount += 1
        return HttpResponse.json({
          data: [
            {
              key: '1',
              name: 'TradeCode A',
              desc: 'default',
              callNo: 1,
              status: 1,
              updatedAt: new Date().toISOString(),
            },
          ],
          total: 1,
          success: true,
        })
      })
    )

    renderPage()

    await waitFor(() => {
      expect(requestCount).toBe(1)
    })

    fireEvent.change(screen.getByPlaceholderText('请输入'), { target: { value: 'alpha' } })

    await waitFor(() => {
      expect(requestCount).toBe(1)
    })

    const form = document.querySelector('form')
    expect(form).toBeTruthy()
    fireEvent.submit(form as HTMLFormElement)

    await waitFor(() => {
      expect(requestCount).toBe(2)
    })
  })

  it('does not re-query when only row selection changes', async () => {
    let requestCount = 0
    server.use(
      http.get('*/api/template/rules', () => {
        requestCount += 1
        return HttpResponse.json({
          data: [
            {
              key: '1',
              name: 'TradeCode A',
              desc: 'default',
              callNo: 1,
              status: 1,
              updatedAt: new Date().toISOString(),
            },
          ],
          total: 1,
          success: true,
        })
      })
    )

    renderPage()

    await waitFor(() => {
      expect(requestCount).toBe(1)
      expect(screen.getByText('TradeCode A')).toBeTruthy()
    })

    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[1]!)

    await waitFor(() => {
      expect(requestCount).toBe(1)
    })
  })
})
