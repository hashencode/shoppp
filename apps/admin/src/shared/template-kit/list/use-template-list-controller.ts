import { message } from 'antd'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { useListAutoRefresh } from '../../hooks/use-list-auto-refresh'
import { useLatestRequest } from '../hooks/use-latest-request'
import { useListRefreshChannel } from '../hooks/use-list-refresh-channel'
import { useQueryViewState } from '../hooks/use-query-view-state'

type RefreshChannelConfig = {
  channelName: string
  eventType: string
}

type UseTemplateListControllerOptions<TFilter, TResponse, TItem, TError> = {
  filters: TFilter
  request: (filters: TFilter) => Promise<TResponse>
  selectItems: (response: TResponse | null) => TItem[]
  isPartial?: (response: TResponse | null) => boolean
  mapError?: (error: unknown) => TError
  onError?: (error: TError, filters: TFilter) => void
  transformResponse?: (response: TResponse) => TResponse
  refreshChannel?: RefreshChannelConfig
  enableAutoRefresh?: boolean
}

type UseTemplateListControllerResult<TResponse, TItem, TError> = {
  response: TResponse | null
  setResponse: Dispatch<SetStateAction<TResponse | null>>
  data: TItem[]
  loading: boolean
  error: TError | null
  showInitialLoading: boolean
  showError: boolean
  showEmpty: boolean
  showPartial: boolean
  load: (options?: {
    showSuccess?: boolean
    transformResponse?: (response: TResponse) => TResponse
    minimumLoadingMs?: number
  }) => Promise<void>
}

export const useTemplateListController = <TFilter, TResponse, TItem, TError = unknown>({
  filters,
  request,
  selectItems,
  isPartial,
  mapError,
  onError,
  transformResponse,
  refreshChannel,
  enableAutoRefresh = true,
}: UseTemplateListControllerOptions<
  TFilter,
  TResponse,
  TItem,
  TError
>): UseTemplateListControllerResult<TResponse, TItem, TError> => {
  const [response, setResponse] = useState<TResponse | null>(null)
  const [extendedLoading, setExtendedLoading] = useState(false)
  const transformResponseRef = useRef(transformResponse)
  const activeLoadIdRef = useRef(0)
  const {
    loading,
    error,
    runWithResult: runRequest,
  } = useLatestRequest<TResponse, [TFilter], TError>({
    request,
    mapError,
    onError: (requestError) => {
      onError?.(requestError, filters)
    },
  })

  useEffect(() => {
    transformResponseRef.current = transformResponse
  }, [transformResponse])

  const load = useCallback(
    async (options?: {
      showSuccess?: boolean
      transformResponse?: (response: TResponse) => TResponse
      minimumLoadingMs?: number
    }) => {
      const loadId = activeLoadIdRef.current + 1
      activeLoadIdRef.current = loadId
      const minimumLoadingMs = options?.minimumLoadingMs ?? 0
      const shouldExtendLoading = minimumLoadingMs > 0
      const requestStartedAt = Date.now()

      if (shouldExtendLoading) {
        setExtendedLoading(true)
      } else {
        setExtendedLoading(false)
      }

      const settleExtendedLoading = async () => {
        if (!shouldExtendLoading) {
          return
        }

        const elapsed = Date.now() - requestStartedAt
        const remaining = minimumLoadingMs - elapsed
        if (remaining > 0) {
          await new Promise((resolve) => {
            setTimeout(resolve, remaining)
          })
        }

        if (activeLoadIdRef.current === loadId) {
          setExtendedLoading(false)
        }
      }

      const requestResult = await runRequest(filters)
      if (requestResult.status !== 'success') {
        await settleExtendedLoading()
        return
      }

      const nextResponse = requestResult.data
      if (nextResponse == null) {
        setResponse(null)
        await settleExtendedLoading()
        return
      }

      const applied =
        options?.transformResponse?.(nextResponse) ??
        transformResponseRef.current?.(nextResponse) ??
        nextResponse
      setResponse(applied)
      await settleExtendedLoading()

      if (options?.showSuccess) {
        void message.success('刷新成功')
      }
    },
    [filters, runRequest]
  )

  useEffect(() => {
    return () => {
      activeLoadIdRef.current += 1
    }
  }, [])

  useListRefreshChannel({
    channelName: refreshChannel?.channelName ?? '',
    eventType: refreshChannel?.eventType ?? '',
    onRefresh: refreshChannel
      ? () => {
          void load()
        }
      : undefined,
  })

  useListAutoRefresh({
    onRefresh: enableAutoRefresh
      ? () => {
          void load()
        }
      : undefined,
  })

  const data = selectItems(response)
  const visibleLoading = loading || extendedLoading
  const { showInitialLoading, showError, showEmpty, showPartial } = useQueryViewState({
    loading: visibleLoading,
    hasData: Boolean(response),
    isEmpty: data.length === 0,
    hasError: Boolean(error),
    isPartial: isPartial ? isPartial(response) : false,
  })

  return {
    response,
    setResponse,
    data,
    loading: visibleLoading,
    error,
    showInitialLoading,
    showError,
    showEmpty,
    showPartial,
    load,
  }
}
