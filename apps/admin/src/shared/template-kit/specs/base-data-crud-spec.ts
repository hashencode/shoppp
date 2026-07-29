export type CrudAction = 'add' | 'edit' | 'view'

export type CrudActionSpec = {
  enabled: boolean
  name: string
  logic: string
  desc?: string
}

export type CrudFieldSpec = {
  name: string
  component?: string
  required?: boolean
  hidden?: boolean
  align?: 'left' | 'center' | 'right'
  fixed?: 'none' | 'left' | 'right'
  linkage?: string
  desc?: string
}

export type BaseDataCrudSpec = {
  bizName: string
  apiDoc: string
  goal: string
  formRoute: string
  actions: CrudAction[]
  listItemButtons: CrudActionSpec[]
  mainButtons: CrudActionSpec[]
  searchFields: CrudFieldSpec[]
  displayFields: CrudFieldSpec[]
  formFields: CrudFieldSpec[]
  apis: {
    list: string
    create: string
    update: string
    status: string
  }
  rules: {
    deleteRule: string
    paginationRule: string
  }
  constraints: {
    listIsoRoute: '/template/list/table'
    formIsoRoutes: ['/template/list/table/form', '/template/form/advanced-form']
    noDrawerEdit: true
    readonlyFormReuse: true
    listViewPreferences: {
      enabled: true
      defaultColumnKeysSource: 'columns-derived'
      tableIdRequired: true
    }
  }
  uiInteractionConstraints: {
    forbidUndeclaredUi: true
    templateConflictPolicy: 'template-first'
    readonlyRules: string[]
    listRules: string[]
    feedbackRules: string[]
  }
  acceptance: ['bun run lint', 'bun run typecheck', '相关测试通过']
}

const methodChecks = [
  { field: 'list', method: 'GET' },
  { field: 'create', method: 'POST' },
  { field: 'update', method: 'PUT' },
  { field: 'status', method: 'PATCH' },
] as const

export const validateBaseDataCrudSpec = (spec: BaseDataCrudSpec): string[] => {
  const errors: string[] = []

  if (!spec.bizName.trim()) errors.push('业务名称不能为空')
  if (!spec.apiDoc.trim()) errors.push('API 文档路径不能为空')
  if (!spec.formRoute.trim()) errors.push('表单路由不能为空')
  if (spec.listItemButtons.length === 0) errors.push('列表项按钮至少保留一个')
  if (spec.mainButtons.length === 0) errors.push('主按钮至少保留一个')
  if (spec.searchFields.length === 0) errors.push('搜索字段至少保留一个')
  if (spec.formFields.length === 0) errors.push('表单字段至少保留一个')

  for (const check of methodChecks) {
    const raw = spec.apis[check.field]
    if (!raw.trim()) {
      errors.push(`接口配置缺失：${check.method}`)
      continue
    }
    if (!raw.toUpperCase().includes(check.method)) {
      errors.push(`接口方法不匹配：${check.field} 需要 ${check.method}`)
    }
  }

  if (!spec.rules.deleteRule.trim()) errors.push('删除规则不能为空')
  if (!spec.rules.paginationRule.trim()) errors.push('分页规则不能为空')
  if (!spec.uiInteractionConstraints.readonlyRules.length) errors.push('只读交互约束不能为空')
  if (!spec.uiInteractionConstraints.listRules.length) errors.push('列表交互约束不能为空')
  if (!spec.uiInteractionConstraints.feedbackRules.length) errors.push('反馈态约束不能为空')
  if (!spec.uiInteractionConstraints.forbidUndeclaredUi) errors.push('必须开启禁止新增未声明 UI 结构')
  if (spec.uiInteractionConstraints.templateConflictPolicy !== 'template-first') {
    errors.push('模板冲突策略必须为 template-first')
  }
  if (!spec.constraints.listViewPreferences.enabled) {
    errors.push('列表必须启用 useListViewPreferences 持久化配置')
  }
  if (spec.constraints.listViewPreferences.defaultColumnKeysSource !== 'columns-derived') {
    errors.push('defaultColumnKeys 必须由 columns 动态推导')
  }
  if (!spec.constraints.listViewPreferences.tableIdRequired) {
    errors.push('列表必须配置稳定唯一的 tableId')
  }

  return errors
}
