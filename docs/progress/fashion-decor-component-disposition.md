# Fashion 与 Decor 统一处置证据 — 2026-09-07

本文保留 FS-R3-U1 的能力与身份清点证据。当前单元、状态、阻塞和下一步只由
[FS-R3 执行检查点](../plans/2026-09-06-1346-refactor-fashion-decor-unification-plan.md#execution-checkpoint)
维护；本文不建立第二条执行队列，也不授权删除任何运行时文件。

可执行清单位于
`apps/storefront/app/themes/fashion-store/unification-disposition.ts`。测试会将清单与当前
`decor` / `decor-store` 组件、fixture、runtime 文件、注册 Section、路由、来源区域和行为账本
逐项比较；新增但未分类的项目会失败。本文提供产品可读的理由和后续实现边界。

## 盘点方法与冻结范围

- 代码身份：`decor` 与 `decor-store` 分开记录，但属于同一 Decor 退休谱系。
- 输入范围：22 个 Vue 组件、7 个 fixture 文件、18 个 runtime/生成片段文件、18 个注册
  Section、16 条启用路由、13 个首页来源区域、13 个首页行为、全部 14 个次级页面行为记录。
- 资源范围：82 个 modular Decor 展示图片；Decor Store 的 94 个来源图片、1 个本地占位图、
  9 个字体、8 个 CSS 文件和 8 个 JavaScript 文件。
- 接受规则：只有能说明独立运营任务或购物者结果、现有 Fashion 能力无法表达的可见差异、
  以及长期 Fashion 维护者的项目，才成为新 Section；其余优先复用 Fashion 或保留为参考证据。
- 行为规则：结构一致不等于行为一致。每个保留能力仍须在后续单元覆盖触发、依赖、可见结果、
  指针/键盘/触摸、响应式、无障碍和验收路径。
- 删除边界：U1 不编辑或删除两个 Decor 子树。HTML、摘要、来源契约、行为账本和截图的物理迁移
  属于 U7；运行时删除属于 U8。

## 能力处置矩阵

| 能力                                   | 唯一价值判断                                                                            | 处置                           | Fashion 归属                                                    | 后续验证                                                                 |
| -------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Hero                                   | 已由 `FashionStoreDecorHero` 完整迁移，没有第二个 Hero 的价值                           | Fashion 复用；旧 Hero 退休     | `FashionStoreDecorHero`                                         | 保留三张幻灯、时序、输入模式、reduced-motion、失败、resize、remount 回归 |
| Header / Footer / Shell                | 布局差异不足以支持第二套导航与状态所有权                                                | Fashion 复用                   | `FashionStoreHeader`、`FashionStoreFooter`、`FashionStoreShell` | 唯一 shell/header/footer/main，搜索与 MiniCart 互斥和焦点回归            |
| 分类与促销卡                           | Decor 的图标分类与叠层促销能提供不同的内容编排，但无需新业务逻辑                        | Fashion 视觉变体               | `fashion-store.categories`、`fashion-store.promotion`           | 同一 collection destination、响应式几何和键盘导航                        |
| 商品分组 Tabs                          | 在一个区域切换新品、畅销和精选，能避免堆叠多个长商品网格；现有单一商品 Section 无法表达 | **建议批准为唯一新增 Section** | `fashion-store.product-merchandising`                           | typed catalog groups、tab 键盘/指针/触摸、空组、Fashion ProductCard 行为 |
| Marquee                                | 仅内容、颜色和方向呈现不同                                                              | Fashion 视觉变体               | `fashion-store.marquee`                                         | 真实位移、连续循环和 reduced-motion 静态内容                             |
| Collection feature                     | Decor 卡片构图不同，但 collection 目的地与轮播逻辑重叠                                  | Fashion 视觉变体               | `fashion-store.collection-feature`                              | Fashion carousel、断点可见张数、导航和 remount                           |
| Client strip                           | 可见品牌证明和连续运动不同，但不是独立业务能力                                          | Fashion 视觉变体               | `fashion-store.brand-strip`                                     | 本地资产、运动/静态分支和无重复 runtime                                  |
| Journal                                | 卡片视觉可保留，文章导航与数据必须沿用 Fashion                                          | Fashion 视觉变体               | `fashion-store.editorial`                                       | Fashion EditorialCard、文章 destination 和空状态                         |
| Service strip                          | 图标与排版可配置，服务语义已存在                                                        | Fashion 视觉变体               | `fashion-store.services`                                        | 响应式、文本溢出和无伪造业务状态                                         |
| Shop / Product replicas                | Fashion 已拥有侧栏、商品页、画廊、数量和真实 Commerce；纯换皮不足以成为长期设置         | Fashion 复用；U5 验证型 no-op  | Fashion collection/product pages                                | fixture/live 使用同一 typed ViewModel 和 Commerce ports                  |
| Cart / Checkout / Account / Wishlist   | Decor 页面只维护本地 DOM 状态，会形成第二购物车、结账或账户真相                         | Fashion 复用；副本不迁移       | Fashion 对应页面与 ports                                        | 权威数量、金额、认证、错误和重试状态                                     |
| Blog / Article / About / FAQ / Contact | 来源副本只保留对照价值；可见内容页能力由 Fashion 负责                                   | Fashion 复用，来源参考保留     | Fashion content pages                                           | 路由、表单真实状态、accordion/carousel 和无实现新增文案                  |
| jQuery / Revolution / DOM patches      | 不提供独立产品价值并违反统一运行时边界                                                  | 退休                           | Fashion Vue/Swiper/shared primitives                            | 依赖、bundle、网络和残留扫描                                             |

除“商品分组 Tabs”外，不新增 Decor 独有 Section。分类、促销、Marquee、Collection、品牌、
Journal 和服务仅作为对应 Fashion Section 的受限展示设置；Shop 与 Product 不新增 Decor 样式开关。

## 注册 Section 对照

| 来源 Section               | 处置                       | 目标                                  |
| -------------------------- | -------------------------- | ------------------------------------- |
| `decor.category-showcase`  | 视觉变体                   | `fashion-store.categories`            |
| `decor.client-strip`       | 视觉变体                   | `fashion-store.brands`                |
| `decor.collection-feature` | 视觉变体                   | `fashion-store.collection`            |
| `decor.footer`             | 复用                       | `FashionStoreFooter`                  |
| `decor.header`             | 复用                       | `FashionStoreHeader`                  |
| `decor.hero-carousel`      | 复用已迁移能力；旧实现退休 | `FashionStoreDecorHero`               |
| `decor.journal`            | 视觉变体                   | `fashion-store.magazine`              |
| `decor.marquee`            | 视觉变体                   | `fashion-store.marquee`               |
| `decor.product-details`    | 复用                       | `FashionStoreProductPage`             |
| `decor.product-tabs`       | 唯一新增 Section           | `fashion-store.product-merchandising` |
| `decor.service-strip`      | 视觉变体                   | `fashion-store.services`              |
| `decor.shop`               | 复用                       | `FashionStoreCollectionPage`          |
| `decor-store.home`         | 参考证据；运行时退休       | Fashion unified Home                  |
| `decor-store.cart`         | 复用                       | `FashionStoreCartPage`                |
| `decor-store.checkout`     | 复用                       | `FashionStoreCheckoutPage`            |
| `decor-store.collection`   | 复用                       | `FashionStoreCollectionPage`          |
| `decor-store.content`      | 复用                       | Fashion content pages                 |
| `decor-store.product`      | 复用                       | `FashionStoreProductPage`             |

未注册的 `DecorFeature` 仅属于分类展示变体；`DecorLayeredHero` 随旧 Hero 退休。Decor Store 的
Home、SecondaryPage、SourceReplicaPage 和 shared 组件均已在可执行清单中逐文件处置，不把共享
外观误认为新的业务实现。

## 路由、fixture 与 runtime

- `decor:home` 和 `decor-store:home` 的可选择运行时入口最终退休；首页来源继续作为独立参考。
- `decor-store:shop-left`、`shop-none`、`shop-right`、`collection`、`product`、`wishlist`、`cart`、
  `checkout`、`account`、`blog`、`article`、`about`、`faq`、`contact` 全部映射至现有 Fashion 路由。
- 7 个 Decor fixture 文件逐项归入“参考保留”或“由 Fashion fixture 取代”。fixture 永远不成为
  live fallback，也不发送交易。
- 14 个 secondary fragment、索引、首页 source fragments 和 source-markup 归入参考证据；
  `revolution-loader.client.ts` 退休。参考文件在 U7 迁移前仍留在原路径，避免提前破坏比较工具。
- 次级来源页面的 cart quantity/remove、product gallery/options/quantity、wishlist、筛选、排序、
  分页、账户 tabs、FAQ accordion、About carousel 等交互全部归 Fashion 复用；inert 表单和静态
  map 只保留为来源证据，不会伪装成可提交功能。

## 来源区域与行为边界

| 来源区域              | 处置             | 行为所有者                                  |
| --------------------- | ---------------- | ------------------------------------------- |
| `header`              | Fashion 复用     | Fashion shell/navigation                    |
| `hero`                | Fashion 复用     | `FashionStoreDecorHero`                     |
| `featured-categories` | 视觉变体         | Fashion categories                          |
| `products`            | 唯一新增 Section | Fashion product merchandising + ProductCard |
| `promotional-marquee` | 视觉变体         | Fashion marquee                             |
| `collection-carousel` | 视觉变体         | Fashion collection carousel                 |
| `client-marquee`      | 视觉变体         | Fashion brand strip                         |
| `journal`             | 视觉变体         | Fashion editorial                           |
| `services`            | 视觉变体         | Fashion services                            |
| `footer`              | Fashion 复用     | Fashion shell/footer                        |
| `cookie`              | Fashion 复用     | Fashion shell cookie primitive              |
| `sticky`              | Fashion 复用     | Fashion shell sticky socials                |
| `scroll-progress`     | Fashion 复用     | Fashion shell scroll progress               |

首页的语言切换只保留为来源证据，不为统一主题新增无产品契约的语言状态。其余首页行为有明确
Fashion 所有者。次级行为通过“冻结页面 ID + 冻结行为类型”分类；未知页面或未知行为类型返回
未分类并导致测试失败，避免通配默认值吞掉新能力。

## 资源与可选择入口

| 资源组                        | 当前数量 | 处置                                                        |
| ----------------------------- | -------: | ----------------------------------------------------------- |
| `decor-presentation-images`   |       82 | 只有被批准变体实际引用的最小资产复制进 Fashion，并保留来源  |
| `decor-store-source-images`   |       94 | 参考证据；不得进入 Fashion runtime graph                    |
| `decor-store-placeholder`     |        1 | 参考证据                                                    |
| `decor-store-fonts`           |        9 | 参考证据；统一页面继续使用 Fashion 字体                     |
| `decor-store-runtime-styles`  |        8 | 退休；仅将最小、重写后的 Section scoped styles 归入 Fashion |
| `decor-store-runtime-scripts` |        8 | 全部退休；不迁移 jQuery、Revolution 或 DOM patches          |

当前可选择/构建表面冻结为：catalog 生成器及 API/Storefront 生成 catalog、experience registry
映射、fixture preview 准备、prerender route 解析、Storefront scripts、Nuxt Decor Store CSS
分支与 source-equivalence policy。U8 删除身份前必须逐项重扫；U1 不修改这些入口。

## Unified Home 固定信息架构

`fashion-store-home` 保留现有 instance ID 与 `fashion-store-home-binding`。其余 ID 是确定性新增的
固定 singleton；不支持任意插入、复制或嵌套。默认至少 Hero 和多个内容 Section 可见，因此不会
产生只有空 shell 的首页。

| 顺序 | 稳定 instance ID                           | Section 类型                          | 默认 | 必需 | Admin 名称 / 分组                 | 理由                                  |
| ---: | ------------------------------------------ | ------------------------------------- | ---- | ---- | --------------------------------- | ------------------------------------- |
|   10 | `fashion-store-home`                       | `fashion-store.hero`                  | 显示 | 是   | Hero / Foundation                 | 保留旧 ID 与 binding，承载已迁移 Hero |
|   20 | `fashion-store-home-services`              | `fashion-store.services`              | 显示 | 否   | Store services / Trust            | 顶部信任信息                          |
|   30 | `fashion-store-home-categories`            | `fashion-store.categories`            | 显示 | 否   | Shop by category / Discovery      | 主要分类入口与视觉变体                |
|   40 | `fashion-store-home-best-sellers`          | `fashion-store.products`              | 显示 | 否   | Best sellers / Merchandising      | 保留现有主商品网格                    |
|   50 | `fashion-store-home-promotion`             | `fashion-store.promotion`             | 显示 | 否   | Collection promotion / Campaigns  | 独立活动 CTA                          |
|   60 | `fashion-store-home-collection`            | `fashion-store.collection-feature`    | 显示 | 否   | Featured collection / Discovery   | 共用轮播与展示变体                    |
|   70 | `fashion-store-home-brands`                | `fashion-store.brand-strip`           | 显示 | 否   | Brand strip / Trust               | 品牌证明与可选运动呈现                |
|   80 | `fashion-store-home-featured-products`     | `fashion-store.products`              | 显示 | 否   | Featured products / Merchandising | 第二个既有商品区域                    |
|   90 | `fashion-store-home-marquee`               | `fashion-store.marquee`               | 显示 | 否   | Promotional marquee / Campaigns   | 共用运动能力                          |
|  100 | `fashion-store-home-magazine`              | `fashion-store.editorial`             | 显示 | 否   | Editorial stories / Content       | 共用内容卡片                          |
|  110 | `fashion-store-home-product-merchandising` | `fashion-store.product-merchandising` | 隐藏 | 否   | Product groups / Merchandising    | 唯一新增能力；批准后由运营选择启用    |

后续 migration 只能转换 overrides、保留 preset/binding ID，并把新增 singleton ID 确定性插入完整
reorder 操作；不得改写旧 draft 或假设跨 preset/binding migration。

## U1 产品确认点

产品于 2026-09-07 批准该收敛建议：六类受限视觉变体和一个默认隐藏的 Product groups Section；
不批准 Shop/Product Decor 路由变体，不迁移任何次级 Commerce 或内容副本，不重建 Hero。该选择
现已冻结为 U4/U5 的实现边界；后续单元只能实现或验证这份清单，不能自行扩大迁移范围。
