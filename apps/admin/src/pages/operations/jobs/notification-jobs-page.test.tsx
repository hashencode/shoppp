import type { AdminPermission, NotificationJob } from '@shoppp/contracts'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@rstest/core'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import React from 'react'
import { ThemeProvider } from '../../../shared/contexts/theme-context'
import { AuthTestProvider } from '../../../test/auth-context-fixture'
import { renderInLocale } from '../../../test/render-in-locale'
import { NotificationJobsPage } from './notification-jobs-page'
import { useI18n } from '../../../shared/contexts/i18n-context'

void React

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  })
}
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

const deadLetter: NotificationJob = {
  attemptCount: 3,
  attempts: [
    {
      attemptNumber: 3,
      completedAt: '2026-07-30T00:03:00.000Z',
      errorCode: 'email_provider_timeout',
      id: 'attempt-3',
      result: 'exhausted',
      startedAt: '2026-07-30T00:02:59.000Z',
    },
  ],
  createdAt: '2026-07-30T00:00:00.000Z',
  deadLetteredAt: '2026-07-30T00:03:00.000Z',
  id: 'notify-dead-letter-001',
  kind: 'notification',
  lastErrorCode: 'email_provider_timeout',
  maxAttempts: 3,
  orderReference: 'ORD-NOTIFY001',
  recipient: 's***@example.test',
  replayCount: 0,
  status: 'dead_letter',
  type: 'order_receipt',
  updatedAt: '2026-07-30T00:03:00.000Z',
}

let replayBody: unknown
let replayIdempotencyKey: string | null
let jobRequests: Array<Record<string, string>> = []
let currentJob = deadLetter
let replayGate: Promise<void> | null = null
let releaseReplay: (() => void) | undefined
const server = setupServer(
  http.get('*/admin/operations/jobs', ({ request }) => {
    jobRequests.push(Object.fromEntries(new URL(request.url).searchParams.entries()))
    return HttpResponse.json({
      data: [currentJob],
      meta: { page: 1, pageSize: 20, total: 1 },
    })
  }),
  http.post('*/admin/operations/jobs/notify-dead-letter-001/replay', async ({ request }) => {
    replayBody = await request.json()
    replayIdempotencyKey = request.headers.get('Idempotency-Key')
    await replayGate
    currentJob = {
      ...deadLetter,
      deadLetteredAt: null,
      lastErrorCode: null,
      replayCount: 1,
      status: 'pending',
    }
    return HttpResponse.json({
      data: currentJob,
    })
  })
)

const renderPage = (permissions: readonly AdminPermission[]) =>
  renderInLocale(
    <AuthTestProvider role="operations_operator" permissions={permissions}>
      <ThemeProvider>
        <NotificationJobsPage />
      </ThemeProvider>
    </AuthTestProvider>
  )

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  replayBody = undefined
  replayIdempotencyKey = null
  jobRequests = []
  currentJob = deadLetter
  replayGate = null
  releaseReplay = undefined
  server.resetHandlers()
})
afterAll(() => server.close())

describe('NotificationJobsPage', () => {
  it('localizes the status filter and keeps its submitted code when the language changes', async () => {
    const requests: string[] = []
    server.use(
      http.get('*/admin/operations/jobs', ({ request }) => {
        requests.push(new URL(request.url).searchParams.get('status') ?? '')
        return HttpResponse.json({ data: [deadLetter], meta: { page: 1, pageSize: 20, total: 1 } })
      })
    )
    const LanguageSwitch = () => {
      const { setLocale } = useI18n()
      return <button onClick={() => setLocale('en-US')}>English</button>
    }
    renderInLocale(
      <AuthTestProvider role="operations_operator" permissions={['operations.jobs.read']}>
        <ThemeProvider>
          <LanguageSwitch />
          <NotificationJobsPage />
        </ThemeProvider>
      </AuthTestProvider>,
      'zh-CN'
    )
    await screen.findByText('notify-dead-letter-001')
    const filter = screen.getByRole('combobox', { name: '筛选通知状态' })
    expect(screen.getAllByText('状态').length).toBeGreaterThan(0)
    fireEvent.mouseDown(filter)
    fireEvent.click((await screen.findAllByText('失败')).at(-1)!)
    expect(requests).toEqual([''])
    fireEvent.click(screen.getByRole('button', { name: /查.*询/ }))
    await waitFor(() => expect(requests).toEqual(['', 'failed']), { timeout: 3_000 })
    fireEvent.click(screen.getByText('English'))
    expect(
      screen.getByRole('combobox', { name: 'Filter notification status' }).closest('.ant-select')
        ?.textContent
    ).toContain('failed')
    await waitFor(() => expect(requests).toEqual(['', 'failed']))
    expect(screen.queryByRole('button', { name: 'Replay' })).toBeNull()
  })

  it('shows masked recovery facts and hides replay from viewers', async () => {
    renderPage(['operations.jobs.read'])

    await waitFor(() => expect(screen.getByText('notify-dead-letter-001')).toBeTruthy())
    expect(screen.getByText('s***@example.test')).toBeTruthy()
    expect(screen.getByText('email_provider_timeout')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Replay' })).toBeNull()
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Page Size' }))
    expect(await screen.findByRole('option', { name: '20 per page' })).toBeTruthy()
    expect(screen.getByRole('option', { name: '50 per page' })).toBeTruthy()
    expect(screen.getByRole('option', { name: '100 per page' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'All data' })).toBeNull()
  })

  it('commits draft filters only on Search, paginates with committed filters, and resets them', async () => {
    server.use(
      http.get('*/admin/operations/jobs', ({ request }) => {
        jobRequests.push(Object.fromEntries(new URL(request.url).searchParams.entries()))
        return HttpResponse.json({
          data: [currentJob],
          meta: {
            page: Number(new URL(request.url).searchParams.get('page')),
            pageSize: 20,
            total: 41,
          },
        })
      })
    )
    renderPage(['operations.jobs.read'])
    await screen.findByText('notify-dead-letter-001')

    fireEvent.change(screen.getByLabelText('Search notification jobs'), {
      target: { value: ' ORD-LATEST ' },
    })
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Filter notification type' }))
    fireEvent.click((await screen.findAllByText('shipment')).at(-1)!)
    expect(jobRequests).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: /^(loading )?Search$/ }))
    await waitFor(
      () =>
        expect(jobRequests.at(-1)).toEqual({
          page: '1',
          pageSize: '20',
          query: 'ORD-LATEST',
          type: 'shipment',
        }),
      { timeout: 3_000 }
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_100))
    })

    fireEvent.change(screen.getByLabelText('Search notification jobs'), {
      target: { value: 'unsubmitted' },
    })
    fireEvent.click(document.querySelector('.ant-pagination-next button')!)
    await waitFor(() => expect(jobRequests.at(-1)?.page).toBe('2'))
    expect(jobRequests.at(-1)?.query).toBe('ORD-LATEST')
    expect(jobRequests.at(-1)?.type).toBe('shipment')

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    await waitFor(() => expect(jobRequests.at(-1)).toEqual({ page: '1', pageSize: '20' }), {
      timeout: 3_000,
    })
  })

  it('requires confirmation and reloads authoritative status with the latest committed filters', async () => {
    let releaseStaleQuery: (() => void) | undefined
    const staleQueryGate = new Promise<void>((resolve) => {
      releaseStaleQuery = resolve
    })
    let scopedRequestCount = 0
    server.use(
      http.get('*/admin/operations/jobs', async ({ request }) => {
        const searchParams = Object.fromEntries(new URL(request.url).searchParams.entries())
        jobRequests.push(searchParams)
        if (searchParams.query === 'latest committed' && scopedRequestCount++ === 0) {
          await staleQueryGate
          return HttpResponse.json({
            data: [deadLetter],
            meta: { page: 1, pageSize: 20, total: 1 },
          })
        }
        return HttpResponse.json({
          data: [currentJob],
          meta: { page: 1, pageSize: 20, total: 1 },
        })
      })
    )
    replayGate = new Promise<void>((resolve) => {
      releaseReplay = resolve
    })
    renderPage(['operations.jobs.read', 'operations.replay'])
    await waitFor(() => expect(screen.getByRole('button', { name: 'Replay' })).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Replay' }))
    expect(
      screen.getByText(
        'Replay keeps the original provider idempotency identity and is fully audited.'
      )
    ).toBeTruthy()
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
      target: { value: 'Provider configuration corrected' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm replay' }))

    await waitFor(() =>
      expect(replayBody).toEqual({
        confirm: true,
        reason: 'Provider configuration corrected',
      })
    )
    expect(replayIdempotencyKey).toMatch(/^notification-replay-/)

    fireEvent.change(screen.getByLabelText('Search notification jobs'), {
      target: { value: ' latest committed ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^(loading )?Search$/ }))
    await waitFor(() =>
      expect(jobRequests.at(-1)).toEqual({
        page: '1',
        pageSize: '20',
        query: 'latest committed',
      })
    )

    await act(async () => {
      releaseReplay?.()
    })
    await waitFor(() => expect(jobRequests.length).toBeGreaterThanOrEqual(3))
    expect(jobRequests.at(-1)).toEqual({
      page: '1',
      pageSize: '20',
      query: 'latest committed',
    })
    await waitFor(() => expect(screen.getByText('pending')).toBeTruthy())

    await act(async () => {
      releaseStaleQuery?.()
    })
    await waitFor(() => expect(screen.getByText('pending')).toBeTruthy())
    expect(screen.queryByRole('dialog', { name: 'Replay notification' })).toBeNull()
  })

  it('keeps the replay modal open and does not reload when replay fails', async () => {
    server.use(
      http.post('*/admin/operations/jobs/notify-dead-letter-001/replay', () =>
        HttpResponse.json(
          { error: { code: 'replay_failed', message: 'Replay failed.' } },
          { status: 500 }
        )
      )
    )
    renderPage(['operations.jobs.read', 'operations.replay'])
    await screen.findByRole('button', { name: 'Replay' })
    fireEvent.click(screen.getByRole('button', { name: 'Replay' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
      target: { value: 'Provider configuration corrected' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm replay' }))

    expect(await screen.findByText('Request failed. Please try again later.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Confirm replay' })).toBeTruthy()
    expect(jobRequests).toHaveLength(1)
  })
})
