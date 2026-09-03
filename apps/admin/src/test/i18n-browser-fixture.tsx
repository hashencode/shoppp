import React, { type ReactNode } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { expect } from '@rstest/core'
import { page } from '@rstest/browser'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { AdminPermission } from '@shoppp/contracts'
import { apiClient } from '../infrastructure/http/api-client'
import { AdminUiProvider } from '../routes/admin-ui-provider'
import {
  I18nProvider,
  LANGUAGE_STORAGE_KEY,
  useI18n,
  type AppLocale,
} from '../shared/contexts/i18n-context'
import { ThemeProvider } from '../shared/contexts/theme-context'
import { AuthTestProvider } from './auth-context-fixture'
import '../index.css'

void React

export const oppositeBrowserLocale = (): AppLocale =>
  navigator.language.startsWith('zh') ? 'en-US' : 'zh-CN'

const LocaleSwitch = () => {
  const { locale, setLocale } = useI18n()
  return (
    <button type="button" onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}>
      Switch language
    </button>
  )
}

export const renderI18nBrowser = (
  children: ReactNode,
  permissions: readonly AdminPermission[],
  locale = oppositeBrowserLocale()
) => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, locale)
  return render(
    <I18nProvider>
      <ThemeProvider>
        <AdminUiProvider>
          <AuthTestProvider permissions={permissions}>
            <div className="min-w-0 p-3" data-testid="i18n-browser-fixture">
              <LocaleSwitch />
              {children}
            </div>
          </AuthTestProvider>
        </AdminUiProvider>
      </ThemeProvider>
    </I18nProvider>
  )
}

export const switchBrowserLocale = async () => {
  const previous = document.documentElement.lang
  await page.getByRole('button', { name: 'Switch language' }).click()
  await waitFor(() => expect(document.documentElement.lang).not.toBe(previous))
  // Drain locale effects/timers before checking for unwanted business requests.
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0))
  })
}

export const assertNativeBrowserAndCss = () => {
  const profile = process.env.ADMIN_I18N_BROWSER_PROFILE
  if (profile) {
    const narrow = profile === 'narrow'
    expect(navigator.language).toBe(narrow ? 'zh-CN' : 'en-US')
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(narrow ? 'UTC' : 'Asia/Shanghai')
    expect(window.innerWidth).toBe(narrow ? 390 : 1280)
  }
  const fixture = document.querySelector('[data-testid="i18n-browser-fixture"]')!
  expect(getComputedStyle(fixture).paddingLeft).toBe('12px')
  expect(getComputedStyle(fixture).minWidth).toBe('0px')
}

export const assertWithinViewport = (element: Element) => {
  const bounds = element.getBoundingClientRect()
  expect(bounds.width).toBeGreaterThan(0)
  expect(bounds.left).toBeGreaterThanOrEqual(0)
  expect(bounds.right).toBeLessThanOrEqual(window.innerWidth + 1)
}

// Only the transport is replaced; pages, services and error interceptors execute normally.
// Unexpected requests reject before reaching any network or backend.
export const installBrowserApi = (
  respond: (config: InternalAxiosRequestConfig) => { data: unknown; status?: number }
) => {
  const previous = apiClient.defaults.adapter
  const requests: InternalAxiosRequestConfig[] = []
  apiClient.defaults.adapter = async (config) => {
    requests.push(config)
    const result = respond(config)
    const response = {
      data: result.data,
      status: result.status ?? 200,
      statusText: 'Fixture',
      headers: {},
      config,
    }
    if (response.status >= 400)
      throw new AxiosError('Fixture request failed', undefined, config, undefined, response)
    return response
  }
  return {
    requests,
    restore: () => {
      apiClient.defaults.adapter = previous
    },
  }
}
