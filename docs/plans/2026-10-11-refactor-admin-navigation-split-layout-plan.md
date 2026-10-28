---
title: Admin 导航单卡片树与编辑表单实施
type: refactor
status: completed
date: 2026-10-11
---

# Admin 导航单卡片树与编辑表单实施

## Scope and authority

独立有界改造，实施用户确认的 `/storefront/navigation` 示意图及 `apps/admin/docs/ai/ai-rules.md` §4.4。继承已完成的单列／双列设计规范计划；不重开角色页计划，不改变主产品序列、active plan、候选、DC / PG 或其他页面。

在现有 `codex/fix-new-arrival-icon` checkout 顺序实施，保留既有角色、设计文档、Alert 规范与 `.idea/` WIP。翻译文件仅追加本页文案，不提交、推送、创建 PR 或部署。

## Requirements and decisions

- R1：保持 `CustomPageRecipe` 页头及页头／页脚 Tabs，每个 placement 在一张 Card 内使用 `wide` 1200px 内容容器。左侧约 300px 导航树，右侧当前项单列表单，中间主题 token 分割线；不足 900px 内容宽度改为上下布局。
- R2：树选择决定右侧当前对象；全部项草稿保留在父级 state，切换节点、Tabs、容器宽度不丢失修改。新增后选中新项，删除后选中既有邻项／父级，最后一个删除后回到新增入口。沿用原排列和层级按钮，不引入拖拽或多选。
- R3：保持整菜单保存、版本、理由、错误反馈、资源搜索与资源权限。发布／归档仍需要已保存的版本、独立发布权限、至少三字符理由与 Popconfirm；dirty 时禁止状态变更。只读仍可选择与展开，不能写入。
- R4：统一底部工作条，保存整菜单草稿；示意图的重置清除本 placement 的全部未保存菜单项、备注、状态理由、选中和展开状态，经标准 Popconfirm 恢复已加载版本，无额外请求。避免两级目录降为三级导致已有子项从 normalize 中丢失。

KTD1（user-approved）：单 Card 左树／右表单，不嵌套项 Card；布局不改变保存粒度。

KTD2：保留 custom / business override，因为本页是 Header／Footer 独立的整菜单草稿与版本状态变更编辑器，不改写成基于单项详情的 CRUD recipe。复用 Ant Design Tree、Form、Card、Typography、现有固定工具条及内容对齐 class。

KTD3：contracts 已限定最多两级。本次仅在现有 indent 动作入口和 helper 防止有子项的父节点降级，其他 ID、排序和移出逻辑保持原语义；不修改 contracts 或后端。

## Source-to-target contract

| Boundary       | Retained behavior / approved difference                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry          | `/storefront/navigation`，`navigation.read`；Header / Footer 各自保留 mounted 草稿                                                                  |
| Load           | GET `/admin/storefront/navigation/{placement}` -> `data` 菜单或 null；失败本地 Retry                                                                |
| Draft          | 单项 id、label、parentId、position、target 的完整 items state；默认新项 route `/`、空 label、root、末尾 position                                    |
| Save           | PUT 同一路径；完整白名单 `expectedVersion`（已有 record 时）、`items`、`reason`；不只提交当前 Form 字段，不裁剪未显示项；沿用 Idempotency-Key       |
| Validation     | 原页由 API 校验整菜单；本次不新增只校验当前项的提交路径                                                                                             |
| Targets        | route path、external HTTPS URL、internal reference；资源 kind 依权限，picker 保持查询／分页／回显，无权限不请求                                     |
| Order          | up/down 依 sibling 边界；outdent 依 parent；indent 非第一 root 且无子项；删除包含子项，原邻项／父级 fallback 保留                                   |
| Transitions    | POST `/publish` 或 `/archive`；`confirm: true`、`expectedVersion`、`reason`；无记录／busy／dirty／理由不足不得执行；发布需 draft、归档需非 archived |
| Permission     | write、publish 分离；无 write 无新增／排序／删除／保存／重置；无 publish 无状态动作；选择与展开可用                                                 |
| Failure        | localized load/save conflict、resource load error；保存失败保留 mounted 草稿及版本                                                                  |
| State feedback | 当前状态常显；候选／部署详情闭合展示；staleCauses 保留在可决策编辑区；不增加额外摘要或常驻正常态 Alert                                              |
| Reset          | 示意图已确认的新本地动作，恢复全部草稿上下文，不请求、不改变 record 或另一 Tab                                                                      |

## Execution checkpoint

U1、U2 均已完成，无阻塞或实施尾项。导航 focused suite 16/16、类型、局部 Lint / Prettier、翻译与实际宽／窄布局检查通过。主题样式使用共享 token，浏览器确认当前浅色值；未额外修改主题偏好。证据见 `docs/progress/2026-10-11-admin-navigation-split-layout-verification.md`。本计划完成后冻结；主产品 authority 与既有 WIP 保持原状态。

| Unit | Scope                                              | Status   |
| ---- | -------------------------------------------------- | -------- |
| U1   | 导航树、右侧字段与动作、单卡分栏、翻译及针对性覆盖 | complete |
| U2   | L2 与实际宽／窄容器检查、复核和验证记录            | complete |

## Verification contract

Admin L2：仅本页及局部样式与翻译；现有导航 suite 可界定影响，不修改共享 recipe、picker、路由、contracts 或后台。先以节点切换和完整 payload 验证新结构的预期失败；最终运行 navigation-page focused suite、changed-file ESLint / Prettier、i18n checks 和一次 Admin typecheck。覆盖整菜单未显示项、新建服务端 ID、重置、节点删除焦点、两级层级、只读、错误、Tabs 草稿及发布合同。浏览器仅操作未保存草稿，验证实际导航树／表单、布局状态保留、主题及目标选择；不写真实菜单或发布版本。
