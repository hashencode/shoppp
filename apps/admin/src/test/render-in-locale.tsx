import React from 'react'
import { App } from 'antd'
import { render } from '@testing-library/react'
import { I18nProvider, LANGUAGE_STORAGE_KEY, type AppLocale } from '../shared/contexts/i18n-context'

void React

export const renderInLocale = (node: React.ReactNode, locale: AppLocale = 'en-US') => {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, locale)
  return render(
    <I18nProvider>
      <App>{node}</App>
    </I18nProvider>
  )
}
