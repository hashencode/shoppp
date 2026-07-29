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

const templateRoutesEnabled =
  typeof __ENABLE_TEMPLATE_ROUTES__ !== 'undefined' && __ENABLE_TEMPLATE_ROUTES__
const loadMocking = templateRoutesEnabled
  ? () => import('./infrastructure/msw/browser')
  : undefined

const bootstrap = async () => {
  if (isMswGlobalToggleAvailable && getStoredMswEnabled() && loadMocking) {
    const { enableMocking } = await loadMocking()
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
