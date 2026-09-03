import { App, ConfigProvider, theme } from 'antd'
import React, { type PropsWithChildren } from 'react'

import { useI18n } from '../shared/contexts/i18n-context'
import { useTheme } from '../shared/contexts/theme-context'
import { getAntdLocale } from './antd-locale'

void React

export const AdminUiProvider = ({ children }: PropsWithChildren) => {
  const { locale } = useI18n()
  const { resolvedTheme } = useTheme()

  return (
    <ConfigProvider
      locale={getAntdLocale(locale)}
      theme={{
        algorithm: resolvedTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
          colorBgLayout: resolvedTheme === 'dark' ? '#141414' : '#f5f7fa',
          colorBgContainer: resolvedTheme === 'dark' ? '#1f1f1f' : '#ffffff',
          boxShadowTertiary: '0 1px 2px rgba(0, 0, 0, 0.04)',
        },
      }}
    >
      <App className="min-h-full">{children}</App>
    </ConfigProvider>
  )
}
