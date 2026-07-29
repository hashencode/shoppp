# AI Docs 导航

本目录用于约束 AI 在后台项目中的实现方式，并沉淀迁移规则、检查清单与模板资产。

## 文档分层与权威顺序

- `AGENTS.md`：仓库级协作、执行和记忆规则。
- 本文件：任务入口与文档导航。
- `ai-rules.md`、`page-recipes.yaml`、`component-catalog.yaml`：长期实现合同。
- `legacy-page-migration-workflow.md` 与专项迁移规则：旧页迁移合同。
- checklist、template 与错误模式：消费层资产，不得覆盖上层规则。

新页面或标准页面按 `AGENTS.md` 的 Mandatory Read Order 执行。旧页迁移时，先读
`legacy-page-migration-workflow.md`，再按其中顺序读取核心规则、路由、权限和专项迁移规则。
若旧页迁移工作流与通用页面规则冲突，以迁移工作流为准；接口、权限、路由等事实以当前项目
源码和明确的业务权威文档为准，不从模板或来源项目猜测。

## 核心规则

- [ai-rules.md](./ai-rules.md)
  - 当前项目的 AI 实现硬约束
- [page-recipes.yaml](./page-recipes.yaml)
  - 页面 recipe 与表单选型基线
- [component-catalog.yaml](./component-catalog.yaml)
  - 可复用组件清单
- [page-guardrail-recipes.md](./page-guardrail-recipes.md)
  - 页面级 guardrail
- [shared-capability-sync.md](./shared-capability-sync.md)
  - 跨项目通用能力的准入、适配边界和本地验证记录

## 列表 / 表单迁移规则

- [legacy-page-migration-workflow.md](./legacy-page-migration-workflow.md)
  - 从其他后台迁移页面时的执行顺序与取舍规则
- [list-migration-rules.md](./list-migration-rules.md)
- [form-migration-rules.md](./form-migration-rules.md)
- [list-action-guidelines.md](./list-action-guidelines.md)
- [list-column-width-rules.md](./list-column-width-rules.md)
  - 列表操作列固定宽度计算规则
- [legacy-page-migration-error-patterns.md](./legacy-page-migration-error-patterns.md)
  - 迁移高频错误模式与修复方向

## 旧页迁移资产

- [legacy-page-migration-checklist.md](./legacy-page-migration-checklist.md)
  - 详细版迁移检查清单
- [legacy-page-migration-pr-self-check.md](./legacy-page-migration-pr-self-check.md)
  - 可直接贴进 PR 描述的完整自检模板
- [legacy-page-migration-pr-self-check-lite.md](./legacy-page-migration-pr-self-check-lite.md)
  - reviewer 快速扫的 10 条必查版
- [migration-map.template.yaml](./migration-map.template.yaml)
  - 机器可读迁移映射模板；复制为项目自己的事实文件后再填写

## 脚手架实例化

- [scaffold-instantiation-checklist.md](./scaffold-instantiation-checklist.md)
  - 从 quick-start 创建新项目后核对项目身份、品牌、存储键、环境、路由菜单与示例 API

## 任务入口

### 新页面 / 标准页面

执行 `AGENTS.md` 的 Mandatory Read Order，再按页面 recipe 输出计划并实施。

### 旧页迁移

先读 [legacy-page-migration-workflow.md](./legacy-page-migration-workflow.md)。页面映射不清楚时，
复制 [migration-map.template.yaml](./migration-map.template.yaml) 建立本项目事实记录；未知值保留
`null` 或 `not-run`，不得猜测。

### 通用能力回流

先读 [shared-capability-sync.md](./shared-capability-sync.md)，确认 Generic contract、本地 adapter
和排除项。代码、依赖、测试和文档必须在目标项目本地落地；禁止跨仓 import、复制业务 endpoint、
权限键、菜单或品牌。

### 从脚手架创建项目

完成 [scaffold-instantiation-checklist.md](./scaffold-instantiation-checklist.md) 后再开始业务开发。

## 推荐使用顺序

1. 先读 [ai-rules.md](./ai-rules.md)
2. 做旧页迁移时，先看 [legacy-page-migration-workflow.md](./legacy-page-migration-workflow.md)
3. 按页面类型阅读 [list-migration-rules.md](./list-migration-rules.md) 或 [form-migration-rules.md](./form-migration-rules.md)
4. 落地前用 [legacy-page-migration-checklist.md](./legacy-page-migration-checklist.md)
5. 提 PR 前，用 [legacy-page-migration-pr-self-check.md](./legacy-page-migration-pr-self-check.md)
6. reviewer 快速扫，用 [legacy-page-migration-pr-self-check-lite.md](./legacy-page-migration-pr-self-check-lite.md)
