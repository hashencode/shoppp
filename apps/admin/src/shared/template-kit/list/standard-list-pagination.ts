import type { TablePaginationConfig } from 'antd'

export const STANDARD_LIST_TABLE_CLASS_NAME = 'rule-list-table'

export const buildStandardListPagination = (
  pagination: TablePaginationConfig
): TablePaginationConfig => ({
  ...pagination,
  size: 'middle',
  showQuickJumper: pagination.showQuickJumper ?? true,
  showSizeChanger: pagination.showSizeChanger ?? true,
  showTotal: (nextTotal) => `共 ${nextTotal} 条数据`,
  placement: ['bottomEnd'],
})
