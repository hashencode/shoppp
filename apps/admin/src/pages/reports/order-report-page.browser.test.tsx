import React from 'react'
import { afterEach, describe, expect, it } from '@rstest/core'
import { page } from '@rstest/browser'
import { cleanup, waitFor } from '@testing-library/react'
import { DatePicker, Pagination, Select } from 'antd'
import type { ReportOrderRow } from '@shoppp/contracts'
import {
  assertNativeBrowserAndCss,
  assertWithinViewport,
  installBrowserApi,
  renderI18nBrowser,
  switchBrowserLocale,
} from '../../test/i18n-browser-fixture'
import { OrderReportPage } from './order-report-page'

void React

let transport: ReturnType<typeof installBrowserApi> | undefined
afterEach(() => {
  cleanup()
  transport?.restore()
  window.history.replaceState(null, '', '/')
})

describe('Revenue reporting locale in a native browser', () => {
  it('keeps UTC rows and date-only query values while the application switches against the native locale', async () => {
    const row: ReportOrderRow = {
      createdAt: '2026-09-03T00:00:00.000Z',
      currency: 'USD',
      email: 'shopper@example.test',
      fulfillmentStatus: 'unfulfilled',
      grossContribution: 2500,
      netContribution: 2000,
      orderStatus: 'confirmed',
      paymentStatus: 'partially_refunded',
      publicReference: 'ORD-BROWSER',
      refundContribution: 500,
    }
    window.history.replaceState(
      null,
      '',
      '?currency=USD&startDate=2026-09-01&endDate=2026-09-03&timeZone=America%2FNew_York'
    )
    transport = installBrowserApi((request) => {
      if (request.method !== 'get' || request.url !== '/admin/reporting/orders')
        throw new Error(`Unexpected request ${request.url}`)
      return {
        data: {
          data: [
            row,
            { ...row, publicReference: 'ORD-BOUNDARY', createdAt: '2026-09-03T23:30:00.000Z' },
          ],
          meta: { page: request.params.page, pageSize: 20, total: 42 },
        },
      }
    })
    renderI18nBrowser(<OrderReportPage />, ['reporting.read'])
    await expect.element(page.getByText('ORD-BOUNDARY')).toBeVisible()
    assertNativeBrowserAndCss()
    expect(document.documentElement.lang).not.toBe(navigator.language)
    for (let index = 0; index < 2; index += 1) {
      const chinese = document.documentElement.lang === 'zh-CN'
      await expect
        .element(
          page.getByRole('columnheader', { name: chinese ? '创建时间（UTC）' : 'Created (UTC)' })
        )
        .toBeVisible()
      expect(document.body.textContent).toContain('2026-09-03 00:00')
      expect(document.body.textContent).toContain('2026-09-03 23:30')
      expect(document.querySelector<HTMLInputElement>('input[type="date"]')?.value).toBe(
        '2026-09-01'
      )
      await switchBrowserLocale()
    }
    expect(transport.requests).toHaveLength(1)
    expect(transport.requests[0]?.params).toEqual({
      currency: 'USD',
      startDate: '2026-09-01',
      endDate: '2026-09-03',
      timeZone: 'America/New_York',
      page: 1,
      pageSize: 20,
    })
    const search = document.querySelector<HTMLInputElement>('input[type="search"]')!
    assertWithinViewport(search)
    await page.getByRole('searchbox').fill('ORD-BROWSER')
    await page.getByRole('searchbox').press('Enter')
    await waitFor(() => expect(transport?.requests).toHaveLength(2))
    expect(transport.requests[1]?.params).toEqual({
      ...transport.requests[0]?.params,
      query: 'ORD-BROWSER',
    })
    const table = document.querySelector('.ant-table-content')!
    assertWithinViewport(table)
    expect(table.scrollWidth).toBeGreaterThan(table.clientWidth)
  })

  it('switches Ant Design date, empty select and pagination language without replacing their controls', async () => {
    renderI18nBrowser(
      <>
        <DatePicker />
        <Select aria-label="Empty choices" options={[]} className="w-full" />
        <Pagination total={100} showSizeChanger />
      </>,
      []
    )
    assertNativeBrowserAndCss()
    const dateInput = document.querySelector('.ant-picker input')
    const selectInput = document.querySelector('[aria-label="Empty choices"]')
    for (let index = 0; index < 2; index += 1) {
      const chinese = document.documentElement.lang === 'zh-CN'
      await page.getByPlaceholder(chinese ? '请选择日期' : 'Select date').click()
      await expect
        .element(page.getByText(chinese ? '今天' : 'Today', { exact: true }))
        .toBeVisible()
      await page.getByPlaceholder(chinese ? '请选择日期' : 'Select date').press('Escape')
      await page.getByRole('combobox', { name: 'Empty choices' }).click()
      await waitFor(() =>
        expect(
          document.querySelector('.ant-select-dropdown .ant-empty-description')?.textContent
        ).toBe(chinese ? '暂无数据' : 'No data')
      )
      await page.getByRole('combobox', { name: 'Empty choices' }).press('Escape')
      expect(document.querySelector('.ant-pagination-next')?.getAttribute('title')).toBe(
        chinese ? '下一页' : 'Next Page'
      )
      await switchBrowserLocale()
      expect(document.querySelector('.ant-picker input')).toBe(dateInput)
      expect(document.querySelector('[aria-label="Empty choices"]')).toBe(selectInput)
    }
  })
})
