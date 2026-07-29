import type { BaseDataCrudSpec } from './base-data-crud-spec'

export const GRADE_CRUD_SPEC: BaseDataCrudSpec = {
  bizName: '年级管理',
  apiDoc: 'docs/api/api.md',
  goal: '完成年级管理列表页与年级表单页',
  formRoute: '/dev/base-data/grade/form',
  actions: ['add', 'edit', 'view'],
  listItemButtons: [
    { enabled: true, name: '查看', logic: '跳转 /dev/base-data/grade/form?mode=readonly&id=<id>', desc: '' },
    { enabled: true, name: '编辑', logic: '跳转 /dev/base-data/grade/form?mode=modify&id=<id>', desc: '' },
    { enabled: true, name: '删除', logic: '对当前行执行删除动作', desc: '' },
  ],
  mainButtons: [
    { enabled: true, name: '新增', logic: '跳转 /dev/base-data/grade/form?mode=add', desc: '' },
  ],
  searchFields: [
    { name: '学年', component: 'DatePicker（年份选择）' },
    { name: '年级名称', component: 'Input' },
    { name: '年级状态', component: 'Select' },
  ],
  displayFields: [
    { name: '年级ID', align: 'left', fixed: 'none' },
    { name: '所属校区ID', align: 'left', fixed: 'none' },
    { name: '学年', align: 'left', fixed: 'none' },
    { name: '年级名称', align: 'left', fixed: 'none' },
    { name: '年级状态', align: 'left', fixed: 'none' },
  ],
  formFields: [
    { name: '年级ID', component: 'Input', required: false, hidden: true },
    { name: '所属校区ID', component: 'Input', required: false, hidden: true },
    { name: '学年', component: 'DatePicker（年份选择）', required: true },
    { name: '年级名称', component: 'Input', required: true },
    { name: '年级状态', component: 'Select', required: true },
  ],
  apis: {
    list: '列表查询接口：GET /api/v1/grades',
    create: '表单新增接口：POST /api/v1/grades',
    update: '表单更新接口：PUT /api/v1/grades/{id}',
    status: '更新状态接口：PATCH /api/v1/grades/{id}/status',
  },
  rules: {
    deleteRule: '列表中只要展示出来的记录都允许删除（停用状态也可删）',
    paginationRule: '与 /template/list/table 一致；必须有跳页和每页条数切换；样式保持一致',
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
    readonlyRules: ['只读模式不显示提交区（保存/重置按钮）', '只读模式禁止提交，保持字段只读'],
    listRules: [
      '筛选项变更不自动查询，仅点击“查询”触发',
      '分页必须支持跳页与每页条数切换，样式同构 /template/list/table',
      '列表必须使用 useListViewPreferences 持久化表格视图配置',
      'defaultColumnKeys 必须由 columns 动态推导，禁止手写固定字段数组',
      'tableId 必须稳定且全局唯一',
    ],
    feedbackRules: ['必须覆盖 loading / empty / error / partial 四态', 'error 与 partial 必须提供可执行恢复动作（重试/重载）'],
  },
  acceptance: ['bun run lint', 'bun run typecheck', '相关测试通过'],
}

export const CAMPUS_CRUD_SPEC: BaseDataCrudSpec = {
  bizName: '校区管理',
  apiDoc: 'docs/api/api.md',
  goal: '完成校区管理列表页与校区表单页',
  formRoute: '/base-data/campuses/form',
  actions: ['add', 'edit', 'view'],
  listItemButtons: [
    { enabled: true, name: '查看', logic: '跳转 /base-data/campuses/form?mode=readonly&id=<id>', desc: '' },
    { enabled: true, name: '编辑', logic: '跳转 /base-data/campuses/form?mode=modify&id=<id>', desc: '' },
    { enabled: true, name: '删除', logic: '对当前行执行删除动作', desc: '' },
  ],
  mainButtons: [
    { enabled: true, name: '新增', logic: '跳转 /base-data/campuses/form?mode=add', desc: '' },
  ],
  searchFields: [
    { name: '校区编码', component: 'Input' },
    { name: '校区名称', component: 'Input' },
    { name: '校区状态', component: 'Select' },
  ],
  displayFields: [
    { name: '校区编码', align: 'left', fixed: 'none' },
    { name: '校区名称', align: 'left', fixed: 'none' },
    { name: '校区状态', align: 'left', fixed: 'none' },
    { name: '负责人', align: 'left', fixed: 'none' },
    { name: '联系电话', align: 'left', fixed: 'none' },
  ],
  formFields: [
    { name: '校区编码', component: 'Input', required: true },
    { name: '校区名称', component: 'Input', required: true },
    { name: '校区状态', component: 'Select', required: true },
    { name: '负责人', component: 'Input', required: false },
    { name: '联系电话', component: 'Input', required: false },
  ],
  apis: {
    list: '列表查询接口：GET /api/v1/campuses',
    create: '表单新增接口：POST /api/v1/campuses',
    update: '表单更新接口：PUT /api/v1/campuses/{id}',
    status: '更新状态接口：PATCH /api/v1/campuses/{id}/status',
  },
  rules: {
    deleteRule: '列表中只要展示出来的记录都允许删除（停用状态也可删）',
    paginationRule: '与 /template/list/table 一致；必须有跳页和每页条数切换；样式保持一致',
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
    readonlyRules: ['只读模式不显示提交区（保存/重置按钮）', '只读模式禁止提交，保持字段只读'],
    listRules: [
      '筛选项变更不自动查询，仅点击“查询”触发',
      '分页必须支持跳页与每页条数切换，样式同构 /template/list/table',
      '列表必须使用 useListViewPreferences 持久化表格视图配置',
      'defaultColumnKeys 必须由 columns 动态推导，禁止手写固定字段数组',
      'tableId 必须稳定且全局唯一',
    ],
    feedbackRules: ['必须覆盖 loading / empty / error / partial 四态', 'error 与 partial 必须提供可执行恢复动作（重试/重载）'],
  },
  acceptance: ['bun run lint', 'bun run typecheck', '相关测试通过'],
}
