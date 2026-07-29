import { useCallback } from 'react'
import type { FormMode } from '../../../routes/form-route-contract'
import { openAppPathInNewWindow, withAppBasePath } from '../../utils/app-base'

const WINDOW_CLOSE_FALLBACK_DELAY = 160

type ClosableWindow = Pick<Window, 'closed' | 'close' | 'setTimeout'> & {
  history: Pick<History, 'length' | 'back'>
  location: Pick<Location, 'assign'>
}

const getCurrentWindow = (): ClosableWindow => window

export const closeWindowWithFallback = (
  fallbackPath: string,
  targetWindow: ClosableWindow = getCurrentWindow(),
  appBasePath?: string
) => {
  targetWindow.close()

  targetWindow.setTimeout(() => {
    try {
      if (targetWindow.closed) return
      if (targetWindow.history.length > 1) {
        targetWindow.history.back()
        return
      }
      targetWindow.location.assign(withAppBasePath(fallbackPath, appBasePath))
    } catch {
      // The window may be torn down before this best-effort fallback runs.
    }
  }, WINDOW_CLOSE_FALLBACK_DELAY)
}

export const goBackOrCloseWindow = (
  fallbackPath: string,
  targetWindow: ClosableWindow = getCurrentWindow(),
  appBasePath?: string
) => {
  if (targetWindow.history.length > 1) {
    targetWindow.history.back()
    return
  }

  closeWindowWithFallback(fallbackPath, targetWindow, appBasePath)
}

export const useCrudFormNavigation = (formRoute: string) => {
  const openFormPage = useCallback(
    (mode: FormMode, resourceKey?: string) => {
      const params = new URLSearchParams({ mode })
      if (resourceKey) {
        params.set('id', resourceKey)
      }

      openAppPathInNewWindow(`${formRoute}?${params.toString()}`)
    },
    [formRoute]
  )

  return {
    openFormPage,
  }
}
