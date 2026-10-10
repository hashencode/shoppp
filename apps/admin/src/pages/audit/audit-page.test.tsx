import type { AuditEvent } from '@shoppp/contracts'
import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router-dom'

import { AuthContext } from '../../infrastructure/auth/auth-context'
import { PermissionGuard } from '../../shared/components/permission-guard'
import { templateRoutes } from '../../routes/routes.config'
import { useI18n } from '../../shared/contexts/i18n-context'
import { ThemeProvider } from '../../shared/contexts/theme-context'
import { LIST_AUTO_REFRESH_STORAGE_KEY } from '../../shared/contexts/theme-context'
import { authContextFixture } from '../../test/auth-context-fixture'
import { renderInLocale } from '../../test/render-in-locale'
import { AuditPage } from './audit-page'

void React

if (!window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

const auditEvent = (id: string, action = `orders.${id}`): AuditEvent => ({
  action,
  actorId: 'identity_operator',
  actorType: 'admin',
  createdAt: '2026-09-15T08:00:00.000Z',
  id,
  metadata: {},
  reason: null,
  requestId: `request-${id}`,
  result: 'succeeded',
  targetId: id,
  targetType: 'order',
})

type AuditResponse = { data: AuditEvent[]; nextCursor: string | null }

let requests: Record<string, string>[] = []
let respond: (query: Record<string, string>) => AuditResponse = () => ({
  data: [auditEvent('first')],
  nextCursor: 'cursor-next',
})

const server = setupServer(
  http.get('*/admin/audit', ({ request }) => {
    const query = Object.fromEntries(new URL(request.url).searchParams.entries())
    requests.push(query)
    const result = respond(query)
    return HttpResponse.json({ data: result.data, meta: { nextCursor: result.nextCursor } })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  requests = []
  respond = () => ({ data: [auditEvent('first')], nextCursor: 'cursor-next' })
  window.localStorage.clear()
})
afterAll(() => server.close())

const renderAudit = (permissions: readonly 'audit.read'[] = ['audit.read']) =>
  renderInLocale(
    <AuthContext.Provider value={authContextFixture({ permissions })}>
      <ThemeProvider>
        <MemoryRouter>
          <PermissionGuard permission="audit.read">
            <AuditPage />
          </PermissionGuard>
        </MemoryRouter>
      </ThemeProvider>
    </AuthContext.Provider>
  )

const LocaleSwitch = () => {
  const { locale, setLocale } = useI18n()
  return (
    <button type="button" onClick={() => setLocale(locale === 'en-US' ? 'zh-CN' : 'en-US')}>
      Switch language
    </button>
  )
}

describe('AuditPage', () => {
  it('keeps filter edits draft-only and Query or Reset commits one restarted request', async () => {
    renderAudit()
    await screen.findByText('orders.first')
    expect(requests).toEqual([{ pageSize: '25' }])
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter audit action' }), {
      target: { value: 'orders.refund' },
    })
    await act(async () => undefined)
    expect(requests).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /Search/ }))
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[1]).toEqual({ action: 'orders.refund', pageSize: '25' })

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(requests).toHaveLength(3))
    expect(requests[2]).toEqual({ pageSize: '25' })
  })

  it('traverses first, next, back, and restart while keeping cursor exhaustion truthful', async () => {
    respond = (query) =>
      query.cursor === 'cursor-next'
        ? { data: [auditEvent('second')], nextCursor: null }
        : { data: [auditEvent('first')], nextCursor: 'cursor-next' }

    const view = renderAudit()
    await screen.findByText('orders.first')
    expect(screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(false)
    expect(view.container.textContent).not.toMatch(/\btotal\b/i)

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await screen.findByText('orders.second')
    expect(requests.at(-1)).toEqual({ cursor: 'cursor-next', pageSize: '25' })
    expect(screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    await screen.findByText('orders.first')
    expect(requests.at(-1)).toEqual({ pageSize: '25' })

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await screen.findByText('orders.second')
    fireEvent.click(screen.getByRole('button', { name: 'First page' }))
    await screen.findByText('orders.first')
    expect(requests.at(-1)).toEqual({ pageSize: '25' })
  })

  it('ignores an older cursor response after Reset restarts the committed query', async () => {
    let releaseCursorRequest: (() => void) | undefined
    const cursorGate = new Promise<void>((resolve) => {
      releaseCursorRequest = resolve
    })
    let firstPageLoads = 0
    server.use(
      http.get('*/admin/audit', async ({ request }) => {
        const query = Object.fromEntries(new URL(request.url).searchParams.entries())
        requests.push(query)
        if (query.cursor) {
          await cursorGate
          return HttpResponse.json({
            data: [auditEvent('stale-cursor')],
            meta: { nextCursor: null },
          })
        }
        firstPageLoads += 1
        return HttpResponse.json({
          data: [auditEvent(firstPageLoads === 1 ? 'first' : 'fresh-reset')],
          meta: { nextCursor: firstPageLoads === 1 ? 'cursor-next' : null },
        })
      })
    )
    renderAudit()
    await screen.findByText('orders.first')

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(requests.at(-1)).toEqual({ cursor: 'cursor-next', pageSize: '25' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    await screen.findByText('orders.fresh-reset')

    releaseCursorRequest?.()
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0))
    })
    expect(screen.queryByText('orders.stale-cursor')).toBeNull()
    expect(screen.getByText('orders.fresh-reset')).toBeTruthy()
  })

  it('hides mismatched rows after a replacement failure and retries the committed query', async () => {
    renderAudit()
    await screen.findByText('orders.first')

    server.use(
      http.get('*/admin/audit', ({ request }) => {
        requests.push(Object.fromEntries(new URL(request.url).searchParams.entries()))
        return HttpResponse.json(
          { error: { code: 'QUERY_SERVER_ERROR', message: 'Replacement failed.' } },
          { status: 500 }
        )
      })
    )
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter audit action' }), {
      target: { value: 'orders.capture' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Search/ }))

    expect(await screen.findByText('Request failed. Please try again later.')).toBeTruthy()
    expect(screen.queryByText('orders.first')).toBeNull()
    expect(requests.at(-1)).toEqual({ action: 'orders.capture', pageSize: '25' })

    server.resetHandlers()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('orders.first')
    expect(requests.at(-1)).toEqual({ action: 'orders.capture', pageSize: '25' })
  })

  it('retains matching rows on same-scope refresh failure and retries that scope', async () => {
    renderAudit()
    await screen.findByText('orders.first')

    server.use(
      http.get('*/admin/audit', ({ request }) => {
        requests.push(Object.fromEntries(new URL(request.url).searchParams.entries()))
        return HttpResponse.json(
          { error: { code: 'QUERY_SERVER_ERROR', message: 'Refresh failed.' } },
          { status: 500 }
        )
      })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))

    expect(await screen.findByText('Request failed. Please try again later.')).toBeTruthy()
    expect(screen.getByText('orders.first')).toBeTruthy()
    server.resetHandlers()
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    await waitFor(() => expect(requests).toHaveLength(3))
    expect(requests.at(-1)).toEqual({ pageSize: '25' })
  })

  it('recovers an invalid cursor by restarting the committed query at the first page', async () => {
    respond = (query) =>
      query.cursor
        ? { data: [auditEvent('unreachable')], nextCursor: null }
        : { data: [auditEvent('first')], nextCursor: 'invalid-cursor' }
    renderAudit()
    await screen.findByText('orders.first')

    server.use(
      http.get('*/admin/audit', ({ request }) => {
        const query = Object.fromEntries(new URL(request.url).searchParams.entries())
        requests.push(query)
        if (query.cursor) {
          return HttpResponse.json(
            {
              error: {
                code: 'invalid_audit_cursor',
                message: 'The audit cursor is invalid.',
              },
            },
            { status: 422 }
          )
        }
        return HttpResponse.json({
          data: [auditEvent('restarted')],
          meta: { nextCursor: null },
        })
      })
    )

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('The audit cursor is invalid.')).toBeTruthy()
    expect(screen.queryByText('orders.first')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }))

    await screen.findByText('orders.restarted')
    expect(requests.at(-1)).toEqual({ pageSize: '25' })
  })

  it('keeps audit permission authority on the route and exposes no page without it', async () => {
    expect(templateRoutes.find(({ key }) => key === 'audit')).toMatchObject({
      path: '/audit',
      permission: 'audit.read',
    })

    renderAudit([])
    expect(await screen.findByText('Access denied')).toBeTruthy()
    expect(requests).toHaveLength(0)
  })

  it('shows the standard empty state without inventing a total or cursor destination', async () => {
    respond = () => ({ data: [], nextCursor: null })
    const view = renderAudit()

    expect(await screen.findByText('Reset the filters and search again.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Next page' })).toBeNull()
    expect(view.container.textContent).not.toMatch(/\btotal\b/i)
  })

  it('keeps back and first-page recovery available on an empty later cursor page', async () => {
    respond = (query) =>
      query.cursor
        ? { data: [], nextCursor: null }
        : { data: [auditEvent('first')], nextCursor: 'cursor-empty' }
    renderAudit()
    await screen.findByText('orders.first')

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await screen.findByText('Reset the filters and search again.')
    expect(screen.getByRole('button', { name: 'Previous page' }).hasAttribute('disabled')).toBe(
      false
    )
    expect(screen.getByRole('button', { name: 'First page' }).hasAttribute('disabled')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
    await screen.findByText('orders.first')
  })

  it('uses the standard initial loading state while the first cursor request is pending', async () => {
    let releaseRequest: (() => void) | undefined
    server.use(
      http.get('*/admin/audit', ({ request }) => {
        requests.push(Object.fromEntries(new URL(request.url).searchParams.entries()))
        return new Promise<HttpResponse<Record<string, unknown>>>((resolve) => {
          releaseRequest = () =>
            resolve(
              HttpResponse.json({
                data: [auditEvent('loaded')],
                meta: { nextCursor: null },
              })
            )
        })
      })
    )
    renderAudit()

    expect(await screen.findByText('Loading audit events…')).toBeTruthy()
    await act(async () => releaseRequest?.())
    expect(await screen.findByText('orders.loaded')).toBeTruthy()
  })

  it('auto-refreshes the committed scope and ignores a later visible draft', async () => {
    window.localStorage.setItem(LIST_AUTO_REFRESH_STORAGE_KEY, 'true')
    renderAudit()
    await screen.findByText('orders.first')
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter audit action' }), {
      target: { value: 'unsubmitted.action' },
    })

    fireEvent.focus(window)
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[1]).toEqual({ pageSize: '25' })
  })

  it('retranslates controls without refetching the audit data', async () => {
    renderInLocale(
      <ThemeProvider>
        <LocaleSwitch />
        <AuditPage />
      </ThemeProvider>
    )
    await screen.findByText('orders.first')
    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))

    expect(await screen.findByRole('button', { name: '下一页' })).toBeTruthy()
    expect(requests).toHaveLength(1)
  })

  it('persists table preferences under the Audit-specific table identity', async () => {
    renderAudit()
    await screen.findByText('orders.first')
    fireEvent.click(screen.getByRole('button', { name: 'Density' }))
    fireEvent.click(await screen.findByText('Compact'))

    expect(
      window.localStorage.getItem('list:table-view-preferences:v1:audit-events-list')
    ).toContain('"density":"small"')
  })
})
