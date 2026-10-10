import React from 'react'
import { afterEach, describe, expect, it } from '@rstest/core'
import { page } from '@rstest/browser'
import { cleanup, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { getInstanceByDom } from 'echarts'
import type { ReportingQuery, TrafficQuery } from '@shoppp/contracts'
import {
  assertNativeBrowserAndCss,
  assertWithinViewport,
  installBrowserApi,
  renderI18nBrowser,
  switchBrowserLocale,
} from '../../test/i18n-browser-fixture'
import { DashboardPage } from './dashboard-page'
import { AnalysisPage } from '../templates/dashboard/analysis-page'
import { THEME_STORAGE_KEY } from '../../shared/contexts/theme-context'
import {
  revenueFixture,
  productsFixture,
  trafficFixture,
  emptyRevenueFixture,
  emptyTrafficFixture,
  emptyProductsFixture,
  noActivityDescription,
} from './dashboard-test-data'

void React
let transport: ReturnType<typeof installBrowserApi> | undefined
afterEach(() => {
  cleanup()
  transport?.restore()
  localStorage.clear()
})
const install = ({
  failTraffic = false,
  emptyRankings = false,
  noActivity = false,
  emptyFinancial = false,
  emptyTraffic = false,
} = {}) =>
  installBrowserApi((request) => {
    if (request.url === '/admin/reporting/revenue')
      return {
        data: {
          data: (noActivity || emptyFinancial ? emptyRevenueFixture : revenueFixture)(
            request.params as ReportingQuery
          ),
        },
      }
    if (request.url === '/admin/reporting/products') {
      const report = (noActivity || emptyFinancial ? emptyProductsFixture : productsFixture)(
        request.params as ReportingQuery
      )
      return { data: { data: emptyRankings ? { ...report, products: [] } : report } }
    }
    if (request.url === '/admin/reporting/traffic')
      return failTraffic
        ? { data: {}, status: 503 }
        : {
            data: {
              data: {
                ...(noActivity || emptyTraffic ? emptyTrafficFixture : trafficFixture)(
                  request.params as TrafficQuery
                ),
                ...(emptyRankings ? { products: [] } : {}),
              },
            },
          }
    throw new Error(`Unexpected endpoint: ${request.url}`)
  })

describe('Commerce analytics in a real browser', () => {
  it('renders real charts, commits a complete date pair once, resizes and translates without refetching', async () => {
    transport = install()
    renderI18nBrowser(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
      ['reporting.read'],
      'en-US'
    )
    await expect.element(page.getByRole('button', { name: 'View underlying orders' })).toBeVisible()
    assertNativeBrowserAndCss()
    const chartElement = document.querySelector(
      '[aria-label="Daily gross sales"] .echarts-for-react'
    ) as HTMLElement
    const chart = getInstanceByDom(chartElement)!
    expect(chart).toBeTruthy()
    expect(chartElement.querySelector('svg')).toBeTruthy()
    expect((chart.getOption().series as { data: number[] }[])[0]!.data).toEqual([1000, 2500])
    assertWithinViewport(document.querySelector('.ant-picker-range')!)
    await page.getByPlaceholder('Start date').click()
    await page.getByPlaceholder('Start date').fill('2026-02-01')
    await page.getByPlaceholder('Start date').press('Enter')
    expect(transport.requests).toHaveLength(3)
    await page.getByPlaceholder('End date').fill('2026-02-07')
    await page.getByPlaceholder('End date').press('Enter')
    await page.getByPlaceholder('End date').press('Tab')
    await waitFor(() => expect(transport?.requests).toHaveLength(6))
    for (const request of transport.requests.slice(3)) {
      expect(request.params.startDate).toBe('2026-02-01')
      expect(request.params.endDate).toBe('2026-02-07')
    }
    await page.getByRole('tab', { name: 'Page views' }).click()
    await expect.element(page.getByText('Top products by page views')).toBeVisible()
    const pvElement = document.querySelector(
      '[aria-label="Daily page views"] .echarts-for-react'
    ) as HTMLElement
    const pvChart = getInstanceByDom(pvElement)!
    expect((pvChart.getOption().series as { data: number[] }[])[0]!.data).toEqual([5, 1])
    const width = pvElement.getBoundingClientRect().width
    pvElement.style.width = `${width / 2}px`
    window.dispatchEvent(new Event('resize'))
    await waitFor(() => expect(pvChart.getWidth()).toBeLessThan(width))
    await switchBrowserLocale()
    await expect.element(page.getByRole('tab', { name: '访问量' })).toBeVisible()
    if (window.innerWidth >= 1024)
      await expect.element(page.getByRole('button', { name: '今天', exact: true })).toBeVisible()
    expect(document.body.textContent).not.toContain('Today')
    expect(transport.requests).toHaveLength(6)
  })
  it('renders readable charts in light, dark and system themes', async () => {
    for (const mode of ['light', 'dark', 'system']) {
      localStorage.setItem(THEME_STORAGE_KEY, mode)
      transport = install()
      renderI18nBrowser(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>,
        ['reporting.read'],
        'en-US'
      )
      await expect
        .element(page.getByRole('button', { name: 'View underlying orders' }))
        .toBeVisible()
      const element = document.querySelector(
        '[aria-label="Daily gross sales"] .echarts-for-react'
      ) as HTMLElement
      const chart = getInstanceByDom(element)!
      expect(chart.getWidth()).toBeGreaterThan(0)
      expect(chart.getOption().textStyle).toMatchObject({ color: expect.any(String) })
      assertWithinViewport(element)
      cleanup()
      transport.restore()
    }
  })
  it('uses the available report width when either product ranking is empty', async () => {
    transport = install({ emptyRankings: true })
    renderI18nBrowser(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
      ['reporting.read'],
      'en-US'
    )
    await expect.element(page.getByRole('button', { name: 'View underlying orders' })).toBeVisible()
    for (const label of ['Daily gross sales', 'Daily page views']) {
      if (label === 'Daily page views') await page.getByRole('tab', { name: 'Page views' }).click()
      const chartElement = document.querySelector(
        `[aria-label="${label}"] .echarts-for-react`
      ) as HTMLElement
      expect(document.querySelector('ol')).toBeNull()
      expect(document.querySelector('.ant-card-body h5')).toBeNull()
      assertWithinViewport(chartElement)
      const body = chartElement.closest('.ant-card-body') as HTMLElement
      const style = getComputedStyle(body)
      const availableWidth =
        body.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      await waitFor(() =>
        expect(getInstanceByDom(chartElement)!.getWidth()).toBeGreaterThan(availableWidth - 2)
      )
    }
  })
  it('centers one localized page empty state without report cards or filters', async () => {
    transport = install({ noActivity: true })
    renderI18nBrowser(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
      ['reporting.read'],
      'en-US'
    )
    await expect.element(page.getByText(noActivityDescription)).toBeVisible()
    expect(document.querySelectorAll('[data-metric]')).toHaveLength(0)
    expect(document.querySelector('.ant-card')).toBeNull()
    expect(document.querySelector('.ant-select')).toBeNull()
    expect(document.querySelector('.ant-picker')).toBeNull()
    expect(document.querySelectorAll('.ant-empty')).toHaveLength(1)
    expect(document.querySelector('[role="tab"]')).toBeNull()
    const empty = document.querySelector('.ant-empty')!
    assertWithinViewport(empty)
    const emptyBounds = empty.getBoundingClientRect()
    const contentBounds = empty.parentElement!.getBoundingClientRect()
    expect(contentBounds.height).toBeGreaterThanOrEqual(window.innerHeight - 104)
    expect(
      Math.abs(
        emptyBounds.top + emptyBounds.height / 2 - (contentBounds.top + contentBounds.height / 2)
      )
    ).toBeLessThan(1)
    expect(
      Math.abs(
        emptyBounds.left + emptyBounds.width / 2 - (contentBounds.left + contentBounds.width / 2)
      )
    ).toBeLessThan(1)
    expect(document.querySelector('[aria-label="Daily gross sales"]')).toBeNull()
    await switchBrowserLocale()
    await expect.element(page.getByText('当前数据不足，暂时无法展示仪表盘。')).toBeVisible()
    expect(document.body.textContent).not.toContain('Today')
    expect(transport.requests).toHaveLength(3)
  })
  it('uses localized standard empty states inside each card without replacing real metrics', async () => {
    for (const emptyFinancial of [true, false]) {
      transport = install({ emptyFinancial, emptyTraffic: !emptyFinancial })
      renderI18nBrowser(
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>,
        ['reporting.read'],
        'zh-CN'
      )
      await expect.element(page.getByRole('button', { name: '查看明细订单' })).toBeVisible()
      const emptyMetrics = emptyFinancial ? ['销售总额', '已支付订单', '净销售额'] : ['独立访客']
      for (const label of emptyMetrics) {
        const card = document.querySelector(`[data-metric="${label}"]`)!
        expect(card.textContent).toContain('暂无数据')
        expect(card.querySelector('[data-testid="metric-value"]')).toBeNull()
        expect(card.querySelector('.echarts-for-react')).toBeNull()
        expect(card.querySelector('.ant-divider')).toBeNull()
        const empty = card.querySelector('.ant-empty')!
        assertWithinViewport(empty)
        const emptyBounds = empty.getBoundingClientRect()
        const bodyBounds = card.querySelector('.ant-card-body')!.getBoundingClientRect()
        expect(emptyBounds.top).toBeGreaterThan(bodyBounds.top)
        expect(emptyBounds.bottom).toBeLessThan(bodyBounds.bottom)
      }
      expect(document.querySelectorAll('.ant-empty')).toHaveLength(emptyMetrics.length)
      expect(document.body.textContent).not.toContain('当前数据不足')
      await switchBrowserLocale()
      for (const label of emptyFinancial
        ? ['Gross sales', 'Paid orders', 'Net sales']
        : ['Unique visitors'])
        expect(document.querySelector(`[data-metric="${label}"]`)!.textContent).toContain('No data')
      expect(transport.requests).toHaveLength(3)
      cleanup()
      transport.restore()
    }
  })
  it('keeps the original analysis template working with the shared presentation', async () => {
    renderI18nBrowser(<AnalysisPage />, ['reporting.read'], 'en-US')
    await expect.element(page.getByRole('tab', { name: '销售额', exact: true })).toBeVisible()
    await page.getByRole('tab', { name: '访问量', exact: true }).click()
    await expect.element(page.getByRole('heading', { name: '门店访问量排名' })).toBeVisible()
    const chartElement = document.querySelector('.echarts-for-react') as HTMLElement
    expect(chartElement.querySelector('svg')).toBeTruthy()
    expect(getInstanceByDom(chartElement)?.getWidth()).toBeGreaterThan(0)
  })
  it('keeps real sales visible when traffic fails and exposes an actionable retry', async () => {
    transport = install({ failTraffic: true })
    renderI18nBrowser(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
      ['reporting.read'],
      'en-US'
    )
    await expect.element(page.getByRole('button', { name: 'View underlying orders' })).toBeVisible()
    await page.getByRole('tab', { name: 'Page views' }).click()
    const visitor = document.querySelector('[data-metric="Unique visitors"]')!
    expect(visitor.querySelector('[data-testid="metric-value"]')).toBeNull()
    expect(visitor.textContent).toContain('Retry')
    expect(document.querySelector('[role="alert"]')).toBeNull()
    transport.restore()
    transport = install()
    await page.getByRole('button', { name: 'Retry' }).first().click()
    await expect.element(page.getByRole('link', { name: 'Product A' })).toBeVisible()
    expect(transport.requests).toHaveLength(1)
    expect(transport.requests[0]?.url).toBe('/admin/reporting/traffic')
  })
})
