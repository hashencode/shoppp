import React from 'react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'

void React

export const THEME_STORAGE_KEY = 'admin-theme-mode'
export const SEARCH_COMPACT_LAYOUT_STORAGE_KEY = 'admin-search-compact-layout'
export const LIST_AUTO_REFRESH_STORAGE_KEY = 'admin-list-auto-refresh-enabled'
export const FORM_CONTENT_ALIGN_STORAGE_KEY = 'admin-form-content-align'

export type ThemeMode = 'light' | 'dark' | 'system'
export type FormContentAlign = 'left' | 'center' | 'right'
type ResolvedTheme = 'light' | 'dark'

type ThemeContextValue = {
  mode: ThemeMode
  resolvedTheme: ResolvedTheme
  searchCompactLayout: boolean
  listAutoRefreshEnabled: boolean
  formContentAlign: FormContentAlign
  setMode: (mode: ThemeMode) => void
  setSearchCompactLayout: (enabled: boolean) => void
  setListAutoRefreshEnabled: (enabled: boolean) => void
  setFormContentAlign: (align: FormContentAlign) => void
  toggleTheme: () => void
}

const FALLBACK_MODE: ThemeMode = 'system'
const VALID_MODES: ThemeMode[] = ['light', 'dark', 'system']
const FALLBACK_FORM_CONTENT_ALIGN: FormContentAlign = 'center'
const VALID_FORM_CONTENT_ALIGNS: FormContentAlign[] = ['left', 'center', 'right']
const noop = () => undefined
const DEFAULT_THEME_CONTEXT_VALUE: ThemeContextValue = {
  mode: FALLBACK_MODE,
  resolvedTheme: 'light',
  searchCompactLayout: false,
  listAutoRefreshEnabled: false,
  formContentAlign: FALLBACK_FORM_CONTENT_ALIGN,
  setMode: noop,
  setSearchCompactLayout: noop,
  setListAutoRefreshEnabled: noop,
  setFormContentAlign: noop,
  toggleTheme: noop,
}

const ThemeContext = createContext<ThemeContextValue>(DEFAULT_THEME_CONTEXT_VALUE)

const isThemeMode = (value: string | null): value is ThemeMode =>
  value !== null && VALID_MODES.includes(value as ThemeMode)

const isFormContentAlign = (value: string | null): value is FormContentAlign =>
  value !== null && VALID_FORM_CONTENT_ALIGNS.includes(value as FormContentAlign)

const getSystemTheme = (): ResolvedTheme => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const getStoredMode = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return FALLBACK_MODE
  }

  try {
    const storedMode = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeMode(storedMode) ? storedMode : FALLBACK_MODE
  } catch {
    return FALLBACK_MODE
  }
}

const getStoredSearchCompactLayout = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(SEARCH_COMPACT_LAYOUT_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

const getStoredFormContentAlign = (): FormContentAlign => {
  if (typeof window === 'undefined') {
    return FALLBACK_FORM_CONTENT_ALIGN
  }

  try {
    const storedAlign = window.localStorage.getItem(FORM_CONTENT_ALIGN_STORAGE_KEY)
    return isFormContentAlign(storedAlign) ? storedAlign : FALLBACK_FORM_CONTENT_ALIGN
  } catch {
    return FALLBACK_FORM_CONTENT_ALIGN
  }
}

const getStoredListAutoRefreshEnabled = (): boolean => {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(LIST_AUTO_REFRESH_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export const ThemeProvider = ({ children }: PropsWithChildren) => {
  const [mode, setMode] = useState<ThemeMode>(getStoredMode)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)
  const [searchCompactLayout, setSearchCompactLayout] = useState<boolean>(
    getStoredSearchCompactLayout
  )
  const [listAutoRefreshEnabled, setListAutoRefreshEnabled] = useState<boolean>(
    getStoredListAutoRefreshEnabled
  )
  const [formContentAlign, setFormContentAlign] = useState<FormContentAlign>(
    getStoredFormContentAlign
  )

  const resolvedTheme = mode === 'system' ? systemTheme : mode

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const rootElement = document.documentElement
    rootElement.setAttribute('data-theme', resolvedTheme)
    rootElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  useEffect(() => {
    document.documentElement.setAttribute('data-form-content-align', formContentAlign)
  }, [formContentAlign])

  useEffect(() => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, mode)
    } catch {
      // Ignore storage failures and keep runtime theme state available.
    }
  }, [mode])

  useEffect(() => {
    try {
      window.localStorage.setItem(SEARCH_COMPACT_LAYOUT_STORAGE_KEY, String(searchCompactLayout))
    } catch {
      // Ignore storage failures and keep runtime UI preference state available.
    }
  }, [searchCompactLayout])

  useEffect(() => {
    try {
      window.localStorage.setItem(FORM_CONTENT_ALIGN_STORAGE_KEY, formContentAlign)
    } catch {
      // Ignore storage failures and keep runtime UI preference state available.
    }
  }, [formContentAlign])

  useEffect(() => {
    try {
      window.localStorage.setItem(LIST_AUTO_REFRESH_STORAGE_KEY, String(listAutoRefreshEnabled))
    } catch {
      // Ignore storage failures and keep runtime UI preference state available.
    }
  }, [listAutoRefreshEnabled])

  const toggleTheme = useCallback(() => {
    setMode((currentMode) => {
      const currentResolved = currentMode === 'system' ? getSystemTheme() : currentMode
      return currentResolved === 'dark' ? 'light' : 'dark'
    })
  }, [])

  const value = useMemo(
    () => ({
      mode,
      resolvedTheme,
      searchCompactLayout,
      listAutoRefreshEnabled,
      formContentAlign,
      setMode,
      setSearchCompactLayout,
      setListAutoRefreshEnabled,
      setFormContentAlign,
      toggleTheme,
    }),
    [
      formContentAlign,
      listAutoRefreshEnabled,
      mode,
      resolvedTheme,
      searchCompactLayout,
      toggleTheme,
    ]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export const useTheme = () => {
  return useContext(ThemeContext)
}
