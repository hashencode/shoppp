import type { AuditEvent } from '@shoppp/contracts'
import React from 'react'
import { page } from '@rstest/browser'
import { afterEach, describe, expect, it } from '@rstest/core'
import { cleanup, waitFor } from '@testing-library/react'

import {
  assertNativeBrowserAndCss,
  assertWithinViewport,
  installBrowserApi,
  renderI18nBrowser,
  switchBrowserLocale,
} from '../../test/i18n-browser-fixture'
import { AuditPage } from './audit-page'

void React

let transport: ReturnType<typeof installBrowserApi> | undefined

afterEach(() => {
  cleanup()
  transport?.restore()
})

const auditEvent = (id: string): AuditEvent => ({
  action: `orders.${id}`,
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

describe('Audit page in a real browser', () => {
  it('keeps cursor controls, draft filters, and localization truthful in the native viewport', async () => {
    transport = installBrowserApi((request) => {
      if (request.method !== 'get' || request.url !== '/admin/audit') {
        throw new Error(`Unexpected request ${request.method} ${request.url}`)
      }
      const cursor = String(request.params?.cursor ?? '')
      return {
        data: {
          data: [auditEvent(cursor ? 'second' : 'first')],
          meta: { nextCursor: cursor ? null : 'cursor-next' },
        },
      }
    })

    renderI18nBrowser(<AuditPage />, ['audit.read'])
    await expect.element(page.getByText('orders.first')).toBeVisible()
    assertNativeBrowserAndCss()

    const actionInput =
      document.querySelector<HTMLInputElement>('input[name="action"]') ??
      document.querySelector<HTMLInputElement>('#action')!
    const listCard = actionInput.closest('.ant-card')!
    expect(document.querySelectorAll('.ant-card')).toHaveLength(1)
    expect(listCard.querySelector('.ant-table-wrapper')).toBeTruthy()
    const queryRegion = actionInput.closest('form')!.parentElement!
    const listRegion = listCard.querySelector('.ant-table-wrapper')!.parentElement!
    expect(getComputedStyle(queryRegion).padding).toBe('16px')
    expect(getComputedStyle(queryRegion).borderBottomWidth).toBe('1px')
    expect(getComputedStyle(queryRegion).borderBottomStyle).toBe('solid')
    expect(getComputedStyle(listRegion).padding).toBe('16px')
    assertWithinViewport(actionInput)
    await page
      .getByRole('textbox', {
        name: document.documentElement.lang === 'zh-CN' ? '筛选审计操作' : 'Filter audit action',
      })
      .fill('unsubmitted.action')
    expect(transport.requests).toHaveLength(1)

    await page
      .getByRole('button', {
        name: document.documentElement.lang === 'zh-CN' ? '下一页' : 'Next page',
      })
      .click()
    await expect.element(page.getByText('orders.second')).toBeVisible()
    expect(transport.requests).toHaveLength(2)
    expect(transport.requests[1]?.params).toMatchObject({ cursor: 'cursor-next', pageSize: 25 })
    expect(document.body.textContent).not.toMatch(/\btotal\b/i)

    const requestCount = transport.requests.length
    await switchBrowserLocale()
    await waitFor(() => expect(transport?.requests).toHaveLength(requestCount))
    await expect
      .element(
        page.getByRole('button', {
          name: document.documentElement.lang === 'zh-CN' ? '上一页' : 'Previous page',
        })
      )
      .toBeVisible()
  })
})
