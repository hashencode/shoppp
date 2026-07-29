import { PlusOutlined } from '@ant-design/icons'
import {
  Button,
  Card,
  Checkbox,
  Col,
  Input,
  message,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Typography,
  theme,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import React, { useCallback, useMemo, useState } from 'react'
import {
  type BaseDataCrudSpec,
  type CrudFieldSpec,
  validateBaseDataCrudSpec,
} from '../../../shared/template-kit/specs/base-data-crud-spec'
import { GRADE_CRUD_SPEC } from '../../../shared/template-kit/specs/base-data-crud-fixtures'
import { CustomPageRecipe } from '../../../shared/template-kit/recipes/custom-page-recipe'

void React

const { TextArea } = Input

type RowItem = {
  id: string
  enabled: boolean
  name: string
  component: string
  required: boolean
  hidden: boolean
  align: 'left' | 'center' | 'right'
  fixed: 'none' | 'left' | 'right'
  linkage: string
  desc: string
}

type ActionRow = {
  id: string
  enabled: boolean
  name: string
  logic: string
  desc: string
}

type FieldBuildOptions = {
  withComponent: boolean
  withRequired: boolean
  withHidden: boolean
  withAlign: boolean
  withFixed: boolean
  withLinkage: boolean
}

const toFieldSpecs = (rows: RowItem[], options: FieldBuildOptions): CrudFieldSpec[] =>
  rows
    .filter((item) => item.enabled && item.name.trim())
    .map((item) => {
      const spec: CrudFieldSpec = {
        name: item.name.trim(),
      }

      if (options.withComponent) {
        spec.component = item.component.trim() || 'Input'
      }

      if (options.withRequired) {
        spec.required = item.required
      }

      if (options.withHidden) {
        spec.hidden = item.hidden
      }

      if (options.withAlign) {
        spec.align = item.align
      }

      if (options.withFixed) {
        spec.fixed = item.fixed
      }

      if (options.withLinkage && item.linkage.trim()) {
        spec.linkage = item.linkage.trim()
      }

      if (item.desc.trim()) {
        spec.desc = item.desc.trim()
      }

      return spec
    })

const toRowItems = (fields: CrudFieldSpec[], options: FieldBuildOptions): RowItem[] =>
  fields.map((field) => ({
    id: nextId(),
    enabled: true,
    name: field.name,
    component: options.withComponent ? (field.component ?? 'Input') : '',
    required: options.withRequired ? Boolean(field.required) : false,
    hidden: options.withHidden ? Boolean(field.hidden) : false,
    align: options.withAlign ? (field.align ?? 'left') : 'left',
    fixed: options.withFixed ? (field.fixed ?? 'none') : 'none',
    linkage: options.withLinkage ? (field.linkage ?? '') : '',
    desc: field.desc ?? '',
  }))

const componentOptions = [
  {
    label: '输入类',
    options: [
      { label: 'Input', value: 'Input' },
      { label: 'Input.Password', value: 'Input.Password' },
      { label: 'Input.Search', value: 'Input.Search' },
      { label: 'Input.TextArea', value: 'Input.TextArea' },
      { label: 'InputNumber', value: 'InputNumber' },
      { label: 'AutoComplete', value: 'AutoComplete' },
    ],
  },
  {
    label: '选择类',
    options: [
      { label: 'Select', value: 'Select' },
      { label: 'Select（多选）', value: 'Select（多选）' },
      { label: 'TreeSelect', value: 'TreeSelect' },
      { label: 'Cascader', value: 'Cascader' },
      { label: 'Radio', value: 'Radio' },
      { label: 'Checkbox', value: 'Checkbox' },
      { label: 'Switch', value: 'Switch' },
    ],
  },
  {
    label: '时间类',
    options: [
      { label: 'DatePicker', value: 'DatePicker' },
      { label: 'DatePicker（年份选择）', value: 'DatePicker（年份选择）' },
      { label: 'DatePicker（月份选择）', value: 'DatePicker（月份选择）' },
      { label: 'DateRangePicker', value: 'DateRangePicker' },
      { label: 'TimePicker', value: 'TimePicker' },
      { label: 'TimeRangePicker', value: 'TimeRangePicker' },
    ],
  },
  {
    label: '上传类',
    options: [{ label: 'Upload', value: 'Upload' }],
  },
]

let seed = 0
const nextId = () => `row-${Date.now()}-${seed++}`

const searchFieldOptions: FieldBuildOptions = {
  withComponent: true,
  withRequired: false,
  withHidden: false,
  withAlign: false,
  withFixed: false,
  withLinkage: true,
}

const displayFieldOptions: FieldBuildOptions = {
  withComponent: false,
  withRequired: false,
  withHidden: false,
  withAlign: true,
  withFixed: true,
  withLinkage: false,
}

const formFieldOptions: FieldBuildOptions = {
  withComponent: true,
  withRequired: true,
  withHidden: true,
  withAlign: false,
  withFixed: false,
  withLinkage: true,
}

const defaultSearchRows: RowItem[] = toRowItems(GRADE_CRUD_SPEC.searchFields, searchFieldOptions)
const defaultDisplayRows: RowItem[] = toRowItems(GRADE_CRUD_SPEC.displayFields, displayFieldOptions)
const defaultFormRows: RowItem[] = toRowItems(GRADE_CRUD_SPEC.formFields, formFieldOptions)

const formatRows = (rows: RowItem[], options: FieldBuildOptions) => {
  const enabledRows = rows.filter((item) => item.enabled && item.name.trim())
  if (enabledRows.length === 0) return '- （未配置）'

  return enabledRows
    .map((item) => {
      const segments: string[] = [item.name.trim()]

      if (options.withComponent) {
        segments.push(item.component.trim() || 'Input')
      }

      if (options.withRequired) {
        segments.push(item.required ? '必填' : '选填')
      }

      if (options.withHidden && item.hidden) {
        segments.push('隐藏')
      }

      if (options.withAlign) {
        const alignLabel =
          item.align === 'center' ? '居中对齐' : item.align === 'right' ? '右对齐' : '左对齐'
        segments.push(`对齐：${alignLabel}`)
      }

      if (options.withFixed) {
        const fixedLabel =
          item.fixed === 'left' ? '左侧固定' : item.fixed === 'right' ? '右侧固定' : '不固定'
        segments.push(`固定：${fixedLabel}`)
      }

      if (options.withLinkage && item.linkage.trim()) {
        segments.push(`联动：${item.linkage.trim()}`)
      }

      if (item.desc.trim()) {
        segments.push(item.desc.trim())
      }

      return `- ${segments.join(' ｜ ')}`
    })
    .join('\n')
}

const defaultListItemButtonRows = (formRoute: string): ActionRow[] => [
  { id: nextId(), enabled: true, name: '查看', logic: `跳转 ${formRoute}?mode=readonly&id=<id>`, desc: '' },
  { id: nextId(), enabled: true, name: '编辑', logic: `跳转 ${formRoute}?mode=modify&id=<id>`, desc: '' },
  { id: nextId(), enabled: true, name: '删除', logic: '对当前行执行删除动作', desc: '' },
]

const defaultMainButtonRows = (formRoute: string): ActionRow[] => [
  { id: nextId(), enabled: true, name: '新增', logic: `跳转 ${formRoute}?mode=add`, desc: '' },
]

const formatActionLines = (rows: ActionRow[]) => {
  const enabledRows = rows.filter((row) => row.enabled && row.name.trim())
  if (!enabledRows.length) {
    return '- （未配置）'
  }

  return enabledRows
    .map((row) => {
      const logic = row.logic.trim()
      const desc = row.desc.trim()
      const base = logic ? `- ${row.name.trim()}：${logic}` : `- ${row.name.trim()}`
      return desc ? `${base}（${desc}）` : base
    })
    .join('\n')
}

const toCrudActions = (
  mainButtons: ActionRow[],
  listItemButtons: ActionRow[]
): BaseDataCrudSpec['actions'] => {
  const enabledNames = [...mainButtons, ...listItemButtons]
    .filter((row) => row.enabled)
    .map((row) => row.name.trim())
  const actions: BaseDataCrudSpec['actions'] = []

  if (enabledNames.some((name) => name === '新增' || name.toLowerCase() === 'add')) actions.push('add')
  if (enabledNames.some((name) => name === '编辑' || name.toLowerCase() === 'edit')) actions.push('edit')
  if (enabledNames.some((name) => name === '查看' || name.toLowerCase() === 'view')) actions.push('view')

  return actions
}

const listToTextarea = (items: string[]) => items.map((item) => `- ${item}`).join('\n')

const textareaToList = (raw: string) =>
  raw
    .split('\n')
    .map((line) => line.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean)

const formatRuleLines = (raw: string) => {
  const rules = textareaToList(raw)
  if (!rules.length) {
    return '- （未配置）'
  }
  return rules.map((item) => `- ${item}`).join('\n')
}

type EditableFieldTableProps = {
  title: string
  rows: RowItem[]
  onChange: (next: RowItem[]) => void
  options: FieldBuildOptions
  descriptionLabel: string
}

type EditableActionTableProps = {
  title: string
  moduleName: string
  rows: ActionRow[]
  onChange: (next: ActionRow[]) => void
}

const EditableActionTable = ({ title, moduleName, rows, onChange }: EditableActionTableProps) => {
  const updateRow = (id: string, patch: Partial<ActionRow>) => {
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const addRow = () => {
    onChange([...rows, { id: nextId(), enabled: true, name: '', logic: '', desc: '' }])
  }

  const columns: ColumnsType<ActionRow> = [
    {
      key: 'enabled',
      title: '启用',
      width: 60,
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center">
          <Checkbox
            aria-label={`${moduleName}-启用-${record.name || '未命名按钮'}`}
            checked={record.enabled}
            onChange={(event) => updateRow(record.id, { enabled: event.target.checked })}
          />
        </div>
      ),
    },
    {
      key: 'name',
      title: '按钮名称',
      width: 180,
      render: (_, record) => (
        <Input
          placeholder="例如：新增"
          value={record.name}
          onChange={(event) => updateRow(record.id, { name: event.target.value })}
        />
      ),
    },
    {
      key: 'logic',
      title: '交互逻辑描述',
      width: 120,
      render: (_, record) => (
        <Input
          placeholder="例如：跳转 /dev/base-data/grade/form?mode=add"
          value={record.logic}
          onChange={(event) => updateRow(record.id, { logic: event.target.value })}
        />
      ),
    },
    {
      key: 'desc',
      title: '附加描述',
      width: 220,
      render: (_, record) => (
        <Input
          placeholder="例如：仅管理员可见"
          value={record.desc}
          onChange={(event) => updateRow(record.id, { desc: event.target.value })}
        />
      ),
    },
  ]

  return (
    <Card size="small" title={title}>
      <Table<ActionRow> size="small" rowKey="id" pagination={false} dataSource={rows} columns={columns} scroll={{ x: 580 }} />
      <div className="mt-3">
        <Button type="primary" icon={<PlusOutlined />} onClick={addRow}>
          新增
        </Button>
      </div>
    </Card>
  )
}

const EditableFieldTable = ({
  title,
  rows,
  onChange,
  options,
  descriptionLabel,
}: EditableFieldTableProps) => {
  const updateRow = (id: string, patch: Partial<RowItem>) => {
    onChange(rows.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const addRow = () => {
    onChange([
      ...rows,
      {
        id: nextId(),
        enabled: true,
        name: '',
        component: options.withComponent ? 'Input' : '',
        required: options.withRequired,
        hidden: false,
        align: 'left',
        fixed: 'none',
        linkage: '',
        desc: '',
      },
    ])
  }

  const columns: ColumnsType<RowItem> = [
    {
      key: 'enabled',
      title: '启用',
      width: 60,
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center">
          <Checkbox
            checked={record.enabled}
            onChange={(event) => updateRow(record.id, { enabled: event.target.checked })}
          />
        </div>
      ),
    },
    {
      key: 'name',
      title: '字段名称',
      width: 220,
      render: (_, record) => (
        <Input
          placeholder="字段名称"
          value={record.name}
          onChange={(event) => updateRow(record.id, { name: event.target.value })}
        />
      ),
    },
  ]

  if (options.withComponent) {
    columns.push({
      key: 'component',
      title: '组件类型',
      width: 220,
      render: (_, record) => (
        <Select
          style={{ width: 200 }}
          value={record.component || 'Input'}
          options={componentOptions}
          showSearch={{
            optionFilterProp: 'label',
            filterOption: (input, option) =>
              String(option?.label ?? '')
                .toLowerCase()
                .includes(input.toLowerCase()),
          }}
          onChange={(value) => updateRow(record.id, { component: value })}
        />
      ),
    })
  }

  if (options.withRequired) {
    columns.push({
      key: 'required',
      title: '是否必填',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center">
          <Switch
            checked={record.required}
            checkedChildren="必填"
            unCheckedChildren="选填"
            onChange={(checked) => updateRow(record.id, { required: checked })}
          />
        </div>
      ),
    })
  }

  if (options.withHidden) {
    columns.push({
      key: 'hidden',
      title: '隐藏',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <div className="flex justify-center">
          <Switch
            checked={record.hidden}
            checkedChildren="是"
            unCheckedChildren="否"
            onChange={(checked) => updateRow(record.id, { hidden: checked })}
          />
        </div>
      ),
    })
  }

  if (options.withAlign) {
    columns.push({
      key: 'align',
      title: '对齐方式',
      width: 120,
      render: (_, record) => (
        <Select
          className='w-full'
          value={record.align}
          options={[
            { label: '左对齐', value: 'left' },
            { label: '居中对齐', value: 'center' },
            { label: '右对齐', value: 'right' },
          ]}
          onChange={(value) => updateRow(record.id, { align: value })}
        />
      ),
    })
  }

  if (options.withFixed) {
    columns.push({
      key: 'fixed',
      title: '固定方式',
      width: 120,
      render: (_, record) => (
        <Select
          className='w-full'
          value={record.fixed}
          options={[
            { label: '不固定', value: 'none' },
            { label: '左侧固定', value: 'left' },
            { label: '右侧固定', value: 'right' },
          ]}
          onChange={(value) => updateRow(record.id, { fixed: value })}
        />
      ),
    })
  }

  if (options.withLinkage) {
    columns.push({
      key: 'linkage',
      title: '联动关系',
      width: 260,
      render: (_, record) => (
        <Input
          placeholder="例如：选择校区后刷新年级选项"
          value={record.linkage}
          onChange={(event) => updateRow(record.id, { linkage: event.target.value })}
        />
      ),
    })
  }

  columns.push({
    key: 'desc',
    title: descriptionLabel,
    width: 120,
    render: (_, record) => (
      <Input
        placeholder={descriptionLabel}
        value={record.desc}
        onChange={(event) => updateRow(record.id, { desc: event.target.value })}
      />
    ),
  })

  return (
    <Card size="small" title={title}>
      <Table<RowItem>
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={rows}
        columns={columns}
        scroll={{ x: 'max-content' }}
      />
      <div className="mt-3">
        <Button type="primary" icon={<PlusOutlined />} onClick={addRow}>
          新增
        </Button>
      </div>
    </Card>
  )
}

export const ListPromptGeneratorPage = () => {
  const { token } = theme.useToken()
  const [bizName, setBizName] = useState(GRADE_CRUD_SPEC.bizName)
  const [apiDoc, setApiDoc] = useState(GRADE_CRUD_SPEC.apiDoc)
  const [goal, setGoal] = useState(GRADE_CRUD_SPEC.goal)
  const [formRoute, setFormRoute] = useState(GRADE_CRUD_SPEC.formRoute)

  const [listItemButtonRows, setListItemButtonRows] = useState<ActionRow[]>(
    GRADE_CRUD_SPEC.listItemButtons?.length
      ? GRADE_CRUD_SPEC.listItemButtons.map((item) => ({
          id: nextId(),
          enabled: item.enabled,
          name: item.name,
          logic: item.logic,
          desc: item.desc ?? '',
        }))
      : defaultListItemButtonRows(GRADE_CRUD_SPEC.formRoute)
  )

  const [mainButtonRows, setMainButtonRows] = useState<ActionRow[]>(
    GRADE_CRUD_SPEC.mainButtons?.length
      ? GRADE_CRUD_SPEC.mainButtons.map((item) => ({
          id: nextId(),
          enabled: item.enabled,
          name: item.name,
          logic: item.logic,
          desc: item.desc ?? '',
        }))
      : defaultMainButtonRows(GRADE_CRUD_SPEC.formRoute)
  )

  const [searchRows, setSearchRows] = useState<RowItem[]>(defaultSearchRows)
  const [displayRows, setDisplayRows] = useState<RowItem[]>(defaultDisplayRows)
  const [formRows, setFormRows] = useState<RowItem[]>(defaultFormRows)

  const [apiGet, setApiGet] = useState(GRADE_CRUD_SPEC.apis.list)
  const [apiPost, setApiPost] = useState(GRADE_CRUD_SPEC.apis.create)
  const [apiPut, setApiPut] = useState(GRADE_CRUD_SPEC.apis.update)
  const [apiPatch, setApiPatch] = useState(GRADE_CRUD_SPEC.apis.status)

  const [deleteRule, setDeleteRule] = useState(GRADE_CRUD_SPEC.rules.deleteRule)
  const [paginationRule, setPaginationRule] = useState(GRADE_CRUD_SPEC.rules.paginationRule)
  const [readonlyRulesText, setReadonlyRulesText] = useState(
    listToTextarea(GRADE_CRUD_SPEC.uiInteractionConstraints.readonlyRules)
  )
  const [listRulesText, setListRulesText] = useState(
    listToTextarea(GRADE_CRUD_SPEC.uiInteractionConstraints.listRules)
  )
  const [feedbackRulesText, setFeedbackRulesText] = useState(
    listToTextarea(GRADE_CRUD_SPEC.uiInteractionConstraints.feedbackRules)
  )

  const generatedPrompt = useMemo(() => {
    const normalizedBizName = bizName.trim() || '业务'
    const normalizedApiDoc = apiDoc.trim() || 'docs/api/api.md'
    const normalizedGoal =
      goal.trim() || `完成${normalizedBizName}列表页与${normalizedBizName}表单页`

    return `在当前项目实现【${normalizedBizName}】相关页面，请严格遵守 AGENTS.md（含 BaseData Defaults）与 ${normalizedApiDoc}

目标：
- ${normalizedGoal}
- 列表页 UI/交互同构 /template/list/table
- 表单页根据字段数量选择 UI/交互同构 /template/list/table/form 或 /template/form/advanced-form
- 表单字段按我指定组件实现

交互要求：
- 列表项按钮：
${formatActionLines(listItemButtonRows)}
- 主按钮：
${formatActionLines(mainButtonRows)}
- 列表内不使用 Drawer 做编辑

搜索表单字段组件（固定）：
${formatRows(searchRows, searchFieldOptions)}

表单显示项：
${formatRows(displayRows, displayFieldOptions)}

表单字段组件（固定）：
${formatRows(formRows, formFieldOptions)}

接口要求（严格按文档）：
- ${apiGet.trim()}
- ${apiPost.trim()}
- ${apiPut.trim()}
- ${apiPatch.trim()}

文案要求：
- 仅用户语义
- 禁止暴露后端实现细节

删除规则：
- ${deleteRule.trim()}

分页要求：
- ${paginationRule.trim()}

UI 交互约束（必须遵守）：
- 禁止新增未在 spec 声明的 UI 结构
- 与模板冲突时，以模板行为为准
- 只读模式约束：
${formatRuleLines(readonlyRulesText)}
- 列表交互约束：
${formatRuleLines(listRulesText)}
- 状态反馈约束：
${formatRuleLines(feedbackRulesText)}

改动边界：
- 只改与本功能直接相关文件
- 不改原有 Dev 菜单组和其他无关页面行为

验收：
- bun run lint 通过
- bun run typecheck 通过
- 相关测试通过`
  }, [
    listItemButtonRows,
    mainButtonRows,
    apiDoc,
    apiGet,
    apiPatch,
    apiPost,
    apiPut,
    bizName,
    deleteRule,
    displayRows,
    formRows,
    goal,
    feedbackRulesText,
    listRulesText,
    paginationRule,
    readonlyRulesText,
    searchRows,
  ])

  const generatedSpec = useMemo<BaseDataCrudSpec>(() => {
    const normalizedBizName = bizName.trim() || '业务'
    const normalizedApiDoc = apiDoc.trim()
    const normalizedGoal = goal.trim()
    const normalizedFormRoute = formRoute.trim()

    return {
      bizName: normalizedBizName,
      apiDoc: normalizedApiDoc,
      goal: normalizedGoal,
      formRoute: normalizedFormRoute,
      actions: toCrudActions(mainButtonRows, listItemButtonRows),
      listItemButtons: listItemButtonRows
        .filter((row) => row.name.trim())
        .map((row) => ({
          enabled: row.enabled,
          name: row.name.trim(),
          logic: row.logic.trim(),
          desc: row.desc.trim(),
        })),
      mainButtons: mainButtonRows
        .filter((row) => row.name.trim())
        .map((row) => ({
          enabled: row.enabled,
          name: row.name.trim(),
          logic: row.logic.trim(),
          desc: row.desc.trim(),
        })),
      searchFields: toFieldSpecs(searchRows, searchFieldOptions),
      displayFields: toFieldSpecs(displayRows, displayFieldOptions),
      formFields: toFieldSpecs(formRows, formFieldOptions),
      apis: {
        list: apiGet.trim(),
        create: apiPost.trim(),
        update: apiPut.trim(),
        status: apiPatch.trim(),
      },
      rules: {
        deleteRule: deleteRule.trim(),
        paginationRule: paginationRule.trim(),
      },
      constraints: {
        listIsoRoute: '/template/list/table',
        formIsoRoutes: ['/template/list/table/form', '/template/form/advanced-form'],
        noDrawerEdit: true,
        readonlyFormReuse: true,
        listViewPreferences: {
          enabled: true,
          defaultColumnKeysSource: 'columns-derived',
          tableIdRequired: true,
        },
      },
      uiInteractionConstraints: {
        forbidUndeclaredUi: true,
        templateConflictPolicy: 'template-first',
        readonlyRules: textareaToList(readonlyRulesText),
        listRules: textareaToList(listRulesText),
        feedbackRules: textareaToList(feedbackRulesText),
      },
      acceptance: ['bun run lint', 'bun run typecheck', '相关测试通过'],
    }
  }, [
    listItemButtonRows,
    mainButtonRows,
    apiDoc,
    apiGet,
    apiPatch,
    apiPost,
    apiPut,
    bizName,
    deleteRule,
    displayRows,
    formRoute,
    formRows,
    goal,
    paginationRule,
    readonlyRulesText,
    listRulesText,
    feedbackRulesText,
    searchRows,
  ])

  const generatedSpecText = useMemo(() => JSON.stringify(generatedSpec, null, 2), [generatedSpec])

  const specValidationErrors = useMemo(
    () => validateBaseDataCrudSpec(generatedSpec),
    [generatedSpec]
  )

  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt)
      void message.success('已复制提示词')
    } catch {
      void message.error('复制失败，请手动复制')
    }
  }, [generatedPrompt])

  const copySpec = useCallback(async () => {
    try {
      const normalizedBizName = bizName.trim() || '业务'
      const payload = `我现在需要生成${normalizedBizName}相关页面，spec内容如下：\n${generatedSpecText}`
      await navigator.clipboard.writeText(payload)
      void message.success('已复制 Spec JSON')
    } catch {
      void message.error('复制失败，请手动复制')
    }
  }, [bizName, generatedSpecText])

  return (
    <CustomPageRecipe>
      <Space orientation="vertical" size="middle" style={{ width: '100%', paddingBottom: 88 }}>
        <Card>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            配置列表页和表单页的交互、字段、组件与说明，自动拼装统一提示词。
          </Typography.Paragraph>
        </Card>

        <Card size="small" title="基础配置">
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Input
                prefix="业务名称："
                value={bizName}
                onChange={(event) => setBizName(event.target.value)}
              />
            </Col>
            <Col xs={24} md={12}>
              <Input
                prefix="API 文档路径："
                value={apiDoc}
                onChange={(event) => setApiDoc(event.target.value)}
              />
            </Col>
            <Col xs={24} md={12}>
              <Input
                prefix="目标描述："
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
              />
            </Col>
            <Col xs={24} md={12}>
              <Input
                prefix="表单路由前缀："
                value={formRoute}
                onChange={(event) => setFormRoute(event.target.value)}
              />
            </Col>
          </Row>
        </Card>

        <Card size="small" title="接口与规则">
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>
              <Input value={apiGet} onChange={(event) => setApiGet(event.target.value)} />
            </Col>
            <Col xs={24} md={12}>
              <Input value={apiPost} onChange={(event) => setApiPost(event.target.value)} />
            </Col>
            <Col xs={24} md={12}>
              <Input value={apiPut} onChange={(event) => setApiPut(event.target.value)} />
            </Col>
            <Col xs={24} md={12}>
              <Input value={apiPatch} onChange={(event) => setApiPatch(event.target.value)} />
            </Col>
            <Col xs={24} md={12}>
              <Typography.Text>删除规则</Typography.Text>
              <TextArea
                value={deleteRule}
                onChange={(event) => setDeleteRule(event.target.value)}
                style={{ marginTop: 8 }}
                autoSize={{ minRows: 3, maxRows: 8 }}
              />
            </Col>
            <Col xs={24} md={12}>
              <Typography.Text>分页要求</Typography.Text>
              <TextArea
                value={paginationRule}
                onChange={(event) => setPaginationRule(event.target.value)}
                style={{ marginTop: 8 }}
                autoSize={{ minRows: 3, maxRows: 8 }}
              />
            </Col>
          </Row>
        </Card>

        <EditableActionTable
          title="主按钮"
          moduleName="主按钮"
          rows={mainButtonRows}
          onChange={setMainButtonRows}
        />

        <EditableFieldTable
          title="搜索表单字段"
          rows={searchRows}
          onChange={setSearchRows}
          options={searchFieldOptions}
          descriptionLabel="字段附加描述"
        />

        <EditableActionTable
          title="列表项按钮"
          moduleName="列表项按钮"
          rows={listItemButtonRows}
          onChange={setListItemButtonRows}
        />

        <EditableFieldTable
          title="表单显示项"
          rows={displayRows}
          onChange={setDisplayRows}
          options={displayFieldOptions}
          descriptionLabel="显示项描述"
        />

        <EditableFieldTable
          title="表单字段"
          rows={formRows}
          onChange={setFormRows}
          options={formFieldOptions}
          descriptionLabel="字段附加描述"
        />

        <Card size="small" title="UI 交互约束">
          <Row gutter={[12, 12]}>
            <Col xs={24}>
              <Typography.Text>固定约束</Typography.Text>
              <TextArea
                value={'- 禁止新增未在 spec 声明的 UI 结构\n- 与模板冲突时，以模板行为为准'}
                readOnly
                style={{ marginTop: 8 }}
                autoSize={{ minRows: 2, maxRows: 6 }}
              />
            </Col>
            <Col xs={24}>
              <Typography.Text>只读模式约束</Typography.Text>
              <TextArea
                value={readonlyRulesText}
                onChange={(event) => setReadonlyRulesText(event.target.value)}
                style={{ marginTop: 8 }}
                autoSize={{ minRows: 3, maxRows: 8 }}
              />
            </Col>
            <Col xs={24}>
              <Typography.Text>列表交互约束</Typography.Text>
              <TextArea
                value={listRulesText}
                onChange={(event) => setListRulesText(event.target.value)}
                style={{ marginTop: 8 }}
                autoSize={{ minRows: 3, maxRows: 8 }}
              />
            </Col>
            <Col xs={24}>
              <Typography.Text>反馈态约束</Typography.Text>
              <TextArea
                value={feedbackRulesText}
                onChange={(event) => setFeedbackRulesText(event.target.value)}
                style={{ marginTop: 8 }}
                autoSize={{ minRows: 3, maxRows: 8 }}
              />
            </Col>
          </Row>
        </Card>

        <Card size="small" title="生成结果">
          <Row gutter={[16, 16]}>
            <Col xs={24} xl={12}>
              <Typography.Title level={5} style={{ marginTop: 12, marginBottom: 0 }}>
                Prompt Output
              </Typography.Title>
              <TextArea
                aria-label="生成提示词结果"
                value={generatedPrompt}
                readOnly
                style={{ marginTop: 8 }}
                autoSize={{ minRows: 12, maxRows: 22 }}
              />
            </Col>

            <Col xs={24} xl={12}>
              <div>
                <Typography.Title level={5} style={{ marginTop: 12, marginBottom: 0 }}>
                  Spec Output (JSON)
                  {specValidationErrors.length === 0 ? (
                    <Typography.Text type="success" className='font-normal'>
                      （校验通过：结构完整，可用于代码生成）
                    </Typography.Text>
                  ) : null}
                </Typography.Title>
                {specValidationErrors.length > 0 ? (
                  <div className="my-2">
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {specValidationErrors.map((item) => (
                        <li key={item}>
                          <Typography.Text type="danger">{item}</Typography.Text>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <TextArea
                  aria-label="生成Spec结果"
                  value={generatedSpecText}
                  readOnly
                  style={{ marginTop: 8 }}
                  autoSize={{ minRows: 12, maxRows: 22 }}
                />
              </div>
            </Col>
          </Row>
        </Card>
      </Space>

      <div
        className="fixed right-0 bottom-0 left-0 z-[11] px-6 py-3 backdrop-blur-[6px] lg:left-56 flex justify-center"
        style={{
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorBgElevated,
        }}
      >
        <Space>
          <Button type="primary" onClick={() => void copyPrompt()}>
            复制提示词
          </Button>
          <Button onClick={() => void copySpec()}>复制 Spec JSON</Button>
        </Space>
      </div>
    </CustomPageRecipe>
  )
}
