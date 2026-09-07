# Fashion 与 Decor 统一组合兼容层证据 — 2026-09-07

本文保留 FS-R3-U2 的实现与验证证据。当前单元、状态、阻塞和下一步只由
[FS-R3 执行检查点](../plans/2026-09-06-1346-refactor-fashion-decor-unification-plan.md#execution-checkpoint)
维护；本文不建立第二条执行队列。

## 已交付边界

- 新增可序列化的 registry-local Section composition descriptor：每个 Section 明确 fixture/live
  ViewModel kind、live resolver、命名 catalog binding slot、required/optional cardinality 和 shell
  所有权。
- fixture/live kind 必须一致；binding slot 名称和 setting ID 必须唯一。registry、descriptor 与
  manifest Section 类型可在渲染前进行一一对应验证。
- 新增显式 renderer-owned shell opt-in。只有 descriptor 声明 renderer ownership 且 registry
  提供 `platformShell` 时才包裹 Sections；descriptor 缺失时保留旧 renderer 行为和
  `platformShell` 含义。
- shell fixture 输入使用独立、类型校验后的 `shellViewModels`；live shell 由同一次 live
  composition 解析，不读取 fixture。
- 启用 descriptor 的 registry 按 Section resolver 解析数据。纯展示 Section 可以没有 catalog
  binding；需要 catalog 的 Section 在缺少、重复、未声明、引用类型错误、引用缺失或未发布时
  保留原有 section/setting 局部诊断。
- renderer 在挂载 Section 前校验其实际 ViewModel kind。renderer shell 与 page-owned shell
  不能同时声明；source Section 不存在或不可见时 composition 失败关闭。
- 当前 `fashion-store`、`decor`、`decor-store` registry 都没有启用该 opt-in，因此 U2 不改变任一
  现有页面结构、样式、文案或交互。

## 测试先行证据

- Red：新增 contract 与 theme-engine 测试最初分别因缺少
  `themeCompositionDescriptorSchema` 和 `renderThemeTreePlan` 导出而失败。
- Green：probe registry 的三个 Section 保持声明顺序，只产生一个 renderer shell；无 shell 的
  legacy registry 保持原行为。
- Green：fixture/live 输出相同 Section identity、ViewModel kind 和 shell configuration；live
  provider 不回退到 fixture。
- Green：纯展示 Section 不再触发隐式 product binding 错误；required collection slot 缺失时
  诊断仍关联到原 Section 和 setting。
- Green：descriptor/registry/manifest 数量不一致、缺少 shell component、重复 shell ownership、
  fixture/live kind drift 和 provider kind mismatch 均在组件渲染前失败。

## 验证结果

- `bun test packages/contracts/test/storefront-experience.test.ts packages/domain/test/storefront-experience.test.ts apps/storefront/tests/theme-engine.test.ts apps/storefront/tests/fashion-store-theme.test.ts apps/storefront/tests/decor-store-registration.test.ts`：73 passed。
- 扩展回归加入 Fashion runtime、Decor source contract 后，U2 相关与既有主题测试共 91 passed；
  一个既有 `fashion-store-live-commerce` 断言仍要求 ProductCard 不含 `onMounted(`，而当前 HEAD
  已含该调用。该文件和断言都不在 U2 diff 中。
- `bun run --cwd apps/api test:workers -- test/storefront-experience/experience-api.test.ts`：22 passed。
  直接用 Bun 执行该 Worker 测试会缺少 `cloudflare:workers`；项目规定的 Vitest Worker 入口通过。
- `bun run --cwd apps/storefront verify:themes`：3 个现有主题通过平台 1.0.0 验证。
- `bun run typecheck`、`bun run lint`（含 import boundaries）通过。
- U2 文件的 ESLint、Prettier 与 `git diff --check` 通过。仓库级 `bun run format:check` 仍报告
  18 个 HEAD 已存在的非 U2 文件未格式化；未对这些用户/历史文件做越界改写。
- `fixture-contract.test.ts` 的完整 live-component graph 检查仍发现 HEAD 中
  `FashionStoreLiveProductPage.vue` 直接导入 `@shoppp/contracts`；该文件不在 U2 diff 中，已作为
  既有基线问题保留，不影响新兼容层的 focused verification。

U2 没有启用任何用户可见 registry，因此浏览器截图和交互验收不适用于本单元；U3 在实际启用
renderer shell 的同一变更中承担 fixture/live、SSR/hydration、landmark 和浏览器闭环。
