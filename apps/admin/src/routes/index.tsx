import { ConfigProvider, theme } from 'antd'
import { RouterProvider } from 'react-router-dom'
import { useI18n } from '../shared/contexts/i18n-context'
import { useTheme } from '../shared/contexts/theme-context'
import { router } from './router'
import { getAntdLocale } from './antd-locale'

export const AppRouter = () => {
  const { locale } = useI18n()
  const { resolvedTheme } = useTheme()

  return (
    <ConfigProvider
      locale={getAntdLocale(locale)}
      theme={{
        algorithm: resolvedTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: resolvedTheme === 'dark' ? '#1668dc' : '#0958d9',
          colorLink: resolvedTheme === 'dark' ? '#69b1ff' : '#0958d9',
          colorTextSecondary: resolvedTheme === 'dark' ? '#bfbfbf' : '#595959',
          colorTextTertiary: resolvedTheme === 'dark' ? '#bfbfbf' : '#595959',
          borderRadius: 8,
          colorBgLayout: resolvedTheme === 'dark' ? '#141414' : '#f5f7fa',
          colorBgContainer: resolvedTheme === 'dark' ? '#1f1f1f' : '#ffffff',
          boxShadowTertiary: '0 1px 2px rgba(0, 0, 0, 0.04)',
        },
      }}
    >
      <RouterProvider router={router} />
    </ConfigProvider>
  )
}
