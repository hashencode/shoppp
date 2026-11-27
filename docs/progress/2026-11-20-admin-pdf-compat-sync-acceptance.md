# Admin PDF 兼容构建同步验收

日期：2026-11-20。本地 L3 测试、构建、打包组件预览和小米真机检查通过；未推送或部署。

## 来源与范围

固定来源为 `codex-admin-quick-start@147b4e8f74d1de8cad39e3540baf31e190934a21`，仅采用其父基线 `5db82a029d059b8ff2fae919b29ee34a181b4baf` 到该提交的 PDF 能力差量；通过 `git show` 读取。Shoppp 仓库为 `https://github.com/hashencode/shoppp.git`，本地 `/Users/studio/Documents/GitHub/shoppp`；目标起点 `5ce6b154886612ede24cdab3df4d230649cd9143`，分支 `codex/upload-presentation-sync`，实施前 clean。

实现仅在 `apps/admin`：生产与 Browser Mode 精确将 pdfjs-dist 主入口解析为 legacy，保留同版本 legacy Worker；复制 CMap 到 `static/pdf-cmaps` 并按 `withAppBasePath` 访问。react-pdf 9.2.1、pdfjs-dist 4.8.69、依赖与锁文件不变。

保留本地 useI18n/useCurrentTranslate、open/lazy、主题、source/session、三级回退、下载鉴权、abort/revoke 和尺寸观察。直接消费者为 FilePreview、UploadFormItem；全 apps/packages import/reference 检索没有发现额外生产调用方。Catalog 仍使用其既有 FilePicker 通道，本次运行其最近消费者测试作为保护，不接入新的业务预览。API、storefront、contracts、权限与产品主计划不变。

## 检查结果

| 检查                 | 本仓结果                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 先复现兼容失败       | 生产改动前，新 Browser 回归在普通构建报 `Promise.withResolvers is not a function`                                        |
| 定向单元/消费者/i18n | FilePreview、视频加载失败、fallback、UploadFormItem、VideoPlayer、I18nContext、CatalogFormPage，7 suites / 70 tests 通过 |
| Browser Mode         | FilePreview、独立兼容绘制、UploadFormItem，3 suites / 10 tests 通过                                                      |
| 构建                 | 在 apps/admin 执行 `bun run build:test` 通过，包含 `tsc -b`                                                              |
| 打包组件预览         | 实际本地 Rsbuild 配置与共享源码，在 `/pdf-preview/` 子路径，Chromium 151 共 8 个场景通过                                 |
| 小米实体平板         | 中文实际绘制、关闭重开、六页 PDF 末页通过，未使用 iframe                                                                 |
| 质量与复核           | 修改代码 ESLint、Prettier、diff 检查通过；receipt `20261120-105539-2e7f5a56` 无 actionable findings                      |

Browser 与打包预览在首次 PDF 导入前移除 Promise.withResolvers 并禁用原生 PDF 查看器。打包预览覆盖中文与重开、六页末页、损坏文件的下载出口、1024×768/768×1024 与浅/深色。Worker 和两份所需 CMap 请求均 200，无页面异常或资源 4xx/5xx。Canvas 验收要求实际内容像素和大面积白色纸张，未将空白或黑画布当成成功。

实体设备为 Xiaomi Pad 8 / Android 16 / 澎湃 OS 3.0 / 自带浏览器 20.2.840330、Chromium 135；未改写设备能力，Promise.withResolvers 已存在，原生 PDF 查看能力为 false。中文与重开均有 33570 个深色内容像素，末页为 7344，CMap 请求均 200。人工查看中文及末页截图，确认文字清晰；像素断言不识别每个汉字字形。

独立验收入口位于仓库根目录忽略的 `.artifacts`，使用 app 内真实 Rsbuild 配置，仅替换 entry/output。首次临时入口构建因根目录无法解析 app 内的构建依赖失败；随后修正忽略入口的导入及 React/AntD 解析，不修改产品配置规避。错误恢复首张截图截在弹窗动画中；补充等待实际 opacity 后重录，最终 8 场景仍通过。上述 harness 问题不记作生产 PDF 缺陷，也不宣称首轮全绿。

## 证据与限制

日志、截图与临时入口均在已忽略的根目录 `.artifacts/screenshots/2026-11-20-pdf-compat-sync/`；不提交临时产物。

- [浏览器中文](../../.artifacts/screenshots/2026-11-20-pdf-compat-sync/1024-light-chinese.png)
- [竖屏末页](../../.artifacts/screenshots/2026-11-20-pdf-compat-sync/768-multipage-last.png)
- [损坏文件恢复](../../.artifacts/screenshots/2026-11-20-pdf-compat-sync/768-invalid.png)
- [小米中文](../../.artifacts/screenshots/2026-11-20-pdf-compat-sync/xiaomi-chinese.png)
- [小米末页](../../.artifacts/screenshots/2026-11-20-pdf-compat-sync/xiaomi-multipage-last.png)

已单独检查生产 diff 与实际预览文案：无新增或修改的产品字符串；损坏 PDF 沿用“PDF 预览加载失败”和“下载文件”，用于说明异常及提供恢复动作。保留既有翻译调用，没有把兼容引擎、CMap 路径等实现说明放进界面。

验收入口仅装配实际共享组件与合成 PDF，不代表已部署业务页面或真实后台附件鉴权联验。其他旧内核、全部 PDF 特性和线上发布不在本次已通过结论内。
