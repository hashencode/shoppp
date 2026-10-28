# Admin 角色详情布局与权限树验证

实施 authority：`docs/plans/2026-10-11-refactor-admin-role-permission-tree-plan.md`。范围为 `/access/roles/:id` 的普通角色与受保护 Admin；本记录只保存验证证据，不维护产品执行队列。

## 实施结果

- R1：复用 `BasicCrudFormRecipe` 的页头、Card、`wide` 1200px 内宽与固定工具条。资料列 320px，权限列使用余宽，以主题 token 分隔；实际内容小于 900px 时改为同卡上下排列。
- R2：局部 `PermissionTree` 由真实权限目录生成父子节点，支持父节点全选、半选、全选权限与展开／收起。提交按目录顺序保留叶子权限；搜索只高亮匹配并展开，不改变选择或调用者可授予范围。
- R3：Admin、自身角色、无写权限和超出授权范围的角色不可修改。搜索、展开仍可用；只读父节点的全选／半选状态从已授予叶子投影，避免 disabled checkbox 阻止 Ant Design 联动后显示错误。
- R4：保留精确 PATCH 字段与版本、削减确认、依赖失败和冲突恢复。削减判断取 Form 校验后的提交值；重置同时恢复已加载资料、权限与树的搜索／展开。

## L2 验证

在 `apps/admin` 执行：

- 先对新增父节点选择用例运行测试：旧实现无法找到权限树，产生预期失败。
- `bun run test src/pages/iam/iam-pages.test.tsx`：39/39 通过。覆盖目录叶子 payload、权限削减确认、四种只读原因及提交阻断、重置、加载重试、caller subset、归档依赖和 stale role version。
- 最后调整测试的 TypeScript 断言并补充只读父节点状态后，针对变动的 7 个用例重跑：7/7 通过，32 个未变用例跳过；生产代码与 39/39 完整运行时一致。
- `bun run typecheck`：通过。
- 限定角色详情、权限树、IAM 测试与翻译文件的 ESLint：通过。
- `bun test tools/check-admin-i18n.test.ts`：8/8 通过，43 条断言。
- 限定交付文件的 Prettier 与 `git diff --check`：通过。

## 实际浏览器

本地 Admin `http://127.0.0.1:3418`，已登录本地测试账号，仅编辑未保存草稿；没有提交真实角色修改。

- 1280 × 720：普通角色与 Admin 同卡双列，实际内容约 928px，列宽 320px / 576px；普通角色显示固定保存／重置，Admin 无保存／重置／归档且资料字段禁用。
- 普通角色：点击商品目录父节点从 1/4 到 4/4；编辑名称与搜索后切换窄屏，资料与选择保持。重置确认后恢复服务器加载值、半选、空搜索及展开状态。
- 390 × 844：上下单列、横向分隔，无页面横向溢出；响应式变化不重挂字段。测试后恢复默认视口。
- 深浅主题：Card、Tree 与分割线随主题变化；深色 Card / Tree 为 `rgb(31, 31, 31)`，分割线为 `rgb(48, 48, 48)`。验证后恢复跟随系统，当前为浅色。
- 实际截图保存于本线程 `shoppp-style-audit/implemented-role-support.png`、`implemented-role-admin.png`、`implemented-role-admin-narrow.png` 和 `implemented-role-admin-dark.png`。

## 简化与代码复核

使用 ce-simplify-code 和 ce-code-review 的检查方法，按仓库 AGENTS 的 Task／Subagent 映射在主线程顺序完成；未运行独立代理或跨模型审查。

- 复用：沿用基础 recipe、Ant Design Tree、权限目录、IAM 服务与翻译上下文；创建角色弹窗继续使用原 checklist，无共享组件迁移。
- 简化：父节点生成使用同一份分组元数据及选中数量，减少重复计算与 TreeData 类型转换。
- 复核正确性、测试、项目规则、维护性、授权边界、错误恢复与前端状态组合。查看路由权限、原 checklist、recipe 和服务合同；未发现本次变更引入的可行动问题。
- 核对 R1–R4 与 U1–U2 均已满足；没有引入自动勾选读／写、扩展调用者授权、共享路由或后端更改。
- 检查了父级键误入 payload、只读可提交、调用者子集丢失已有授权、重置残留树状态、搜索改变权限、重复提交和冲突恢复等场景。既有 version 校验及 server 权限合同继续承担最终写入校验。

结论：本范围本地验证通过，Actionable findings: none。修改留在当前工作区，未提交、推送或部署；既有文档与其他线程 WIP 保持保留。
