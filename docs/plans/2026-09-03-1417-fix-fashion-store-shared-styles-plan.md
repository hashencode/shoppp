---
title: Fashion Store Shared Style Ownership - Plan
type: fix
date: 2026-09-03
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: legacy-requirements
origin: docs/plans/2026-08-11-001-feat-fashion-store-functional-integration-plan.md
execution: code
plan_role: corrective-follow-up
---

# Fashion Store Shared Style Ownership - Plan

## Goal Capsule

- **目标：** Fashion Store 的共享控件在首页和内页都正确显示，避免换页后出现黑块、丢失样式或进度线失效。
- **方法：** 将必要样式归还组件，页面只控制布局和明确的外观变体，沿用现有 Vue 和测试体系（KTD1–KTD3）。
- **边界：** 修复滚动控件，并审查 Shell、Header、Footer、SearchOverlay、MiniCart、ProductCard；不改商业行为、上游模板文件或视觉设计。
- **执行：** 在现有主工作树按 U1 → U2 → U3 → U4 实施，保留用户已有的生成文件改动。按仓库规则完成本地验证与 branch/main 交付；本计划不要求 PR、部署或候选验收。
- **停止条件：** 若修复需要改变已批准的视觉差异、交互契约或共享平台边界，先把具体冲突记入本计划，不自行扩大实施范围。

## Authority and Lineage

- **产品上游：** `docs/plans/2026-08-13-001-refactor-shoppp-product-master-plan.md` 管理产品顺序；`origin` 中的 Fashion Store Functional Integration Product Contract 继续治理产品行为。
- **继承基线：** 保留 FS-R9、FS-R22、FS-KTD23、FS-KTD24、FS-KTD25、FS-KTD42，以及 FS-U1–U13 和已有 F/AE 标识的原义。本计划是后续样式修正，不重编号或重写历史验收结果。
- **明确替代：** 只替代共享控件依赖首页 class 才能获得必要样式的实现方式；不替代上游需求、原模板设计、候选规则或发布权限。
- **并行计划：** REL 的 Development Candidate Readiness 保留 Pre-DC/DC/PG 责任，本次修正完成后恢复产品执行指针；DS、CI 仍由主计划登记的各自计划负责。
- **尾项归属：** 本计划独占新增样式修正单元及其证据、后续修补和完成判定；REL 接收完成结果后独立判断候选资格。正式跨模板回归仍属于 DC3。
- **激活规则：** 用户已于 2026-09-03 授权实施；本次激活同步更新主计划指针与本检查点；如新证据影响上游当前完成结论，按受影响的原 U-ID 明确记录重新验证边界，不能用本计划的局部通过替代 U8 或 DC。

## Execution Checkpoint

- **计划分类：** Complete，2026-09-03 完成本地修复与验证。
- **当前单元：** 无；U1、U2、U3、U4 均 Complete。
- **阻塞：** 无。
- **下一具体动作：** 本计划无剩余实施项；产品执行指针交回 REL-Pre-DC，候选资格仍由 REL 判断。
- **更新规则：** 单元状态、执行顺序、当前/下一动作或完成结论改变时，在同一变更中更新本节及主计划摘要。证据写入 `docs/progress/`，不维护第二套单元队列。

## Product Contract

### Summary

让已共用的组件同时拥有完整、可复用的样式。先解决已复现的滚动缺陷，再用同一标准审查其余指定组件。

### Problem Frame

`FashionStoreShell.vue` 输出公共滚动控件，但 `integration.css` 把按钮重置和进度线高度限定在 `.fashion-store-home` 下。商品页显式清空 body class，导致按钮保留浏览器默认背景，再经 difference 混合显示成黑块；已有滚动进度变量也无法驱动线条高度。

会话中的浏览器检查已复现：商品页进度约 47.6%，线条高度仍为 0；首页按钮背景透明且线条有高度。其他组件的首页覆盖是风险线索，尚不能全部认定为缺陷。

### Requirements

- R1. 桌面滚动控件在首页与内页显示清晰，进度随滚动增长，点击后返回顶部且不改变路由。
- R2. 指定共享组件的必要样式不依赖首页 class；有意的页面差异必须能追溯到来源或显式变体。
- R3. 保留已批准的页面外观、响应式布局和现有交互语义。
- R4. 回归验证覆盖跨页面与页面切换后的真实控件状态，不能只检查 DOM 存在或只看首页截图。
- R5. 为后续开发留下简短的样式归属规则，避免重新引入页面对共享组件内部样式的隐式依赖。

### Scope Boundaries

审查范围含 Shell 的 cookie/滚动区、Header、Footer、搜索、迷你购物车和商品卡。图片弹层的 scoped 样式作为已有参考。只有确认误依赖、重复覆盖或迁移必需的规则才修改。

不升级框架，不引入新的组件库、CSS 框架或测试平台，不全量重写 `integration.css`，不改变 Commerce、预览权限、支付或可访问性原语。保留上游 Crafto 文件与批准的差异记录。

## Planning Contract

### Key Technical Decisions

- KTD1. 组件内部样式优先与 Vue 组件同放并使用 scoped；仍需共享的主题基础留在主题 CSS。沿用 `FashionStoreProductLightbox.vue` 的已有方式。scoped 不能屏蔽外部全局规则，迁移时同时核对优先级、继承和第三方样式。Governs R2、R3。
- KTD2. Shell 默认不再代表首页。首页由自身显式声明页面身份；所有默认调用点和显式清空点一起审查，含 fixture 与 live 分支。不得把首页 class 批量加给内页。Governs R2、R3。
- KTD3. 保留组件已有 variants；只有已确认的页面差异需要时才补充具名变体。页级规则只管布局，不用祖先页面 class 修补组件内部控件。不要为所有可能变化建立通用配置系统。Governs R2、R3。
- KTD4. 优先扩展现有浏览器测试、区域截图与 capture contract。滚动控件的修复先建立会失败的实际样式/进度检查；纯样式搬迁采用前后区域对比，不添加源码字符串镜像测试。Governs R1、R4。
- KTD5. 本次只迁移样式责任；保留既有滚动监听、清理和交互实现。若导航测试发现生命周期问题，先确认因果关系，再在本计划中登记局部修复，不扩展成通用 runtime 重构。Governs R1、R3、R4。

### Style Ownership

| 归属 | 内容 | 页面如何使用 |
| --- | --- | --- |
| 主题基础 | 字体、颜色变量、已有通用排版和上游依赖 | 同一主题共同继承 |
| 共享组件 | 内部控件外观、必要重置、状态与响应式规则 | 通过组件 API 与已有变体 |
| 页面 | 区块位置、间距、首页专属内容 | 自己的页面标识与布局容器 |

### Evidence and References

- `apps/storefront/app/themes/fashion-store/integration.css`：滚动规则在首页作用域中；Header/ProductCard 已有部分组件作用域规则及重复首页覆盖。
- `apps/storefront/app/themes/fashion-store/components/shared/FashionStoreShell.vue`：默认首页 body class 与公共滚动标记。
- `apps/storefront/app/themes/fashion-store/runtime/capabilities.ts`：已有进度变量更新、显示阈值与清理。
- `apps/storefront/e2e/support/theme-capture-contract.ts`：静态模式隐藏固定控件，scroll-fixed 模式保留。
- `docs/solutions/workflow-issues/html-source-parity-reconstruction-workflow-2026-08-06.md`：验证可观察结果；禁止把测试隐藏的控件当作已通过。
- [Vue SFC CSS](https://vuejs.org/api/sfc-css-features)：组件样式封装及其对 slot、子组件和全局规则的边界。
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots)：沿用现有区域截图比较，不增设测试平台。

## Implementation Units

### U1. Inventory shared style dependencies

**目标：** 给每组共享规则确定归属，区分缺陷、重复规则与有意差异。**需求：** R2、R3。**依赖：** 无。

**文件：** `apps/storefront/app/themes/fashion-store/integration.css`；该主题 `components/shared/` 下上述组件；`components/FashionStoreHome.vue`、`components/FashionStoreLiveHomePage.vue` 及 `components/pages/` 的 Shell 调用点；`docs/progress/fashion-store-shared-style-ownership.md`（新增）。

**方法：** 对照上游 HTML/CSS、现有例外和实际样式，形成「规则 → 组件 → 使用页面 → 来源/差异 → 处理决定」清单。检查首页专属前缀、重复按钮重置、导航/网格间距和依赖 section 顺序的规则；首页内部的合法布局规则继续留在首页。

**验证：** 审查范围内每个组件都有保留或修改的依据。没有新行为，不增加测试文件；记录匹配视口的区域基线，不把当前黑块保存为正确预期。差异未确认前保留已有外观。

### U2. Repair scroll control ownership

**目标：** 先让同一滚动控件在首页与商品页都正常。**需求：** R1、R2、R4。**依赖：** U1。

**文件：** `apps/storefront/app/themes/fashion-store/components/shared/FashionStoreShell.vue`、`apps/storefront/app/themes/fashion-store/integration.css`、`apps/storefront/e2e/fashion-store-theme.spec.ts`。

**方法：** 按 KTD1、KTD4 把按钮重置与进度高度归到 Shell 自有样式，删除首页专属的重复来源；不额外拆出只有一处使用的新组件。先确认新增商品页回归检查在原实现中失败。

**测试场景：**

1. 桌面直接打开首页和指定商品页，滚过现有显示阈值后按钮无默认实心背景/边框，线条可见。
2. 中段和底部的线条高度随进度增长，底部接近满长；点击返回顶部且 URL 不变。
3. 低于控件现有显示断点时继续隐藏，不产生额外横向溢出。

**完成证据：** 缺陷检查先失败后通过，两页滚动区在匹配视口下通过真实截图核对。

### U3. Complete shared component style boundaries

**目标：** 消除其余已确认的页面样式误依赖。**需求：** R2、R3。**依赖：** U2。

**文件：** U1 列出的共享组件、必要的 Shell 调用页面和 `integration.css`；`apps/storefront/app/StorefrontExperience.vue` 的动态平台 Shell 调用点；`apps/storefront/e2e/fashion-store-theme.spec.ts`、`apps/storefront/e2e/fashion-store-live-commerce.spec.ts`（仅在现有 live 覆盖需要扩展时）。

**方法：** 按 KTD1–KTD3，先迁移组件必要规则，再让 Shell 默认中性，并在 fixture/live 首页显式保留首页身份。逐组件去除已证明等价的重复覆盖；有意差异采用已有变体或窄范围具名变体。保留正确的主题继承、子组件和 slot 样式，不机械搬入 scoped。

**测试场景：**

1. 首页与内页的 Header、Footer、商品卡在桌面/平板/手机下保留各自已批准布局。
2. 搜索打开、输入聚焦、关闭；迷你购物车打开/关闭；cookie 区显示/关闭均保留原行为。
3. fixture 与 live 路由各自使用正确首页身份；已不可用的 live 控件不因样式迁移重新显示。

**完成证据：** U1 清单中每个拟修改项有对应变更和前后结果；其他项有保留理由，指定组件不再靠首页标识获得必要样式。

### U4. Verify route reuse and record conventions

**目标：** 防止修复只在某一次打开或某一个页面有效。**需求：** R3–R5。**依赖：** U3。

**文件：** `apps/storefront/e2e/fashion-store-theme.spec.ts`、`apps/storefront/e2e/theme-behavior-contract.spec.ts`、`apps/storefront/tests/theme-capture-contract.test.ts`（仅发现 capture 缺口时）、`docs/runbooks/source-equivalent-html-template-port.md`、本计划、主计划及 U1 证据文件。

**方法：** 参数化已有测试，复用滚动/区域捕获工具；将组件样式归属规则写入现有 runbook。不要新建测试框架或用测试专用 CSS 掩盖缺陷。

**测试场景：**

1. 首页 → 商品页 → 分类页 → 首页，含浏览器前进/后退：滚动控件进度正确，Shell 页面身份和共享控件样式不残留。
2. 桌面 1440×900、平板 768×1024、手机 390×844 的代表页面保留布局；在既有 1400px 显示断点两侧核对滚动控件可见性。
3. 沿用已有 reduced-motion/no-JS 约定，内容可读、没有新可见黑块；不借本计划改变其显示策略。
4. 现有 Fashion Store 页面矩阵（`apps/storefront/app/themes/fashion-store/page-contracts.ts`）做结构与共享区 smoke；完整交互与区域比较集中在首页、商品页和一个非首页分类/列表页。

**完成证据：** 通过 Verification Contract，将真实测试/截图结果写入证据文件；更新本检查点及主计划，并把后续候选判断交回 REL。

## Verification Contract

- 浏览器入口为 `apps/storefront/playwright.fashion-store.config.ts` 与 `apps/storefront/playwright.fashion-store-live.config.ts`；按改动 spec 过滤执行，复用 `test:fashion-store-live` 的 live 输入。`test:fashion-store` 保留为完整模板验证入口，不在每个单元重复全跑。
- 静态门禁：`bun run --cwd apps/storefront typecheck`；使用仓库 ESLint/Prettier 检查改动文件。单测入口为 `bun test apps/storefront/tests/fashion-store-home-source.test.ts apps/storefront/tests/theme-capture-contract.test.ts`，按实际修改补充已有 source/behavior 单测。
- 以区域截图和计算样式共同证明视觉结果；固定视口、字体加载与浏览器环境，保留 scroll-fixed 控件。批准的视觉基线不能为了通过而批量重录。
- 所有页面做轻量共享区检查，重点页面做详细验证；不把局部修复升级成 U8 云端全量重放、staging 操作或 DC3。正式交付仍遵循仓库当时的必需验证门禁。
- 保留并恢复测试改变的 generated selection 文件；现有用户对 `apps/storefront/app/generated/active-experience.ts` 的改动不能覆盖或混入本修复。

## Definition of Done

U1–U4 均有完成判定，R1–R5 有对应证据；商品页黑块和零高度进度线已消失。指定共享组件的必要样式具有明确归属，首页与内页没有未经批准的视觉变化。清理本次废弃规则和临时实验代码，交付范围只包含本计划拥有的变更；证据与主/子计划检查点一致。完成本计划不自动完成任何 DC 或 PG。

## Completion evidence

2026-09-03：U1 规则盘点、U2 先失败后通过的滚动修复、U3 组件样式与显式首页变体、U4 回归和约定均完成。
证据见 `docs/progress/fashion-store-shared-style-ownership.md` 与
`docs/progress/fashion-store-shared-style-comparison.json`。

- R1：首页/商品/集合页透明按钮、进度增长和返回顶部通过；1399/1400px 断点通过。
- R2：六个组件有归属决定，所有静态和动态 Shell 调用完成迁移。
- R3：44 张区域截图、12 组布局测量匹配；fixture/live 交互与既有回退策略通过。
- R4：15 路由 × 3 视口 smoke、真实链接/历史导航与 live 客户端搜索导航通过。
- R5：现有 runbook 已补充样式归属和验证规则。

类型、静态检查与聚焦单测通过；代码审查 `shoppp-20260903-shared-styles` 完成且无 actionable findings。
本结论不等于完整 U8 重放、DC3、staging 或生产发布，也不改变原有候选阻塞。
