import { Button, Empty, Select, Spin } from 'antd'
import type { SelectProps } from 'antd'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../contexts/i18n-context'

void React

export type RemoteSearchSelectValue = string | number

type RemoteSearchSelectMode = 'multiple' | 'tags' | undefined

type RemoteSearchSelectedValue<
  TValue extends RemoteSearchSelectValue,
  TMode extends RemoteSearchSelectMode,
> = TMode extends 'multiple' | 'tags' ? TValue[] : TValue

export type RemoteSearchSelectOption<
  TRaw = unknown,
  TValue extends RemoteSearchSelectValue = RemoteSearchSelectValue,
> = {
  label: string
  value: TValue
  raw?: TRaw
}

export type RemoteSearchSelectProps<
  TRaw = unknown,
  TValue extends RemoteSearchSelectValue = RemoteSearchSelectValue,
  TMode extends RemoteSearchSelectMode = undefined,
> = Omit<
  SelectProps<RemoteSearchSelectedValue<TValue, TMode>, RemoteSearchSelectOption<TRaw, TValue>>,
  'options' | 'filterOption' | 'onSearch' | 'notFoundContent' | 'mode'
> & {
  defaultOptions?: RemoteSearchSelectOption<TRaw, TValue>[]
  emptyContent?: React.ReactNode
  fetchOptions: (
    keyword: string,
    current?: number
  ) => Promise<RemoteSearchSelectOption<TRaw, TValue>[]>
  enablePagination?: boolean
  loadOnMount?: boolean
  loadOnOpen?: boolean
  mode?: TMode
  onFetchError?: (error: unknown) => void
}

const DEFAULT_PAGE = 1
const SEARCH_DEBOUNCE_MS = 300

type RetryRequest = {
  keyword: string
  page: number
  replace: boolean
}

const uniqueByValue = <TRaw, TValue extends RemoteSearchSelectValue>(
  items: RemoteSearchSelectOption<TRaw, TValue>[]
) => {
  const seenValues = new Set<TValue>()
  return items.filter((item) => {
    if (seenValues.has(item.value)) return false
    seenValues.add(item.value)
    return true
  })
}

export const RemoteSearchSelect = <
  TRaw = unknown,
  TValue extends RemoteSearchSelectValue = RemoteSearchSelectValue,
  TMode extends RemoteSearchSelectMode = undefined,
>({
  defaultOptions,
  emptyContent,
  enablePagination = true,
  fetchOptions,
  loadOnMount = true,
  loadOnOpen = false,
  loading: externalLoading,
  mode,
  onChange,
  onClear,
  onFetchError,
  onOpenChange,
  onPopupScroll,
  allowClear = true,
  showSearch,
  ...props
}: RemoteSearchSelectProps<TRaw, TValue, TMode>) => {
  const { t } = useI18n()
  const [options, setOptions] = useState<RemoteSearchSelectOption<TRaw, TValue>[]>(
    defaultOptions ?? []
  )
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const currentPage = useRef(DEFAULT_PAGE)
  const currentKeyword = useRef('')
  const activeRequestId = useRef(0)
  const mounted = useRef(true)
  const loadingRef = useRef(false)
  const hasMore = useRef(true)
  const retryRequest = useRef<RetryRequest | undefined>(undefined)
  const hasRequested = useRef(false)
  const searchTimer = useRef<number | undefined>(undefined)
  const fetchOptionsRef = useRef(fetchOptions)
  const onFetchErrorRef = useRef(onFetchError)
  const defaultOptionsRef = useRef(defaultOptions ?? [])

  useEffect(() => {
    fetchOptionsRef.current = fetchOptions
    onFetchErrorRef.current = onFetchError
    defaultOptionsRef.current = defaultOptions ?? []
  }, [defaultOptions, fetchOptions, onFetchError])

  const mergeOptions = useCallback(
    (nextOptions: RemoteSearchSelectOption<TRaw, TValue>[], replace = false) => {
      setOptions((current) => {
        const merged = uniqueByValue(
          replace ? [...defaultOptionsRef.current, ...nextOptions] : [...current, ...nextOptions]
        )
        return merged.length === current.length && merged.every((item, index) => item === current[index])
          ? current
          : merged
      })
    },
    []
  )

  const loadPage = useCallback(
    async (keyword: string, page = DEFAULT_PAGE, replace = false) => {
      if (!mounted.current) {
        return
      }

      const requestId = activeRequestId.current + 1
      activeRequestId.current = requestId
      hasRequested.current = true
      loadingRef.current = true
      retryRequest.current = undefined
      setLoading(true)
      setLoadError(false)
      try {
        const nextOptions = await fetchOptionsRef.current(keyword, page)
        if (!mounted.current || activeRequestId.current !== requestId) {
          return
        }

        currentPage.current = page
        hasMore.current = nextOptions.length > 0
        mergeOptions(nextOptions, replace)
      } catch (error) {
        if (!mounted.current || activeRequestId.current !== requestId) {
          return
        }

        setLoadError(true)
        retryRequest.current = { keyword, page, replace }
        onFetchErrorRef.current?.(error)
      } finally {
        if (mounted.current && activeRequestId.current === requestId) {
          loadingRef.current = false
          setLoading(false)
        }
      }
    },
    [mergeOptions]
  )

  useEffect(() => {
    if (!defaultOptions?.length) {
      return
    }

    const timer = window.setTimeout(() => {
      if (mounted.current) {
        mergeOptions(defaultOptions)
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [defaultOptions, mergeOptions])

  useEffect(() => {
    if (!loadOnMount) {
      return
    }

    const timer = window.setTimeout(() => {
      hasMore.current = true
      void loadPage('', DEFAULT_PAGE, true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadOnMount, loadPage])

  const cancelSearch = useCallback(() => {
    if (searchTimer.current === undefined) {
      return
    }

    window.clearTimeout(searchTimer.current)
    searchTimer.current = undefined
  }, [])

  const handleSearch = useCallback(
    (keyword: string) => {
      cancelSearch()
      searchTimer.current = window.setTimeout(() => {
        currentKeyword.current = keyword
        currentPage.current = DEFAULT_PAGE
        hasMore.current = true
        searchTimer.current = undefined
        void loadPage(keyword, DEFAULT_PAGE, true)
      }, SEARCH_DEBOUNCE_MS)
    },
    [cancelSearch, loadPage]
  )

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
      activeRequestId.current += 1
      loadingRef.current = false
      cancelSearch()
    }
  }, [cancelSearch])

  const handleClear = useCallback(() => {
    cancelSearch()
    currentKeyword.current = ''
    currentPage.current = DEFAULT_PAGE
    hasMore.current = true
    void loadPage('', DEFAULT_PAGE, true)
    onClear?.()
  }, [cancelSearch, loadPage, onClear])

  const handleRetry = useCallback(() => {
    const retry = retryRequest.current
    if (!retry || loadingRef.current) {
      return
    }

    void loadPage(retry.keyword, retry.page, retry.replace)
  }, [loadPage])

  const handleChange = useCallback<
    NonNullable<
      SelectProps<
        RemoteSearchSelectedValue<TValue, TMode>,
        RemoteSearchSelectOption<TRaw, TValue>
      >['onChange']
    >
  >(
    (nextValue, option) => {
      onChange?.(nextValue, option)
    },
    [onChange]
  )

  const handlePopupScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      onPopupScroll?.(event)
      if (!enablePagination) {
        return
      }

      const target = event.currentTarget
      const reachBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 8
      if (!reachBottom || loadingRef.current || !hasMore.current) {
        return
      }

      const retry = retryRequest.current
      if (retry?.keyword === currentKeyword.current) {
        void loadPage(retry.keyword, retry.page, retry.replace)
        return
      }

      void loadPage(currentKeyword.current, currentPage.current + 1)
    },
    [enablePagination, loadPage, onPopupScroll]
  )

  const handleOpenChange = useCallback(
    (open: boolean) => {
      onOpenChange?.(open)
      if (
        open &&
        loadOnOpen &&
        (!hasRequested.current || loadError) &&
        !loadingRef.current
      ) {
        currentKeyword.current = ''
        currentPage.current = DEFAULT_PAGE
        hasMore.current = true
        void loadPage('', DEFAULT_PAGE, true)
      }
    },
    [loadError, loadOnOpen, loadPage, onOpenChange]
  )

  const notFoundContent = loading ? (
    <Spin size="small" aria-label={t('Loading options')} />
  ) : loadError ? (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('Failed to load. Try again.')}>
      <Button size="small" onClick={handleRetry}>
        {t('Retry loading')}
      </Button>
    </Empty>
  ) : (
    (emptyContent ?? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />)
  )

  const externalOnSearch = typeof showSearch === 'object' ? showSearch.onSearch : undefined
  const resolvedShowSearch: SelectProps<
    RemoteSearchSelectedValue<TValue, TMode>,
    RemoteSearchSelectOption<TRaw, TValue>
  >['showSearch'] =
    showSearch === false
      ? false
      : {
          optionFilterProp: 'label',
          filterOption: false,
          ...(typeof showSearch === 'object' ? showSearch : undefined),
          onSearch: (keyword) => {
            externalOnSearch?.(keyword)
            handleSearch(keyword)
          },
        }

  return (
    <Select<RemoteSearchSelectedValue<TValue, TMode>, RemoteSearchSelectOption<TRaw, TValue>>
      {...props}
      allowClear={allowClear}
      loading={loading || externalLoading}
      mode={mode}
      showSearch={resolvedShowSearch}
      notFoundContent={notFoundContent}
      onClear={handleClear}
      onChange={handleChange}
      onOpenChange={handleOpenChange}
      onPopupScroll={handlePopupScroll}
      options={options}
    />
  )
}
