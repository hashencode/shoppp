import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { zhCNMessages } from '../i18n/translations'

void React

export type AppLocale = 'en-US' | 'zh-CN'

export const LANGUAGE_STORAGE_KEY = 'shoppp.admin.locale'

type TranslationValues = Record<string, number | string>

type I18nContextValue = {
  locale: AppLocale
  setLocale: (locale: AppLocale) => boolean
  t: (message: string, values?: TranslationValues) => string
}

const fallbackI18nContext: I18nContextValue = {
  locale: 'zh-CN',
  setLocale: () => false,
  t: (message, values) => interpolate(zhCNMessages[message] ?? message, values),
}

const I18nContext = createContext<I18nContextValue>(fallbackI18nContext)

const isAppLocale = (value: string | null): value is AppLocale =>
  value === 'en-US' || value === 'zh-CN'

const getSystemLocale = (): AppLocale => {
  if (typeof navigator === 'undefined') return 'en-US'
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
  return languages[0]?.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

export const getInitialLocale = (): AppLocale => {
  if (typeof window === 'undefined') return 'en-US'
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return isAppLocale(stored) ? stored : getSystemLocale()
  } catch {
    return getSystemLocale()
  }
}

const interpolate = (message: string, values?: TranslationValues) => {
  if (!values) return message
  return message.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : placeholder
  )
}

export const translateMessage = (
  locale: AppLocale,
  message: string,
  values?: TranslationValues
) => {
  const translated = locale === 'zh-CN' ? (zhCNMessages[message] ?? message) : message
  return interpolate(translated, values)
}

export const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [locale, setLocaleState] = useState<AppLocale>(getInitialLocale)

  useEffect(() => {
    document.documentElement.lang = locale
    dayjs.locale(locale === 'zh-CN' ? 'zh-cn' : 'en')
  }, [locale])

  const setLocale = useCallback((nextLocale: AppLocale) => {
    let persisted = false
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLocale)
      persisted = true
    } catch {
      // Keep the in-memory selection when storage is unavailable.
    }
    setLocaleState(nextLocale)
    return persisted
  }, [])

  const t = useCallback(
    (message: string, values?: TranslationValues) => translateMessage(locale, message, values),
    [locale]
  )

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export const useI18n = () => {
  return useContext(I18nContext)
}

export const useCurrentTranslate = () => {
  const { t } = useI18n()
  const translateRef = useRef(t)

  useLayoutEffect(() => {
    translateRef.current = t
  }, [t])

  return useCallback<I18nContextValue['t']>((message, values) => {
    return translateRef.current(message, values)
  }, [])
}
