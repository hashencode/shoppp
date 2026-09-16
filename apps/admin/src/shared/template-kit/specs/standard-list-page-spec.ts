import type { ReactNode } from 'react'
import type { MenuProps } from 'antd'
import type { TablePaginationConfig } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { ListStateCopyContract } from '../contracts/page-state-contract'
import type { TemplateListFilterField } from '../list/template-list-filter-form'
import type { StandardPaginationConfig } from '../../hooks/use-standard-pagination'
import type { PermissionKey } from '../../../infrastructure/auth/permissions'
import type { FormMode } from '../../../routes/form-route-contract'
import type { ActionColumnLayout } from '../list/resolve-action-column-width'

type StandardListExtensionHelpers<TRequestFilters> = {
  reload: () => Promise<void>
  appliedFilters: TRequestFilters
}

type StandardListToolbarExtra<TRequestFilters> =
  | {
      toolbarExtra?: never
      toolbarExtraVisible?: never
    }
  | {
      toolbarExtra:
        ReactNode | ((helpers: StandardListExtensionHelpers<TRequestFilters>) => ReactNode)
      toolbarExtraVisible: boolean
    }

export type StandardListPageSpec<
  TFilterValues extends Record<string, unknown>,
  TRequestFilters extends object,
  TResponse,
  TItem,
  TError,
> = {
  paginationMode?: 'remote' | 'local'
  pageTitle: string
  pageTitleHidden?: boolean
  cardTitle?: string
  tableId: string
  formRoute?: string
  openFormPage?: (mode: FormMode, resourceKey?: string) => void
  initialFilters: TRequestFilters
  initialFormValues?: TFilterValues
  toFilters: (values: TFilterValues) => TRequestFilters
  buildRequestFilters?: (context: {
    filters: TRequestFilters
    current: number
    pageSize: number
  }) => TRequestFilters
  request: (filters: TRequestFilters) => Promise<TResponse>
  selectItems: (response: TResponse | null) => TItem[]
  mapError?: (error: unknown) => TError
  isPartial?: (response: TResponse | null) => boolean
  onError?: (error: TError, filters: TRequestFilters) => void
  transformResponse?: (response: TResponse) => TResponse
  refreshChannel?: {
    channelName: string
    eventType: string
  }
  filterFields: TemplateListFilterField<TFilterValues>[]
  buildColumns: (helpers: {
    openFormPage: (mode: FormMode, resourceKey?: string) => void
    reload: () => Promise<void>
    resolveActionColumnWidth: (baseWidth: number, maxWidth?: number) => number
    resolveActionColumnLayout: (
      reachableContentWidthCombinations: ReadonlyArray<ReadonlyArray<number>>
    ) => ActionColumnLayout
  }) => ColumnsType<TItem>
  createAction?: {
    label: string
    icon?: ReactNode
    permission?: PermissionKey
  }
  densityItems?: MenuProps['items']
  renderBeforeFilter?: ReactNode
  renderBetweenFilterAndContent?: ReactNode
  renderAfterContent?: ReactNode
  stateCopy?: ListStateCopyContract
  pagination?: StandardPaginationConfig
  buildTableNode: (context: {
    columns: ColumnsType<TItem>
    dataSource: TItem[]
    loading: boolean
    reload: () => Promise<void>
    appliedFilters: TRequestFilters
    tableSize: 'large' | 'middle' | 'small'
    selectedColumnKeys: string[]
    setTableSize: (size: 'large' | 'middle' | 'small') => void
    setSelectedColumnKeys: (keys: string[]) => void
    onColumnSettingOrderChange?: (keys: string[]) => void
    current: number
    pageSize: number
    total: number
    tableClassName: string
    pagination: TablePaginationConfig
    onPageChange: (nextCurrent: number, nextPageSize: number) => void
    virtualScroll: {
      enabled: boolean
      scroll: {
        x: number
        y: number
      }
    }
  }) => ReactNode
} & StandardListToolbarExtra<TRequestFilters>
