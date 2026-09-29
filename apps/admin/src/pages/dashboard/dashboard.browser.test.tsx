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
import { THEME_STORAGE_KEY } from '../../shared/contexts/theme-context'
import { revenueFixture, productsFixture, trafficFixture } from './dashboard-test-data'

void React
let transport: ReturnType<typeof installBrowserApi> | undefined
afterEach(() => {
  cleanup()
  transport?.restore()
  localStorage.clear()
})
const install = (failTraffic = false) =>
  installBrowserApi((request) => {
    if (request.url === '/admin/reporting/revenue')
      return { data: { data: revenueFixture(request.params as ReportingQuery) } }
    if (request.url === '/admin/reporting/products')
      return { data: { data: productsFixture(request.params as ReportingQuery) } }
    if (request.url === '/admin/reporting/traffic')
      return failTraffic
        ? { data: {}, status: 503 }
        : { data: { data: trafficFixture(request.params as TrafficQuery) } }
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
  it('keeps real sales visible when traffic fails and exposes an actionable retry', async () => {
    transport = install(true)
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
    transport.restore()
    transport = install()
    await page.getByRole('button', { name: 'Retry' }).first().click()
    await expect.element(page.getByRole('link', { name: 'Product A' })).toBeVisible()
    expect(transport.requests).toHaveLength(1)
    expect(transport.requests[0]?.url).toBe('/admin/reporting/traffic')
  })
})
