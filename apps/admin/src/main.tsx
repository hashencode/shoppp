import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { getStoredMswEnabled, isMswGlobalToggleAvailable } from './infrastructure/msw/config'
import { AppRouter } from './routes'
import { AuthProvider } from './infrastructure/auth/auth-context'
import { ThemeProvider } from './shared/contexts/theme-context'
import './index.css'

dayjs.locale('zh-cn')

const bootstrap = async () => {
  if (isMswGlobalToggleAvailable && getStoredMswEnabled()) {
    const { enableMocking } = await import('./infrastructure/msw/browser')
    await enableMocking()
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </ThemeProvider>
    </StrictMode>
  )
}

void bootstrap()
