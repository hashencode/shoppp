---
title: Admin UploadFormItem Contract Alignment - Plan
type: fix
date: 2026-08-10
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# Admin UploadFormItem Contract Alignment - Plan

## Goal Capsule

- **Objective:** 在 `shoppp/apps/admin` 本地同步 UploadFormItem 的默认图片、实际值感知 auto 与 P2 accept 校验合同，防止模板副本继续传播旧行为。
- **Repository scope:** 仅 admin 应用的共享组件、样式既有行为测试和必要文档；当前没有生产调用点，不新增业务页接入。
- **Authority:** 用户确认的行为合同优先；本仓 i18n、必填 `uploadFile`、mounted 防护和 monorepo 边界必须保留。

## Product Contract

### Requirements

- R1. 默认 accept 为 `.jpg,.jpeg,.png`。
- R2. `displayMode > listType > auto`；auto 在混合 accept 下由实际值中的图片 URL 决定整组卡片，否则列表。
- R3. 图片 URL 识别大小写、query/hash；未知或无扩展名按 accept 回退。
- R4. 外部 hook 的 `false/LIST_IGNORE` 原样短路；返回 File 使用其名称/MIME，返回裸 Blob 沿用原名称。
- R5. 组件自身判定 accept 不匹配时显示一次本地化格式错误提示并返回 `Upload.LIST_IGNORE`，且不进入压缩、`uploadFile`、状态/value 更新；外部 hook 自行拒绝时不追加重复提示。
- R6. 保持 i18n 文案、mounted 防护、并发、readonly、预览、删除、样式作用域与 `uploadFile` 必填 API。

### Acceptance Examples

- AE1. 默认字段为卡片，不能选择 PDF。
- AE2. 混合 accept 的 PDF-only 回填为列表，任一 JPG/PNG 回填使整组为卡片。
- AE3. 外部 hook 返回新 JPG File 时上传新文件；裸 Blob 沿原扩展名判断。
- AE4. 组件自身类型拒绝显示一次本地化格式错误提示且拒绝项不出现在列表；外部 hook 拒绝不产生组件重复提示。

### Scope Boundaries

- 不新增生产消费者，不修改 storefront/API/contracts。
- 不跨仓 import 或 symlink，不把其他仓请求层复制进来。
- 不改变上传返回值或 admin 的部署边界。

## Planning Contract

### Key Technical Decisions

- KTD1. 只同步纯行为函数和决策顺序；保留本仓 i18n 与生命周期实现。
- KTD2. 使用 memo 化的 value URL 列表作为展示信号，避免受控父组件重建等价值时产生额外 file-list 更新。
- KTD3. 候选文件强校验位于外部 hook 后、压缩和 adapter 前。

## Implementation Units

### U1. Expand component and browser contract tests

- **Goal:** 用本仓测试覆盖统一场景矩阵。
- **Requirements:** R1-R6; AE1-AE4.
- **Files:** Modify `src/shared/components/upload-form-item.test.tsx`; modify `src/shared/components/upload-form-item.browser.test.tsx`.
- **Approach:** 单测覆盖纯决策与副作用，Browser Mode 覆盖 Ant Upload 的触发器、列表模式和拒绝项不可见。
- **Test scenarios:** 默认图片；混合 PDF/image/unknown；数组/逗号值；显式模式；File/Blob；组件拒绝提示一次、外部拒绝不重复提示；拒绝后的既有值；readonly/删除回归。
- **Verification:** 新断言在旧实现上失败，既有 i18n 与生命周期测试继续有效。

### U2. Align the admin-local component

- **Goal:** 通过 U1，同时维持 admin 专属基础设施。
- **Requirements:** R1-R6.
- **Dependencies:** U1.
- **Files:** Modify `src/shared/components/upload-form-item.tsx`.
- **Approach:** 收窄默认 accept；加入 memo 化 value 图片信号；实现 File/Blob 候选与 accept 匹配；拒绝返回 `LIST_IGNORE`；不改 `uploadFile` 签名和 mounted guard。
- **Verification:** 无生产调用点 diff，组件与 Browser Mode 测试通过。

### U3. Verify workspace boundaries

- **Goal:** 确认改动仅影响 admin 共享组件。
- **Requirements:** R6.
- **Dependencies:** U2.
- **Files:** No additional production files expected.
- **Approach:** 运行 app 级类型检查、lint、测试和测试构建；复核 monorepo diff 未触及 storefront、API 或共享 contracts。
- **Verification:** 所有 app 门禁通过且边界清晰。

## Verification Contract

| Gate | Done signal |
| --- | --- |
| `bun run --cwd apps/admin test -- src/shared/components/upload-form-item.test.tsx` | 组件矩阵通过 |
| `bun run --cwd apps/admin test:browser -- src/shared/components/upload-form-item.browser.test.tsx` | 浏览器交互通过 |
| `bun run --cwd apps/admin typecheck` | 类型检查通过 |
| `bun run --cwd apps/admin lint` | admin lint 通过 |
| `bun run --cwd apps/admin build:test` | 测试构建通过 |

## Definition of Done

- R1-R6 均被本仓自动化测试覆盖。
- 当前无生产消费者的事实保持不变。
- i18n、mounted guard、adapter API 和 monorepo 边界无回归。
