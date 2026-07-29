import { describe, expect, it } from '@rstest/core'
import { MODAL_LIST_TABLE_SIZE, buildModalListTableProps } from './modal-list-rules'

describe('modal list rules', () => {
  it('uses standard tables and standard total pagination', () => {
    const tableProps = buildModalListTableProps({
      current: 1,
      pageSize: 10,
      total: 21,
    })

    expect(tableProps.size).toBe(MODAL_LIST_TABLE_SIZE)
    expect(tableProps.size).toBe('middle')
    expect(tableProps.className).toBe('rule-list-table')
    expect(tableProps.pagination.showTotal?.(21, [1, 10])).toBe('共 21 条数据')
  })
})
