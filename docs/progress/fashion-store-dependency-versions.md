# FS-R1 精确依赖版本与模块验证证据

记录日期：2026-09-03。治理来源：FS-R1 的 Q2、KTD2/KTD4/KTD5/KTD10/KTD12；执行状态仅由活动计划检查点维护。

本证据确认 `swiper@11.2.10` 和 `bootstrap@5.3.2` 可用于后续受控迁移。精确版本已写入 `apps/storefront/package.json` 与 `bun.lock`，不是范围版本。这里的模块验证没有交付轮播/灯箱组件，也不表示迁移单元或 R1 的全部浏览器目标已经验收。

## 来源与许可证

| 包 | 精确来源 | 许可证与版权 | 拟用入口 |
| --- | --- | --- | --- |
| Swiper 11.2.10 | [npm 元数据](https://registry.npmjs.org/swiper/11.2.10)、[npm tarball](https://registry.npmjs.org/swiper/-/swiper-11.2.10.tgz)、[上游仓库](https://github.com/nolimits4web/Swiper) | MIT；包内 LICENSE：Copyright (c) 2019 Vladimir Kharlampidi | `swiper/vue`、`swiper/modules`、`swiper/css` 及实际使用模块 CSS |
| Bootstrap 5.3.2 | [npm 元数据](https://registry.npmjs.org/bootstrap/5.3.2)、[npm tarball](https://registry.npmjs.org/bootstrap/-/bootstrap-5.3.2.tgz)、[上游仓库](https://github.com/twbs/bootstrap) | MIT；包内 LICENSE：Copyright (c) 2011–2023 The Bootstrap Authors | `bootstrap/js/dist/modal.js`，只在客户端导入；保留所需 Modal 样式 |

2026-09-03 核对 npm 元数据、解包内 `package.json`/`LICENSE` 与本地锁文件：

- Swiper integrity：`sha512-RMeVUUjTQH+6N3ckimK93oxz6Sn5la4aDlgPzB+rBrG/smPdCTicXyhxa+woIpopz+jewEloiEE3lKo1h9w2YQ==`。
- Bootstrap integrity：`sha512-D32nmNWiQHo94BKHLmOrdjlL05q1c8oxbtBphQFb9Z5to6eGRDCm0QgeaZ4zFBHzfg2++rqa2JkqCcxDy0sH0g==`。
- probe 使用的 Swiper Vue 文件与 Modal 文件均与安装目录逐字节相同。发布时保留许可证通知；不修改 Crafto 原始资产快照。

[Swiper 官方 Vue 文档](https://swiperjs.com/vue) 确认 Vue 适配、独立模块及独立 CSS 的入口模式；该网站当前展示较新的文档版本，所以本次导出与行为判断以 **11.2.10 包内代码和实测** 为准。[Bootstrap 浏览器文档](https://getbootstrap.com/docs/5.3/getting-started/browsers-devices/) 以当前稳定浏览器为一般支持声明，不能据此证明本产品全部历史浏览器/宿主组合。[Bootstrap Modal 文档](https://getbootstrap.com/docs/5.3/components/modal/) 给出普通 DOM、data API 触发和关闭契约。

## 验证环境与输入

- macOS 15.7.5（24G624）、Bun 1.3.5；复用仓库 Vue 3.5.40、Vite 8.1.5、Playwright 1.62.0。
- 临时 harness：`/tmp/shoppp-fs-r1-u1-version-probe`，服务仅 `127.0.0.1:3499`。SSR、客户端产物、原始浏览器结果均在该目录，没有修改 storefront generated 文件或部署。
- Vite production build 的目标固定为 `chrome111`、`edge111`、`firefox115`、`safari16.4`；编译目标不是运行时或 CSS 的全量兼容证明。
- Vue `createSSRApp` + `renderToString` 真实输出三张 slide、普通 DOM Modal 和 data API 触发按钮；客户端 hydration 使用同一个组件。
- Swiper 使用 Navigation、Pagination、Keyboard、A11y、Autoplay 独立模块，加载 core、navigation、pagination、a11y CSS。这里未启用自动播放；自动播放/手势/画廊同步的产品行为由具体迁移单元验证。
- Bootstrap Modal 在 `onMounted` 中动态导入；本临时 harness 为验证可视布局加载包内完整 Bootstrap CSS。**这不批准生产新增全量 Bootstrap CSS 入口**，生产样式仍按计划保留所需规则。

## 结果

| 验证 | 结果与边界 |
| --- | --- |
| Vue SSR | 通过，`window` 和 `document` 均为 `undefined`，输出含所有 slide 文本及 Modal 内容；SSR 构建成功 |
| 客户端构建 | 通过；Modal 为独立动态 chunk。此 probe 的包大小混入 Vue、验证页面和完整 Bootstrap CSS，不作为 R12 应用预算证据 |
| Bootstrap 无客户端边界导入 | 按预期复现 `ReferenceError: document is not defined`；不可在 SSR 路径顶层导入 |
| Chromium 151.0.7922.34 | 下述 7 组检查全部通过；零 pageerror、零 browser warning/error |
| Firefox 153.0 | 下述 7 组检查全部通过；零 pageerror、零 browser warning/error |
| WebKit 26.5 | 下述 7 组检查全部通过；零 pageerror、零 browser warning/error；不是 Safari 16.4 验收 |

每个引擎相同 1280 × 800 视口、相同 production 产物，验证：

1. Vue SSR hydration、Swiper 初始化、600px 宽度以及模块/核心 CSS 生效。
2. Navigation 按钮、键盘 ArrowRight 切换以及最后一张回到第一张。
3. Pagination 切换到指定真实 slide。
4. 标准 `data-bs-toggle="modal"` / `data-bs-target` 开启；库设置 `role="dialog"`、默认 Modal 焦点和 body scroll lock。
5. Escape 关闭；库按 data API 契约将焦点恢复到原触发按钮，清除 body scroll lock。
6. `data-bs-dismiss="modal"` 关闭、`aria-hidden` 恢复、焦点恢复、backdrop 清理。
7. 页面 reload 后重新初始化、打开仅有一份 backdrop，关闭后无 backdrop 残留。

复测命令（临时目录在本机保留期间）：`bun /tmp/shoppp-fs-r1-u1-version-probe/build.mjs`；在独立进程运行 `server.ts` 后运行 `browser.mjs`。原始结果：`/tmp/shoppp-fs-r1-u1-version-probe/results.json`。临时服务在验证后关闭。

## 已证实的边界与后续接入约束

- Modal 5.3.2 的 data API 入口在模块加载时访问 document，因此必须保留客户端导入边界。包内 `js/src/modal.js` 的 data API 点击处理器在 `hidden.bs.modal` 上注册可见触发器焦点恢复；直接程序化 `show()` 不等于已经接入这条恢复契约。后续组件沿用标准触发契约，不额外复制全局焦点协议。
- 临时手写 `h()` SSR harness 在开发态 Vue 服务端出现一次 `Slot "default" invoked outside of the render function` 警告；SSR 文本完整，production 浏览器 hydration 没有警告。它未证明生产 SFC 存在问题，也不能代替后续真实组件响应式更新的验证。
- 本次未验证历史 Chrome/Edge 111、Firefox 115、Safari/iOS/iPadOS 16.4、Android 真机/WebView 或微信宿主。它们继续作为实现目标，证据状态为“未验证”；按用户本次授权，缺失这些设备的补测不再阻塞本轮实施与完成。不将上述 Playwright 版本冒充历史版本、当前品牌稳定版或实际宿主。
- 页面组合中的拖拽、纵向滚动、reduced-motion、自动播放暂停、画廊/灯箱状态、路由卸载和真实服务流程仍由对应实施单元及 U11 的可用环境回归覆盖。这里不新增业务能力，不推进 DC/PG。
