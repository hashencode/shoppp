import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import { useTemplateListController } from './use-template-list-controller'

type Item = { key: string; name: string }
type Response = { data: Item[]; partial?: boolean }
type Filters = { name?: string }
type ListError = { message: string }

describe('useTemplateListController', () => {
  it('loads list data and applies transformResponse', async () => {
    let lastRequestFilters: Filters | null = null
    const request = async (filters: Filters): Promise<Response> => {
      lastRequestFilters = filters
      return {
        data: [
          { key: '1', name: 'alpha' },
          { key: '2', name: 'beta' },
        ],
      }
    }

    const { result } = renderHook(() =>
      useTemplateListController<Filters, Response, Item, ListError>({
        filters: { name: 'a' },
        request,
        selectItems: (response) => response?.data ?? [],
        transformResponse: (response) => ({
          ...response,
          data: response.data.filter((item) => item.key !== '2'),
        }),
      })
    )

    await act(async () => {
      await result.current.load()
    })

    expect(lastRequestFilters).toEqual({ name: 'a' })
    expect(result.current.data).toEqual([{ key: '1', name: 'alpha' }])
    expect(result.current.showEmpty).toBe(false)
  })

  it('maps request errors and exposes error state', async () => {
    const request = async (): Promise<Response> => {
      throw new Error('boom')
    }
    let mapErrorCallCount = 0
    const mapError = (error: unknown): ListError => {
      void error
      mapErrorCallCount += 1
      return {
        message: 'mapped boom',
      }
    }
    let onErrorCallCount = 0
    const onError = (error: ListError, filters: Filters) => {
      void error
      void filters
      onErrorCallCount += 1
    }

    const { result } = renderHook(() =>
      useTemplateListController<Filters, Response, Item, ListError>({
        filters: {},
        request,
        selectItems: (response) => response?.data ?? [],
        mapError,
        onError,
      })
    )

    await act(async () => {
      await result.current.load()
    })

    expect(mapErrorCallCount).toBe(1)
    expect(onErrorCallCount).toBe(1)
    expect(result.current.error).toEqual({ message: 'mapped boom' })
    expect(result.current.showError).toBe(true)
  })

  it('shows partial view state when response is marked partial', async () => {
    const request = async (): Promise<Response> => ({
      data: [{ key: '1', name: 'alpha' }],
      partial: true,
    })

    const { result } = renderHook(() =>
      useTemplateListController<Filters, Response, Item, ListError>({
        filters: {},
        request,
        selectItems: (response) => response?.data ?? [],
        isPartial: (response) => Boolean(response?.partial),
      })
    )

    await act(async () => {
      await result.current.load()
    })

    expect(result.current.showPartial).toBe(true)
    expect(result.current.showError).toBe(false)
  })

  it('shows empty view state when response contains no rows', async () => {
    const request = async (): Promise<Response> => ({ data: [] })

    const { result } = renderHook(() =>
      useTemplateListController<Filters, Response, Item, ListError>({
        filters: {},
        request,
        selectItems: (response) => response?.data ?? [],
      })
    )

    await act(async () => {
      await result.current.load()
    })

    expect(result.current.showEmpty).toBe(true)
    expect(result.current.data).toEqual([])
  })

  it('keeps load reference stable when onError callback identity changes', () => {
    const fixedFilters: Filters = {}
    const request = async (filters: Filters): Promise<Response> => {
      void filters
      return {
        data: [{ key: '1', name: 'alpha' }],
      }
    }

    const { result, rerender } = renderHook(
      ({ onError }: { onError: (error: ListError, filters: Filters) => void }) =>
        useTemplateListController<Filters, Response, Item, ListError>({
          filters: fixedFilters,
          request,
          selectItems: (response) => response?.data ?? [],
          mapError: (error) => {
            void error
            return { message: 'mapped' }
          },
          onError,
        }),
      {
        initialProps: {
          onError: (error: ListError, filters: Filters) => {
            void error
            void filters
          },
        },
      }
    )

    const firstLoad = result.current.load

    rerender({
      onError: (error: ListError, filters: Filters) => {
        void error
        void filters
      },
    })

    expect(result.current.load).toBe(firstLoad)
  })

  it('clears extended loading when a normal load supersedes minimum loading', async () => {
    let requestCallCount = 0
    const request = async (): Promise<Response> => {
      requestCallCount += 1
      return { data: [{ key: String(requestCallCount), name: `row-${requestCallCount}` }] }
    }

    const { result } = renderHook(() =>
      useTemplateListController<Filters, Response, Item, ListError>({
        filters: {},
        request,
        selectItems: (response) => response?.data ?? [],
      })
    )

    let firstLoadPromise: Promise<void> | undefined
    act(() => {
      firstLoadPromise = result.current.load({ minimumLoadingMs: 100 })
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(true)
    })

    await act(async () => {
      await result.current.load()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toEqual([{ key: '2', name: 'row-2' }])

    await act(async () => {
      await firstLoadPromise
    })

    expect(result.current.loading).toBe(false)
  })
})
