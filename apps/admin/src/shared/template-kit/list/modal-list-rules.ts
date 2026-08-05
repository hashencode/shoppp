import type { TablePaginationConfig } from 'antd'
import type { AppLocale } from '../../contexts/i18n-context'
import {
  buildStandardListPagination,
  STANDARD_LIST_TABLE_CLASS_NAME,
} from './standard-list-pagination'

export const MODAL_LIST_TABLE_SIZE = 'middle' as const

export const buildModalListTableProps = (
  pagination: TablePaginationConfig,
  locale: AppLocale = 'zh-CN'
) => ({
  className: STANDARD_LIST_TABLE_CLASS_NAME,
  size: MODAL_LIST_TABLE_SIZE,
  pagination: buildStandardListPagination(pagination, locale),
})
