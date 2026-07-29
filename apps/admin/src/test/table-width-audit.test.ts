import { describe, expect, it } from '@rstest/core'
import { auditSourceText, suggestColumnWidth } from './table-width-audit'

describe('table width audit', () => {
  it('should pass when table columns and scroll width are complete', () => {
    const result = auditSourceText(
      'src/pages/example.tsx',
      `
        import { Table } from 'antd'
        const TABLE_SCROLL_X = 420
        const columns = [
          { key: 'name', title: '姓名', dataIndex: 'name', width: 100 },
          { key: 'createdAt', title: '创建时间', dataIndex: 'createdAt', width: 180 },
          { key: 'action', title: '操作', width: 126, render: () => null },
        ]
        export const Page = () => <Table columns={columns} scroll={{ x: TABLE_SCROLL_X }} />
      `
    )

    expect(result.issues).toEqual([])
  })

  it('should report a missing column width', () => {
    const result = auditSourceText(
      'src/pages/example.tsx',
      `
        import { Table } from 'antd'
        const TABLE_SCROLL_X = 300
        const columns = [
          { key: 'name', title: '姓名', dataIndex: 'name' },
        ]
        export const Page = () => <Table columns={columns} scroll={{ x: TABLE_SCROLL_X }} />
      `
    )

    expect(result.issues).toMatchObject([
      {
        type: 'missing-width',
        severity: 'error',
      },
    ])
  })

  it('should report scroll width smaller than known column total', () => {
    const result = auditSourceText(
      'src/pages/example.tsx',
      `
        import { Table } from 'antd'
        const TABLE_SCROLL_X = 200
        const columns = [
          { key: 'institutionName', title: '基地名称', dataIndex: 'institutionName', width: 220 },
          { key: 'createdAt', title: '创建时间', dataIndex: 'createdAt', width: 180 },
        ]
        export const Page = () => <Table columns={columns} scroll={{ x: TABLE_SCROLL_X }} />
      `
    )

    expect(result.issues.some((issue) => issue.type === 'scroll-too-small')).toBe(true)
  })

  it('should warn when a width identifier cannot be resolved locally', () => {
    const result = auditSourceText(
      'src/pages/example.tsx',
      `
        import { Table } from 'antd'
        const TABLE_SCROLL_X = 400
        const columns = [
          { key: 'name', title: '姓名', dataIndex: 'name', width: EXTERNAL_WIDTH },
        ]
        export const Page = () => <Table columns={columns} scroll={{ x: TABLE_SCROLL_X }} />
      `
    )

    expect(result.issues).toMatchObject([
      {
        type: 'unknown-width',
        severity: 'warn',
      },
    ])
  })

  it('should resolve width values from local object constants', () => {
    const result = auditSourceText(
      'src/pages/example.tsx',
      `
        import { Table } from 'antd'
        const TABLE_SCROLL_X = 300
        const TABLE_COLUMN_WIDTHS = { name: 100, createdAt: 180 } as const
        const columns = [
          { key: 'name', title: '姓名', dataIndex: 'name', width: TABLE_COLUMN_WIDTHS.name },
          { key: 'createdAt', title: '创建时间', dataIndex: 'createdAt', width: TABLE_COLUMN_WIDTHS['createdAt'] },
        ]
        export const Page = () => <Table columns={columns} scroll={{ x: TABLE_SCROLL_X }} />
      `
    )

    expect(result.issues).toEqual([])
  })

  it('should ignore non-column tree data arrays with title fields', () => {
    const result = auditSourceText(
      'src/pages/example.tsx',
      `
        import { Table } from 'antd'
        const TABLE_SCROLL_X = 300
        const ROOT_DIRECTORY_TITLE = '根分类目录'
        const normalizeTree = () => [
          {
            label: ROOT_DIRECTORY_TITLE,
            title: ROOT_DIRECTORY_TITLE,
            value: 0,
            key: 0,
          },
        ]
        const columns = [
          { key: 'name', title: '分类名称', dataIndex: 'name', width: 220 },
        ]
        export const Page = () => <Table columns={columns} scroll={{ x: TABLE_SCROLL_X }} />
      `
    )

    expect(result.issues).toEqual([])
  })

  it('should treat resolveActionColumnWidth with local constants as known width', () => {
    const result = auditSourceText(
      'src/pages/example.tsx',
      `
        import { Table } from 'antd'
        const TABLE_SCROLL_X = 260
        const ACTION_COLUMN_WIDTH = 126
        const columns = [
          { key: 'name', title: '姓名', dataIndex: 'name', width: 100 },
          { key: 'action', title: '操作', width: resolveActionColumnWidth(ACTION_COLUMN_WIDTH), render: () => null },
        ]
        export const Page = () => <Table columns={columns} scroll={{ x: TABLE_SCROLL_X }} />
      `
    )

    expect(result.issues).toEqual([])
    expect(result.columnGroups[0]?.columns[1]?.width).toBe(158)
  })

  it('should resolve table-size deltas and explicit max widths', () => {
    const result = auditSourceText(
      'src/pages/example.tsx',
      `
        import { Table } from 'antd'
        const TABLE_SCROLL_X = 390
        const ACTION_COLUMN_WIDTH = 126
        const columns = [
          { key: 'name', title: '姓名', dataIndex: 'name', width: 100 },
          { key: 'middleAction', title: '操作', width: resolveActionColumnWidth(ACTION_COLUMN_WIDTH, 'middle'), render: () => null },
          { key: 'cappedAction', title: '操作', width: resolveActionColumnWidth(ACTION_COLUMN_WIDTH, 'large', 140), render: () => null },
        ]
        export const Page = () => <Table columns={columns} scroll={{ x: TABLE_SCROLL_X }} />
      `
    )

    expect(result.issues).toEqual([])
    expect(result.columnGroups[0]?.columns.map((column) => column.width)).toEqual([100, 142, 140])
  })

  it('should suggest widths from column semantics', () => {
    expect(suggestColumnWidth('身份证号')).toBe(190)
    expect(suggestColumnWidth('创建时间')).toBe(180)
    expect(suggestColumnWidth('基地名称')).toBe(220)
    expect(suggestColumnWidth('详细地址')).toBe(220)
  })
})
