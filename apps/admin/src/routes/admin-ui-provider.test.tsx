import React from 'react'
import { App, Button, DatePicker } from 'antd'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from '@rstest/core'
import { AdminUiProvider } from './admin-ui-provider'
import { I18nProvider, LANGUAGE_STORAGE_KEY, useI18n } from '../shared/contexts/i18n-context'
import { ThemeProvider } from '../shared/contexts/theme-context'

void React

const FeedbackProbe = () => {
  const { message } = App.useApp()
  const { t } = useI18n()
  return (
    <>
      <DatePicker />
      <Button onClick={() => void message.success(t('Account copied'))}>Notify</Button>
    </>
  )
}

afterEach(cleanup)

describe('Admin UI feedback owner', () => {
  it('renders context feedback in each locale and removes its portal on unmount', async () => {
    for (const [locale, text, placeholder] of [
      ['zh-CN', '账号已复制', '请选择日期'],
      ['en-US', 'Account copied', 'Select date'],
    ]) {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, locale)
      const view = render(
        <I18nProvider>
          <ThemeProvider>
            <AdminUiProvider>
              <FeedbackProbe />
            </AdminUiProvider>
          </ThemeProvider>
        </I18nProvider>
      )
      expect(screen.getByPlaceholderText(placeholder)).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Notify' }))
      expect(await screen.findByText(text)).toBeTruthy()
      expect(document.querySelectorAll('.ant-app')).toHaveLength(1)
      view.unmount()
      expect(document.querySelector('.ant-message')).toBeNull()
    }
  })
})
