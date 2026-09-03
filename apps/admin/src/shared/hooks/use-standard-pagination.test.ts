import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from '@rstest/core'
import {
  ALL_DATA_PAGE_SIZE,
  useStandardPagination,
  VIRTUAL_SCROLL_PAGE_SIZE_THRESHOLD,
} from './use-standard-pagination'

describe('useStandardPagination', () => {
  it('includes the all-data option and disables size changer search', () => {
    const { result } = renderHook(() =>
      useStandardPagination({
        total: 200,
      })
    )

    expect(result.current.pagination.pageSizeOptions).toContain(ALL_DATA_PAGE_SIZE)
    expect(result.current.pagination.pageSizeOptions).toEqual([10, 20, 50, 100, ALL_DATA_PAGE_SIZE])
    expect(result.current.pagination.showSizeChanger).toMatchObject({
      showSearch: false,
      optionLabelProp: 'label',
    })
  })

  it('should reset to the first page when switching to all-data page size', () => {
    const { result } = renderHook(() =>
      useStandardPagination({
        total: 200,
      })
    )

    act(() => {
      result.current.pagination.onChange?.(3, 10)
    })

    expect(result.current.current).toBe(3)
    expect(result.current.pageSize).toBe(10)

    act(() => {
      result.current.pagination.onChange?.(3, ALL_DATA_PAGE_SIZE)
    })

    expect(result.current.current).toBe(1)
    expect(result.current.pageSize).toBe(ALL_DATA_PAGE_SIZE)
  })

  it('should exclude all-data even from custom options when disabled', () => {
    const { result } = renderHook(() =>
      useStandardPagination({
        total: 200,
        defaultPageSize: 20,
        pageSizeOptions: [10, 50, ALL_DATA_PAGE_SIZE],
        includeAllDataOption: false,
      })
    )

    expect(result.current.pagination.pageSizeOptions).toEqual([10, 20, 50])
  })

  it('should clamp an oversized page change to the remote API maximum', () => {
    const { result } = renderHook(() =>
      useStandardPagination({
        total: 300,
        includeAllDataOption: false,
        maxPageSize: 100,
      })
    )

    expect(result.current.pagination.pageSizeOptions).toEqual([10, 20, 50, 100])
    act(() => {
      result.current.pagination.onChange?.(3, 10)
    })
    expect(result.current.current).toBe(3)
    act(() => {
      result.current.pagination.onChange?.(3, ALL_DATA_PAGE_SIZE)
    })
    expect(result.current.current).toBe(1)
    expect(result.current.pageSize).toBe(100)
  })

  it('keeps the default virtual-scroll threshold option in page size choices', () => {
    const { result } = renderHook(() =>
      useStandardPagination({
        total: 200,
      })
    )

    expect(result.current.pagination.pageSizeOptions).toContain(VIRTUAL_SCROLL_PAGE_SIZE_THRESHOLD)
  })
})
