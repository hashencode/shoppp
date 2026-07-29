# 通用能力回流合同

本文档记录当前脚手架从其他后台项目吸收的通用能力、项目适配和验证证据。它不替代 `docs/ai/ai-rules.md`、`docs/ai/page-recipes.yaml` 或实施计划。

## 边界

- 各项目独立保存源码、依赖、测试和发布，不使用跨仓 import、软链接、相邻目录运行时读取或私有共享包。
- 来源仓库只提供设计和错误模式证据；目标仓库必须拥有自己的实现、adapter 和测试。
- endpoint、payload、权限、菜单、品牌、登录会话和单业务域状态机不进入通用合同。
- 目标项目已有规则与来源实现冲突时，以当前项目规则为准。
- 没有当前消费者或稳定错误模式的能力保持 `project-only`，不提前抽象。

## 状态口径

- `source`：来源项目已验证，当前项目尚未实施。
- `adapting`：当前项目正在按本地合同适配。
- `verified`：当前项目实现及约定验证均完成。
- `project-only`：不适合回流或当前没有足够消费者。

## 来源基线

| Project | Revision | Role |
|---|---|---|
| `gmxgy-admin-new` | `2d4ea351b89be39d931d29867a9bdb5a1c5ea964` | 远程选择、下载、表宽审计、筛选字段、回流治理参考。 |
| `fzzx-admin` | `bfd38516a8dba334d2f7c8420cf46651d5e9ff2d` | 表单 recipe、并发上传、app base、Playwright 运行合同参考。 |
| `codex-admin-quick-start` baseline | `f209e718c6c9ca4d5f367510fa969324caaf8d1b` | 本次回流前的目标项目基线。 |

Revision 用于复核本轮证据，不表示后续自动同步。新的回流必须重新记录来源 revision。

## 当前清单

| Capability ID | Source evidence | Generic contract | Local adapters / exclusions | Status | Local verification |
|---|---|---|---|---|---|
| `form-recipes` | `fzzx-admin:src/shared/template-kit/recipes/basic-crud-form-recipe.test.tsx`; `fzzx-admin:src/shared/template-kit/recipes/step-form-recipe.test.tsx` | 多 Card 三态表单和分步表单的宽度、对齐、必填标识与重复提交边界。 | 页面保留业务校验和步骤状态机；不新增 `AdvancedFormRecipe`。 | `verified` | BasicCrud/StepForm 聚焦测试、全量测试、typecheck。 |
| `form-error-scroll` | `fzzx-admin:src/shared/template-kit/form/form-validation-scroll.test.ts`; `fzzx-admin:src/shared/template-kit/recipes/basic-crud-form-recipe.test.tsx` | 全页面标准 submit 校验失败时平滑滚动并聚焦首个错误字段；手动 `validateFields` 复用同一滚动参数并继续抛出原错误。 | `BasicCrudFormRecipe` 自动继承；分步模板显式调用 helper；短表单、Modal、登录即时校验不强制接入。 | `verified` | 本地 8 条聚焦测试、48 文件/227 用例全量测试、typecheck、定向 ESLint、YAML、差异检查与真实基础表单浏览器验证通过。 |
| `form-save-result-modal` | `fzzx-admin:src/shared/template-kit/form/form-save-success-modal.test.ts` | 关闭按钮留页，确认按钮执行既有离页回调。 | 页面提供文案和回调；删除、发布、审核等非保存行为不纳入。 | `verified` | 配置纯函数测试与全量测试。 |
| `table-width-audit` | `gmxgy-admin-new:src/test/table-width-audit.test.ts` | AST 审计识别操作列 resolver 的密度增量和上限。 | 保留当前项目列宽规则和既有脏文件基线。 | `verified` | 表宽审计单测与 `qa:table-widths`。 |
| `standard-filter-fields` | `gmxgy-admin-new:src/shared/template-kit/list/template-list-filter-form.test.tsx` | 标准 `number` 与 `remote-select` 字段，筛选变化不自动查询。 | 查询触发仍由页面 controller 管理；普通字段不使用 `custom`。 | `verified` | 筛选组件交互测试与全量测试。 |
| `standard-list-controls` | `gmxgy-admin-new:docs/ai/shared-capability-sync.md`; `fzzx-admin:src/shared/template-kit/recipes/standard-list-page-recipe.test.tsx` | 搜索设置位于重置/查询前；刷新使用图标加文本；业务动作与列表工具之间仅在业务动作可见时显示分隔线。 | 标准 Recipe 自动继承；`toolbarExtra` 由页面声明权限过滤后的显式可见性；弹窗内局部列表排除。 | `verified` | 17 个聚焦测试、42 文件/208 用例全量测试、typecheck、定向 ESLint 和真实页面布局验证。 |
| `standard-modal-rules` | `fzzx-admin:src/shared/template-kit/standard-modal-rules.test.ts` | 标准 Modal 的数值宽度大于等于 `1000px` 时使用 `top: 24px`，窄弹窗保留默认定位。 | 当前暂无业务消费点；`centered`、全屏、显式纵向定位和非数值宽度不自动处理。 | `verified` | 本地阈值边界单测、真实浏览器渲染与 typecheck。 |
| `modal-list-rules` | `fzzx-admin:src/shared/template-kit/list/modal-list-rules.test.ts` | Modal 表格使用 `middle` 标准密度；分页列表左下角展示“共 N 条数据”。 | 当前暂无业务消费点；模板 recipe 独立持有实现，业务状态机不进入共享层。 | `verified` | helper 与 ModalList recipe 聚焦测试、typecheck。 |
| `remote-search-select` | `gmxgy-admin-new:src/shared/components/remote-search-select.test.tsx`; `fzzx-admin:src/shared/components/remote-search-select.test.tsx` | stale 隔离、StrictMode、分页耗尽、可聚焦错误重试、string/number 单选、multiple/tags、按打开加载、默认项合并、自定义空态与外部 loading。 | `fetchOptions` 继续由业务 adapter 注入；不复制业务接口。 | `verified` | 本地 12 条聚焦测试、49 文件/237 用例全量测试、typecheck 与构建通过。 |
| `upload-concurrency` | `fzzx-admin:src/shared/components/upload-form-item.test.tsx`; `gmxgy-admin-new:src/shared/components/upload-form-item.browser.test.tsx` | auto/card/button 展示；JPEG/PNG/WebP 默认压缩、GIF 绕过、格式对齐和压缩失败阻断；并发、删除迟到响应和父级 value 回写一致性。 | 必须注入 `uploadFile`；保留调用方 `beforeUpload`；禁止复制来源项目 endpoint、鉴权和返回码。 | `verified` | 本地 16 条组件测试、2 条 Browser Mode、49 文件/237 用例全量测试、typecheck 与构建通过。 |
| `download-infrastructure` | `fzzx-admin:src/shared/utils/download.test.ts` | Blob 文件名、JSON 错误、transport-only fallback、安全 URL 与 window features。 | 允许相对路径和无凭据 HTTP(S) 静态文件；业务反馈留在调用方。 | `verified` | 下载工具、URL 边界与 ListExcelActions 测试。 |
| `file-preview` | `fzzx-admin:src/shared/components/file-preview.test.tsx`; `gmxgy-admin-new:src/shared/components/file-preview.test.tsx` | MIME/文件名/URL 后缀识别图片、PDF、HLS/MP4 视频和未知文件；统一触发、加载/失败、销毁与显式下载合同。 | UploadFormItem 作为本地 adapter；不纳入直播、证书 Canvas、Office 和 HLS 分片合并。 | `verified` | 24 条 FilePreview/VideoPlayer/UploadFormItem 聚焦测试、7 条浏览器测试、222 条全量测试、typecheck 和构建通过。 |
| `app-base-navigation` | `fzzx-admin:src/shared/utils/app-base.test.ts` | 可选 basename、资源前缀、内部链接、新窗口和关窗回退一致。 | 只使用 `PUBLIC_APP_BASE`；不复制 `/xxz/` 业务资源后缀。 | `verified` | 纯函数、导航、默认/子路径构建和 smoke。 |
| `operational-e2e` | `fzzx-admin:playwright.config.ts` | env mode、受管服务、模板排除、失败产物和无凭据 smoke。 | 路由和选择器按当前项目；真实后端旅程与角色账号延期。 | `verified` | discovery、非法 env mode、根路径 smoke、子路径 smoke。 |
| `standalone-file-action-buttons` | `gmxgy-admin-new:src/shared/components/export-button.tsx`; `fzzx-admin:src/shared/components/download-button.tsx` | 独立导出/下载按钮的 pending 与反馈。 | 当前只有 `ListExcelActions` 一个明确消费者，未满足晋升条件。 | `project-only` | 等出现至少两个额外稳定消费者后再评估。 |

## 回流完成规则

1. 先补能复现当前缺口的测试或审计证据。
2. 实现只复制通用行为，业务合同留在目标项目 adapter。
3. 聚焦测试、全量测试、typecheck 和适用的构建/E2E 门禁通过后，才能把本地状态改为 `verified`。
4. 计划、测试或外部环境受阻时保持 `adapting`，并记录具体缺口；不得从来源项目状态推断本项目通过。
