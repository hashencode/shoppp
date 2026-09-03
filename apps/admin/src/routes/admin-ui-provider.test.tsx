import React from 'react'
import { App, Button, DatePicker, Input } from 'antd'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from '@rstest/core'
import { AdminUiProvider } from './admin-ui-provider'
import { I18nProvider, LANGUAGE_STORAGE_KEY, useI18n } from '../shared/contexts/i18n-context'
import { ThemeProvider } from '../shared/contexts/theme-context'

void React

const FeedbackProbe = () => {
  const { message } = App.useApp()
  const { locale, setLocale, t } = useI18n()
  return (
    <>
      <DatePicker />
      <Input aria-label="Unsubmitted value" />
      <Button onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}>
        Switch language
      </Button>
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

  it('preserves mounted controls and existing feedback when language changes', async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'zh-CN')
    render(
      <I18nProvider>
        <ThemeProvider>
          <AdminUiProvider>
            <FeedbackProbe />
          </AdminUiProvider>
        </ThemeProvider>
      </I18nProvider>
    )
    const input = screen.getByRole('textbox', { name: 'Unsubmitted value' }) as HTMLInputElement
    const dateInput = screen.getByPlaceholderText('请选择日期')
    const feedbackOwner = document.querySelector('.ant-app')
    fireEvent.change(input, { target: { value: 'Unsaved 用户内容' } })
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }))
    const priorToast = await screen.findByText('账号已复制')

    fireEvent.click(screen.getByRole('button', { name: 'Switch language' }))
    expect(screen.getByPlaceholderText('Select date')).toBe(dateInput)
    expect(screen.getByRole('textbox', { name: 'Unsubmitted value' })).toBe(input)
    expect(input.value).toBe('Unsaved 用户内容')
    expect(document.querySelector('.ant-app')).toBe(feedbackOwner)
    expect(screen.getByText('账号已复制')).toBe(priorToast)
    expect(document.querySelectorAll('.ant-message-notice')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Notify' }))
    expect(await screen.findByText('Account copied')).toBeTruthy()
    expect(screen.getByText('账号已复制')).toBe(priorToast)
    expect(document.querySelectorAll('.ant-app')).toHaveLength(1)
    expect(document.querySelectorAll('.ant-message-notice')).toHaveLength(2)
  })
})
