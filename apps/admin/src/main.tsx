import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import { AppRouter } from './routes'
import { AuthProvider } from './infrastructure/auth/auth-context'
import { I18nProvider } from './shared/contexts/i18n-context'
import { ThemeProvider } from './shared/contexts/theme-context'
import './index.css'

dayjs.locale('zh-cn')

const bootstrap = async () => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </StrictMode>
  )
}

void bootstrap()
