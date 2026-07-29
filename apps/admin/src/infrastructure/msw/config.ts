export const MSW_GLOBAL_ENABLED_STORAGE_KEY = 'admin-msw-global-enabled'

export const isMswGlobalToggleAvailable =
  import.meta.env.DEV && typeof __ENABLE_TEMPLATE_ROUTES__ !== 'undefined' && __ENABLE_TEMPLATE_ROUTES__

export const getStoredMswEnabled = (): boolean => {
  if (typeof window === 'undefined' || !isMswGlobalToggleAvailable) {
    return false
  }

  try {
    return window.localStorage.getItem(MSW_GLOBAL_ENABLED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export const setStoredMswEnabled = (enabled: boolean) => {
  if (typeof window === 'undefined' || !isMswGlobalToggleAvailable) {
    return
  }

  try {
    window.localStorage.setItem(MSW_GLOBAL_ENABLED_STORAGE_KEY, String(enabled))
  } catch {
    // Ignore storage failures and keep runtime state available.
  }
}
