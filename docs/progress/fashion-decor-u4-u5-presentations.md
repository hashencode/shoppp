# Fashion 与 Decor 统一展示收敛证据 — 2026-09-07

本文保留 FS-R3-U4 与 U5 的实现和验证证据。当前单元、状态、阻塞和下一步只由
[FS-R3 执行检查点](../plans/2026-09-06-1346-refactor-fashion-decor-unification-plan.md#execution-checkpoint)
维护；本文不建立第二条执行队列。

## U4 已交付边界

- Fashion successor Home 为 categories、marquee、collection、brand strip、editorial 和 services
  提供 U1 批准的六个 schema-validated 展示变体；fixture 与 live provider 通过同一 Section
  presentation ViewModel 传递设置。
- 新增稳定可选 singleton `fashion-store.product-merchandising`，instance ID 为
  `fashion-store-home-product-merchandising`，固定顺序 110，默认隐藏。新品、畅销和精选分组复用
  Fashion ProductCard；live 分组严格限制在已发布 Home collection membership 内。
- 分组使用原生 button、`aria-pressed` 与局部选择状态；loading、validation-error、unavailable 和
  empty 均有确定输出。无效 catalog binding 继续由共享 live provider 失败关闭，未放宽数据信任边界。
- 连续品牌带使用两个等宽副本并按轨道精确一半位移；reverse marquee 只绑定一个明确轨道；两者在
  reduced-motion 下静止。`source` 变体保留既有直接子节点 DOM 契约。
- 未导入 Decor runtime、全局脚本、jQuery、Revolution 或远程资源，未重建 Hero，也未修改两个
  Decor runtime 子树。

## U5 验证型 no-op

U1 已明确拒绝 Shop/Product Decor 路由变体。U5 因而不增加设置、ViewModel 字段、CSS 或组件：
Fashion collection/product 页面、筛选、排序、分页、商品选项、画廊、价格、库存、导航和购物车
action 继续由原有 typed ViewModel 与 Commerce ports 唯一负责。处置清单与测试共同证明没有第二条
Decor commerce 路径或不支持的 wishlist/account 行为进入 Fashion。

## 审查修复

- 多视角代码审查发现并修复：featured product 越出 collection membership、provider/state 测试
  只验证文本、浏览器输入模式覆盖不足、marquee 双动画，以及品牌带末帧跳变。
- 关于“无效 binding 应降级到 Section 局部错误”的建议未照原案采用：这会削弱共享 provider 的
  route-level fail-closed 契约。实现只把已到达组件的 malformed populated payload 映射为局部
  validation-error，并保留无效 binding 的全页失败关闭。
- 审查输出保存在本次 `ce-code-review` run 目录；复审后无剩余 actionable finding。

## 验证结果

- Focused Fashion/theme：143 passed。
- Admin 编辑器 unit/browser：29 passed + 5 passed。
- Unified Home Playwright：desktop 与 mobile reduced-motion 共 2 passed，覆盖 mouse、Space、Enter、
  touch、resize、六个展示样式、真实 animation transform 与品牌循环首尾几何。
- 既有 Fashion live Playwright：15 passed；Product groups 不改变权威 browse-to-order 路径。
- Storefront/workspace typecheck 通过；U4/U5 diff 的 Prettier 与 `git diff --check` 通过。
- 全量 fixture acceptance 在前 25 个用例中暴露 3 个既有非 U4 失败后停止：两个用例重复点击已由
  前序用例持久化接受的 cookie 按钮而超时，一个共享 MiniCart 断言固定期望 3 个关闭按钮但当前
  fixture 为 2。U4 专用、Home 行为与 live 全套门禁均通过；这些非 diff 基线不改写 U4/U5 边界。
