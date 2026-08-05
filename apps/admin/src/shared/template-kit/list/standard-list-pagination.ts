import type { TablePaginationConfig } from 'antd'
import { translateMessage, type AppLocale } from '../../contexts/i18n-context'

export const STANDARD_LIST_TABLE_CLASS_NAME = 'rule-list-table'

export const buildStandardListPagination = (
  pagination: TablePaginationConfig,
  locale: AppLocale = 'zh-CN'
): TablePaginationConfig => ({
  ...pagination,
  size: 'middle',
  showQuickJumper: pagination.showQuickJumper ?? true,
  showSizeChanger: pagination.showSizeChanger ?? true,
  showTotal: (nextTotal) => translateMessage(locale, '{count} items', { count: nextTotal }),
  placement: ['bottomEnd'],
})
