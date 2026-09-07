# Fashion 与 Decor U6 迁移与发布证据 — 2026-09-07

本文保留 FS-R3-U6.2 的实现、审查和验证证据。当前单元、状态、阻塞和下一步只由
[FS-R3 执行检查点](../plans/2026-09-06-1346-refactor-fashion-decor-unification-plan.md#execution-checkpoint)
维护；本文不建立第二条执行队列，也不推进 Candidate、DC、PG、部署或生产状态。

## 已交付边界

- `fashion-store@1.1.0/schema-2` 现在发布 `source-parity` 与 operator-selectable
  `unified-store` 两个 preset；Admin 从生产 catalog 明确选择 preset，API 只允许 successor
  package 用于创建和激活。
- 默认生产 registry 注册唯一受支持的 direct migration：
  `fashion-store@1.0.0/schema-1 -> fashion-store@1.1.0/schema-2`。迁移为纯 override 转换，
  不依赖测试注入或链式执行。
- 历史 source package、draft 与 snapshot 保持不可变且可读；成功、冲突和拒绝路径均不修改
  source draft。迁移 successor 保留原 preset ID 与完整 binding 数组，包括 catalog binding。
- 原 monolithic Home 的完整 reorder 被扩展为 successor 的稳定 Section 集。旧
  `merchandising-order` 被转换为 Best Sellers 的确定位置；旧 `merchandising-visible` 被转换为
  `fashion-store-home-best-sellers` 的 visibility；新的 default-hidden Product merchandising Section
  保持独立并确定性置于末尾。reset 恢复各自 successor 默认值。
- 旧 fixture binding ID 不被重写。successor registry 为拆分后的 Home Section 声明 exact-package
  alias，使保留的 schema-1 binding 在 fixture preview 中继续解析；alias 只对 exact successor
  package 生效，不外溢到未来 schema。
- `unified-store` 新 draft 的保存、重置、校验与 preview 均解析已保存版本；既有 permission、
  optimistic version、migration conflict 与 fail-closed package boundary 保持不变。

## 审查与收敛

- 简化复审应用了五项局部改进：exact-package alias gating、ledger ID 复用、fixture binding 一次索引、
  membership Set 复用和单次 structured clone；保留整行 source-draft 快照比较以证明字节级不变性。
- 多视角审查发现一个 P1：旧 merchandising visibility/order 最初会在绿色迁移后失去其业务所有权。
  修复后它们只映射到 Best Sellers，而不误指向 U4 新增的 Product merchandising Section。
- 独立 validator 复核该 finding 与修复为有效；修复后的 unit、API resolved preview、typecheck 和 lint
  全部通过。审查 artifact 位于
  `/tmp/compound-engineering-501/ce-code-review/20260907-190704-c6d57ab7`。配置的外部 peer CLI
  不存在，因此采用本地 adversarial fallback，未宣称跨模型背书。

## 验证结果

- Contract/domain/theme-engine/Fashion package 与 theme focused：84 passed。
- Cloudflare API 全套 worker：216 passed；其中 U6.2 focused file 为 25 passed。
- Database worker：13 passed。
- Admin editor unit：30 passed；Admin browser：23 passed。
- `bun run typecheck`：通过全部 tools、e2e、Admin、API、Storefront、contracts、database 与 domain。
- `bun run lint`：通过 ESLint、import boundaries 与 workspace lint。
- `bun run verify:themes`：生成 catalog 为 current，3 个现存 theme 均通过 platform `1.0.0` 验证。
- 已知非本次回归：包含 `fixture-contract.test.ts` 的更宽组合为 96 passed / 1 failed；失败仍是未修改的
  `FashionStoreLiveProductPage.vue` 直接导入 `@shoppp/contracts`，与 U6.1 已记录 baseline 相同。

U6.1 与 U6.2 至此共同完成 U6。未修改或删除 `decor` / `decor-store` runtime；运行时冻结、授权环境
inventory、reference-only 分离和删除权限仍由 U7/U8 管理。
