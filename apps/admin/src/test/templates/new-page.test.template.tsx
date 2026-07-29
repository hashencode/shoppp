import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter, Routes } from 'react-router-dom'
import { AuthContext } from '../../infrastructure/auth/auth-context'
import { AuthProvider } from '../../infrastructure/auth/auth-context'
import { templateHandlers } from '../../infrastructure/msw/handlers/template-handlers'
// import { XxxManagementPage } from '../../pages/<domain>/<page>/xxx-management-page'
// import { XxxFormPage } from '../../pages/<domain>/<page>/xxx-form-page'

void React

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

const renderListPage = () =>
  render(
    <MemoryRouter>
      <AuthProvider>{/* <XxxManagementPage /> */}</AuthProvider>
    </MemoryRouter>
  )

const renderFormPage = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <AuthProvider>
        <Routes>
          {/* <Route path="/<business>/form" element={<XxxFormPage />} /> */}
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  )

const renderListPageWithViewerRole = () =>
  render(
    <MemoryRouter>
      <AuthContext.Provider
        value={{
          isAuthenticated: true,
          role: 'viewer',
          displayName: '访客',
          accountName: 'guest',
          setRole: () => undefined,
          setDisplayName: () => undefined,
          setAccountName: () => undefined,
          login: () => undefined,
          logout: () => undefined,
        }}
      >
        {/* <XxxManagementPage /> */}
      </AuthContext.Provider>
    </MemoryRouter>
  )

describe('XxxManagementPage', () => {
  it('should load list and render rows when request succeeds', async () => {
    renderListPage()

    await waitFor(() => {
      // expect(screen.getByText('示例记录')).toBeTruthy()
    })
  })

  it('should not re-query until submit when filter value changes', async () => {
    let requestCount = 0
    server.use(
      http.get('*/api/v1/<resource>', () => {
        requestCount += 1
        return HttpResponse.json({
          code: 200,
          data: [],
          message: 'OK',
          timestamp: '2026-01-01T00:00:00+08:00',
        })
      })
    )

    renderListPage()

    await waitFor(() => {
      expect(requestCount).toBe(1)
    })

    // fireEvent.change(screen.getByPlaceholderText('请输入关键字'), { target: { value: 'abc' } })
    // fireEvent.click(screen.getByRole('button', { name: /查\s*询/ }))

    await waitFor(() => {
      // expect(requestCount).toBe(2)
    })
  })

  it('should open add form page when clicking create button', async () => {
    const originalOpen = window.open
    const calls: unknown[][] = []
    window.open = ((...args: unknown[]) => {
      calls.push(args)
      return null
    }) as typeof window.open

    renderListPage()

    // fireEvent.click(screen.getByRole('button', { name: /新建|新增/ }))
    // expect(calls[0]?.[0]).toBe('/<business>/form?mode=add')

    window.open = originalOpen
  })

  it('should show error state when list request fails', async () => {
    server.use(
      http.get('*/api/v1/<resource>', () =>
        HttpResponse.json(
          { code: 500, data: null, message: '服务异常', timestamp: '2026-01-01T00:00:00+08:00' },
          { status: 500 }
        )
      )
    )

    renderListPage()

    await waitFor(() => {
      // expect(screen.getByText('<页面>加载失败')).toBeTruthy()
      // expect(screen.getByText('请求失败，请稍后重试。')).toBeTruthy()
    })
  })

  it('should hide write actions when role is viewer', async () => {
    renderListPageWithViewerRole()

    await waitFor(() => {
      // expect(screen.getByText('示例记录')).toBeTruthy()
    })

    // expect(screen.queryByRole('button', { name: /新建|新增/ })).toBeNull()
    // expect(screen.queryByRole('button', { name: /编辑|删除/ })).toBeNull()
  })
})

describe('XxxFormPage', () => {
  it('should render form fields in add mode', async () => {
    renderFormPage('/<business>/form?mode=add')

    await waitFor(() => {
      // expect(screen.getByText('<字段A>')).toBeTruthy()
      // expect(screen.getByRole('button', { name: /保\s*存/ })).toBeTruthy()
    })
  })

  it('should show route param error when mode is invalid', async () => {
    renderFormPage('/<business>/form?mode=invalid')

    await waitFor(() => {
      expect(screen.getByText('路由参数错误')).toBeTruthy()
    })
  })

  it('should block submit actions in readonly mode', async () => {
    renderFormPage('/<business>/form?mode=readonly&id=1')

    await waitFor(() => {
      // expect(screen.getByText('<字段A>')).toBeTruthy()
    })

    expect(screen.queryByRole('button', { name: /保\s*存/ })).toBeNull()
  })
})
