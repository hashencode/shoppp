import { useCallback, useEffect, useRef, useState } from 'react'

type UseLatestRequestOptions<TData, TArgs extends unknown[], TError> = {
  request: (...args: TArgs) => Promise<TData>
  mapError?: (error: unknown) => TError
  onError?: (error: TError, args: TArgs) => void
}

type UseLatestRequestRunResult<TData, TError> =
  | { status: 'success'; data: TData }
  | { status: 'error'; error: TError }
  | { status: 'ignored' }

type UseLatestRequestResult<TData, TArgs extends unknown[], TError> = {
  loading: boolean
  error: TError | null
  runWithResult: (...args: TArgs) => Promise<UseLatestRequestRunResult<TData, TError>>
  run: (...args: TArgs) => Promise<TData | undefined>
  clearError: () => void
}

export const useLatestRequest = <TData, TArgs extends unknown[] = [], TError = unknown>({
  request,
  mapError,
  onError,
}: UseLatestRequestOptions<TData, TArgs, TError>): UseLatestRequestResult<TData, TArgs, TError> => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<TError | null>(null)
  const requestIdRef = useRef(0)
  const requestRef = useRef(request)
  const mapErrorRef = useRef(mapError)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    requestRef.current = request
  }, [request])

  useEffect(() => {
    mapErrorRef.current = mapError
  }, [mapError])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const runWithResult = useCallback(
    async (...args: TArgs): Promise<UseLatestRequestRunResult<TData, TError>> => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      setLoading(true)
      setError(null)

      try {
        const response = await requestRef.current(...args)
        if (requestId !== requestIdRef.current) {
          return { status: 'ignored' }
        }

        return {
          status: 'success',
          data: response,
        }
      } catch (requestError) {
        if (requestId !== requestIdRef.current) {
          return { status: 'ignored' }
        }

        const normalizedError = mapErrorRef.current
          ? mapErrorRef.current(requestError)
          : (requestError as TError)
        setError(normalizedError)
        onErrorRef.current?.(normalizedError, args)
        return {
          status: 'error',
          error: normalizedError,
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    },
    []
  )

  const run = useCallback(
    async (...args: TArgs): Promise<TData | undefined> => {
      const result = await runWithResult(...args)
      if (result.status !== 'success') {
        return undefined
      }

      return result.data
    },
    [runWithResult]
  )

  return {
    loading,
    error,
    runWithResult,
    run,
    clearError,
  }
}
