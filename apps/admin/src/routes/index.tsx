import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { RouterProvider } from 'react-router-dom'
import { useTheme } from '../shared/contexts/theme-context'
import { router } from './router'

export const AppRouter = () => {
  const { resolvedTheme } = useTheme()

  return (
    <ConfigProvider
      locale={zhCN}
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
      <RouterProvider router={router} />
    </ConfigProvider>
  )
}
