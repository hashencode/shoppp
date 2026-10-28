# 店铺资料基础表单标准化验证

对应独立计划：`docs/plans/2026-10-27-refactor-store-identity-standard-form-plan.md`。仅记录本轮证据，不接管主产品执行队列、REL-Pre-DC、DC/PG 或候选状态。

## 实现边界

`/settings/identity` 保留一级页 CustomPageRecipe，内部使用与基础表单模板同源的 compact 800px 内容宽度、用户对齐偏好、FormSubmitToolbar、FORM_ERROR_SCROLL_OPTIONS 和 QueryStateBlock。两张完整 Card 分别承载基本资料和品牌素材；备注归入基本资料，保存与确认重置固定于底部。

读取失败不再呈现可提交的空白表单；null 仍表示首次填写。保存成功反馈和新版本回填保留在本页。保存失败保留输入与 Theme 修复链接，并聚焦现有“重新加载”按钮，使页尾提交的失败提示可见；只有确认放弃本地修改后才重新读取。重置恢复最近读取或成功保存的数据，清除备注、校验、错误与媒体选择器临时状态。

API endpoint、expectedVersion/null 首次写入、六种素材字段、Logo variant 顺序、SEO 空值、reason、source=identity、权限与同步写锁均保留。未向真实服务保存测试资料。

## 定向验证（L2）

下列应用命令均在 `apps/admin` 执行；没有运行全量测试、构建、发布或 monorepo 检查。

| 检查                                                                           | 结果                                                                                                                                                                               |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run test src/pages/settings/store-identity-page.test.tsx`                 | 8/8：保存完整 payload、新来源版本、保存成功后重置、加载失败重试、无读权限、只读零写、必填错误关联、失败后保留输入及重置、pending 禁用媒体/重置与阻止重复写、首次 null-version 写入 |
| `bun run test:browser src/pages/settings/store-identity-page.browser.test.tsx` | 2/2：真实远程媒体搜索/选择/清空，800px 同宽同对齐、固定工具条、首错聚焦、语言切换不丢输入或额外读写、媒体重置、页尾保存失败恢复可见、取消/确认重新加载                             |
| Changed-file ESLint / Prettier                                                 | 页面、两份测试、translations 四个文件通过                                                                                                                                          |
| `bun run typecheck`                                                            | 通过；初次新增测试误用 Testing Library 不支持的 `exact` 选项已修正                                                                                                                 |
| 页面定向 i18n 扫描                                                             | 复用 `tools/check-admin-i18n.ts` 的 scanTranslationCalls/checkMessages：34 处调用，0 缺失/空翻译/占位符问题，0 未解析动态调用                                                      |

先增强既有重置用例，确认实施前缺少 Reset changes 的预期失败，再实现。收尾审查复现页尾失败后恢复按钮未获焦点，补充局部 ref/effect 后对应浏览器用例转绿。浏览器测试对重新加载确认框按其内容定位，避免与仍在退出动画中的重置确认框混淆。没有通过弱化业务断言处理这些失败。

ce-simplify-code 的复用、质量、效率、测试价值视角依仓库要求在主线程顺序执行；保留证明性测试，未发现需要额外简化的问题。ce-code-review 完成 lite receipt，1 项 P2 可见性建议已在主线程应用并验证，未留待办。审查仅覆盖本轮源文件差异；没有独立模型审查或对先前角色/导航改动作扩大声明。

## 真实页面与截图

截图入口为已运行的 `http://127.0.0.1:3418/settings/identity`，中文、浅色、同一权限与真实空资料状态。修改前先拍摄；修改后匹配桌面 1440×1050 首屏/页尾及 390×844 窄屏首屏，另外保留窄屏页尾和必填校验示例。未注入展示数据或改写页面 DOM。

实际测量：桌面两张 Card body 均为 800px，left 均为 432px；固定栏底部 1050px、左侧避让 224px。窄屏 Card body 为 230px；main clientWidth/scrollWidth 均为 280px；固定栏底部 844px、左侧避让 80px。桌面和窄屏最后的素材字段与说明都在工具条上方，且有完整滚动留白。真实空表单提交时，店铺名称与主标志显示中文必填错误，焦点位于 storefrontName，随后使用确认重置清理本地状态。

持久本地证据目录：

`/Users/studio/.codex/visualizations/2026/10/11/01a12af4-21cd-7df1-bdc4-47f27f0b26fe/store-identity-standardization-20261027/`

- `comparison.md` / `comparison.html`：三组前后图及校验示例。
- `manifest.json` / `layout-checks.json`：视口、源文件 SHA-256 与布局实测。
- `sources-before/` / `sources-after/`：本轮四个源文件快照。
- `verification/`：红绿测试、类型/质量/i18n 输出与审查 receipt、后续修复说明。

保留原有 staged 和 unstaged WIP；最终 cached binary diff 与修改前快照完全一致，无 unmerged 文件。未创建 worktree、提交、推送、PR、服务进程或部署。
