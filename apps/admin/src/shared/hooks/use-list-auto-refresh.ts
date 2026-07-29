import { useEffect, useRef } from 'react'
import { useTheme } from '../contexts/theme-context'

type UseListAutoRefreshOptions = {
  onRefresh?: () => void
}

const AUTO_REFRESH_DEDUP_MS = 300

export const useListAutoRefresh = ({ onRefresh }: UseListAutoRefreshOptions) => {
  const { listAutoRefreshEnabled } = useTheme()
  const lastRefreshAtRef = useRef(0)

  useEffect(() => {
    if (!listAutoRefreshEnabled || !onRefresh || typeof window === 'undefined') {
      return
    }

    const triggerRefresh = () => {
      const now = Date.now()
      if (now - lastRefreshAtRef.current < AUTO_REFRESH_DEDUP_MS) {
        return
      }

      lastRefreshAtRef.current = now
      onRefresh()
    }

    const handleWindowFocus = () => {
      if (document.visibilityState !== 'visible') {
        return
      }

      triggerRefresh()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        return
      }

      triggerRefresh()
    }

    window.addEventListener('focus', handleWindowFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleWindowFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [listAutoRefreshEnabled, onRefresh])
}
