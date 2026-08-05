import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, beforeAll, afterAll, afterEach, beforeEach } from '@rstest/core'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../../infrastructure/auth/auth-context'
import { authContextFixture } from '../../../test/auth-context-fixture'
import { templateHandlers } from '../../../infrastructure/msw/handlers/template-handlers'
import { LIST_REFRESH_EVENT } from '../../../shared/constants/list-refresh-channel'
import { BasicFormPage } from './basic-form-page'

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

const channelMessages: unknown[] = []
class BroadcastChannelMock {
  name: string
  onmessage: ((event: MessageEvent) => void) | null = null
  constructor(name: string) {
    this.name = name
  }
  postMessage(data: unknown) {
    channelMessages.push(data)
  }
  close() {}
}
window.BroadcastChannel = BroadcastChannelMock as unknown as typeof BroadcastChannel

const server = setupServer(...templateHandlers)

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})

beforeEach(() => {
  channelMessages.length = 0
})

const renderPage = (entry: string) => {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthContext.Provider
        value={authContextFixture({
          accountName: 'admin',
          displayName: '管理员',
          permissions: ['catalog.read', 'catalog.write'],
        })}
      >
        <Routes>
          <Route path="/template/list/table/form" element={<BasicFormPage />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

describe('BasicFormPage', () => {
  it('shows route parameter error state when mode is invalid', async () => {
    renderPage('/template/list/table/form?mode=invalid')

    await waitFor(() => {
      expect(screen.getByText('路由参数错误')).toBeTruthy()
      expect(screen.getByText('mode 参数非法，仅支持 add / modify / readonly。')).toBeTruthy()
    })
  })

  it('renders add mode form and toggles public users when selecting 部分公开', async () => {
    const { container } = renderPage('/template/list/table/form?mode=add')

    await waitFor(() => {
      expect(screen.getByText('基础表单')).toBeTruthy()
    })

    const formClassName = container.querySelector('form')?.className ?? ''
    expect(formClassName).toContain('max-w-[800px]')
    expect(formClassName).not.toContain('md:w-fit')
    expect((container.querySelector('#title') as HTMLInputElement).className).not.toContain('md:!w')

    fireEvent.click(screen.getByRole('radio', { name: '部分公开' }))

    await waitFor(() => {
      expect(screen.getByText('公开给')).toBeTruthy()
    })
  })

  it('publishes list refresh event after successful add submit', async () => {
    const { container } = renderPage('/template/list/table/form?mode=add')

    await waitFor(() => {
      expect(screen.getByText('基础表单')).toBeTruthy()
    })

    const titleInput = container.querySelector('#title') as HTMLInputElement
    const goalInput = container.querySelector('#goal') as HTMLTextAreaElement
    const standardInput = container.querySelector('#standard') as HTMLTextAreaElement
    const saveButton = screen.getByRole('button', { name: /保\s*存/ })

    fireEvent.change(titleInput, { target: { value: '新增目标' } })
    fireEvent.change(goalInput, { target: { value: '目标描述' } })
    fireEvent.change(standardInput, { target: { value: '衡量标准' } })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(
        channelMessages.some(
          (item) =>
            typeof item === 'object' &&
            item !== null &&
            (item as { type?: string }).type === LIST_REFRESH_EVENT.REFRESH_LIST
        )
      ).toBe(true)
    })
  })

  it('does not publish list refresh when add submit fails', async () => {
    server.use(
      http.post('*/api/template/forms', () =>
        HttpResponse.json(
          { errorCode: 'QUERY_SERVER_ERROR', message: '提交失败' },
          { status: 500 }
        )
      )
    )

    const { container } = renderPage('/template/list/table/form?mode=add')

    await waitFor(() => {
      expect(screen.getByText('基础表单')).toBeTruthy()
    })

    const titleInput = container.querySelector('#title') as HTMLInputElement
    const goalInput = container.querySelector('#goal') as HTMLTextAreaElement
    const standardInput = container.querySelector('#standard') as HTMLTextAreaElement
    const saveButton = screen.getByRole('button', { name: /保\s*存/ })

    fireEvent.change(titleInput, { target: { value: '新增目标' } })
    fireEvent.change(goalInput, { target: { value: '目标描述' } })
    fireEvent.change(standardInput, { target: { value: '衡量标准' } })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(
        channelMessages.some(
          (item) =>
            typeof item === 'object' &&
            item !== null &&
            (item as { type?: string }).type === LIST_REFRESH_EVENT.REFRESH_LIST
        )
      ).toBe(false)
    })
  })
})
