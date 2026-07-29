import { useCallback, useMemo, useState } from 'react'
import type { TablePaginationConfig } from 'antd'

export type StandardPaginationConfig = {
  defaultPageSize?: number
  maxPageSize?: number
  pageSizeOptions?: number[]
}

type UseStandardPaginationOptions = StandardPaginationConfig & {
  total: number
}

type StandardPaginationResult = {
  current: number
  pageSize: number
  pagination: TablePaginationConfig
  resetPage: () => void
}

const DEFAULT_PAGE_SIZE = 10
const DEFAULT_MAX_PAGE_SIZE = 99999
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]
export const ALL_DATA_PAGE_SIZE = 99999
export const VIRTUAL_SCROLL_PAGE_SIZE_THRESHOLD = 100

const buildPageSizeOptionLabel = (value: number) => {
  return value === ALL_DATA_PAGE_SIZE ? '所有数据' : `${value} 条/页`
}

export const buildStandardPageSizeSelectProps = (pageSizeOptions: number[]) => ({
  showSearch: false,
  optionLabelProp: 'label',
  options: pageSizeOptions.map((value) => ({
    label: buildPageSizeOptionLabel(value),
    value,
  })),
})

const toPositiveInteger = (value: number | string, fallback: number) => {
  const normalizedValue = Number(value)
  return Number.isFinite(normalizedValue) && normalizedValue > 0 ? Math.floor(normalizedValue) : fallback
}

const clampPageSize = (nextPageSize: number | string, maxPageSize: number, defaultPageSize: number) => {
  return Math.min(toPositiveInteger(nextPageSize, defaultPageSize), maxPageSize)
}

const getMaxPage = (total: number, pageSize: number) => {
  if (total <= 0) {
    return 1
  }

  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
}

export const useStandardPagination = ({
  total,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  maxPageSize = DEFAULT_MAX_PAGE_SIZE,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: UseStandardPaginationOptions): StandardPaginationResult => {
  const safeDefaultPageSize = clampPageSize(defaultPageSize, maxPageSize, DEFAULT_PAGE_SIZE)
  const safePageSizeOptions = useMemo(() => {
    const merged = new Set(
      pageSizeOptions
        .map((value) => toPositiveInteger(value, safeDefaultPageSize))
        .filter((value) => value <= maxPageSize)
    )
    merged.add(safeDefaultPageSize)
    merged.add(ALL_DATA_PAGE_SIZE)
    return [...merged].sort((a, b) => a - b)
  }, [maxPageSize, pageSizeOptions, safeDefaultPageSize])

  const sizeChangerProps = useMemo(
    () => buildStandardPageSizeSelectProps(safePageSizeOptions),
    [safePageSizeOptions]
  )

  const [requestedPage, setRequestedPage] = useState(1)
  const [pageSize, setPageSize] = useState(safeDefaultPageSize)

  const current = useMemo(
    () => {
      const maxPage = getMaxPage(total, pageSize)
      return Math.min(Math.max(toPositiveInteger(requestedPage, 1), 1), maxPage)
    },
    [pageSize, requestedPage, total]
  )

  const resetPage = useCallback(() => {
    setRequestedPage(1)
  }, [])

  const pagination = useMemo<TablePaginationConfig>(
    () => ({
      current,
      pageSize,
      total,
      size: 'middle',
      showQuickJumper: true,
      showSizeChanger: sizeChangerProps,
      pageSizeOptions: safePageSizeOptions,
      onChange: (nextPage, nextPageSize) => {
        const normalizedPageSize = clampPageSize(
          nextPageSize ?? pageSize,
          maxPageSize,
          safeDefaultPageSize
        )

        setPageSize(normalizedPageSize)
        setRequestedPage(normalizedPageSize === pageSize ? nextPage : 1)
      },
    }),
    [current, maxPageSize, pageSize, safeDefaultPageSize, safePageSizeOptions, sizeChangerProps, total]
  )

  return {
    current,
    pageSize,
    pagination,
    resetPage,
  }
}
