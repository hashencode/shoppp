# Admin PDF loading 同步计划

本计划是用户授权的独立局部修复，不改变产品主计划、产品顺序或发布状态。

## 范围与来源

- 目标：Shoppp Admin 的共享 `FilePreview`，属于附件预览反馈；无新增业务页面、表单类型、筛选、路由、权限或操作列。
- 目标基线：`1c7ae747b24e7caf47ca584ffa861c937051296f`，使用现有 checkout 的 `codex/admin-pdf-loading` 分支。
- 参考医院监测后台当前 PDF loading 实现，仅采用预览区域固定、统一 loading 与首页渲染完成回调。
- 来源是未提交工作树快照，不冒充 quick-start 已批准来源：`file-preview.tsx` Git blob 为 `07e3a29af2116cad1bd563eb39c920a286c9ff20`，`file-preview-pdf-content.tsx` 为 `20021a6bd989174b5f6b1d8a3f9f5b8c3e9d2f20`。
- 实际复用 Shoppp 的翻译、主题 token、响应式页宽、source/session 隔离、PDF.js → native → download、认证下载、15 秒超时与资源清理。
- 不采用来源中的图片退出动画、公共预览 props、Alert 文案或上传组件改动，不添加依赖或跨仓运行时引用。

## 实施

1. 在现有单元测试中先证明 loading 持续到首页绘制完成，其他页先完成不能清除；native 请求期间维持同一提示，失败后保留下载恢复。
2. 由 `FilePreviewPdf` 统一持有固定高度、主题背景与 loading；加载模块和 PDF 文档、页面不再单独渲染 loading。PDF.js 首页绘制完成才隐藏；native 准备好 Blob 并设置 iframe 后结束应用侧 loading，不把 iframe load 视为绘制证明。
3. 增强现有 Browser suite，用实际双页 PDF 和延迟请求检查明暗主题、居中、容器稳定及真实渲染；保存忽略的验收截图。
4. 更新 Admin 采用记录，准确区分历史 PDF 回退与本次 loading 增量，记录目标验证。

## 文件与验证

修改 `apps/admin/src/shared/components/file-preview.tsx`、`file-preview-pdf-content.tsx`、现有 `file-preview.test.tsx` / `file-preview.browser.test.tsx`，以及 `apps/admin/docs/ai/shared-capability-sync.md`。本文件保存本次独立范围。

验证等级 L3：根 workspace 与 Admin 依赖表、全 src 的 import/reference 显示直接链路为 PDF content → FilePreview → UploadFormItem，没有业务页或其他 workspace 的直接消费者和 barrel。运行 FilePreview、PDF fallback、视频加载错误、UploadFormItem 单元 suites，两个预览/上传 Browser suites，改动文件质量检查和一次 Admin typecheck。无 contracts 或其他应用改动，不运行 monorepo 发布验证。

验收重点：仅一个 loading、文档完成但首页未绘制时仍显示、第二页先完成不误消失、源变化重置、native 等待和失败恢复、明暗主题及桌面/窄窗口布局。API、参数和权限未改动；使用现有失败/安全源测试回归，不增加业务权限分支或路由案例。

相关经验检索仅发现无关的 storefront 来源复建文档，没有适用的 PDF 专项条目；既有共享采用合同继续约束本次适配。

结果见 `apps/admin/docs/ai/shared-capability-sync.md` 的本次采用记录。本计划不承担产品当前阶段或发布状态。
