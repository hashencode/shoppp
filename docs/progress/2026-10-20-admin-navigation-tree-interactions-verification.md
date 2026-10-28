# Admin 导航树交互与确认流程验证

日期：2026-10-20。执行权威为 `docs/plans/2026-10-20-2145-refactor-admin-navigation-tree-interactions-plan.md`；本文件仅保留证据，不维护执行队列。

## 基线与边界

- 开始时独立合并修复已完成，`git diff --name-only --diff-filter=U` 为空；HEAD 为 `1c7ae747b24e7caf47ca584ffa861c937051296f`。
- 本轮修改前留存目标源码、完整 index diff 和七张 before 图片。截图完成后才修改业务源码；before manifest 中的七个图片 SHA256 均未改变。
- 复核使用修改前源码快照作为基线，不把已有 staged WIP 算作本轮改动。最终 index 与开始时的二进制 diff 相同。没有提交、推送、PR、部署或后台菜单写入。
- 真实开发入口为 `http://127.0.0.1:3418/storefront/navigation`。当前真实菜单为空；可比较截图使用真实 AppShell、页面、权限、主题及语言 provider，仅替换 Axios transport 为固定数据。

## 实现与合同证据

| 要求   | 实现及验证                                                                                                                                                 |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1     | 一个 Card；原生 Tabs 位于头部，保留当前菜单状态，移除重复标题；Browser Mode 检查 Card 数量和 tab 位置。                                                    |
| R2、R4 | placement 编辑器保持挂载；Header / Footer 草稿独立，节点切换保留整份 items；保存、重置和服务端新 ID 选择回归通过。实际截图切回 Header 后仍选中 `nav.new`。 |
| R3     | 原完整 PUT、权限、资源权限、expectedVersion 及同步写锁保留；导航页与树 focused 测试严格断言完整 items、目标及原因 payload。                                |
| R5、R6 | 左树拥有顶级新增、子项新增、移动和删除菜单、原生 Tree 拖拽；右侧只保留字段与选填备注。hover、选中及键盘焦点可见操作，长标签省略不覆盖按钮。                |
| R7     | 发布、归档在各自 Modal 中收集原因；trim 后 3–500 字符，确认时校验。取消清空、失败保留原因及错误、不自动重放冲突、busy 阻止关闭和重复请求均有测试。         |
| R8     | 两个业务区使用带 Tooltip 和可访问名称的图标按钮；只读搜索和展开可用，权限全选、半选与真实叶子 payload 不变。                                               |
| R9     | Admin 仅在权限区显示一次“只读”及简短说明；protected、self、越权及无 write 分支均保持原限制。720px Drawer 的保存、削减确认、关闭及列表刷新回归通过。        |
| R10    | 七组同条件真实浏览器截图及原图、manifest、对比页已交付，另有左树操作菜单近景。                                                                             |

## 验证结果（L2 + 目标 Browser Mode）

- Focused：导航页 24 项、树转换 8 项、IAM 51 项，共 **83 项通过**；局部简化后导航与树 **32 项再次通过**。
- Browser Mode：导航 Card / 树操作、宽窄容器状态保留、原因 Modal 与错误恢复、IAM Drawer，**4 项通过**。
- `bun run typecheck`：修正测试中误用 Playwright `exact` 选项后通过。
- Changed-file ESLint、Prettier、`git diff --check`：通过。
- `bun test tools/check-admin-i18n.test.ts`：**8 项通过**。目标文件的静态词条及动作分支、权限与资源类型目录共 236 次词条使用检查通过；补齐归档结果和候选失效说明的中文翻译。
- 不运行全应用测试、build 或 E2E：没有共享 recipe、权限基础设施、contracts 或后端改动。
- 实际 3418 开发页刷新后完成烟测：Card 头部菜单 Tabs、真实空菜单、左侧新增与禁用的展开／收起按钮均正确；没有常驻状态原因输入。额外截图为 `actual-app-smoke.jpg`。截图专用预览进程已停止。

### 失败检查及修复

- 两项布局／发布入口特征测试在改动前按预期失败，随后通过。
- JSDOM 没有真实 CSS 动画收尾，关闭 Modal 的断言曾失败；仅在本组 focused 测试 provider 中关闭 motion。真实 Browser Mode 保留动画，验证关闭、Esc、焦点恢复和失败恢复。
- Browser Mode 曾在 loading 退出动画期间按精确名称定位确认按钮超时。改用项目现有的可选 `loading` 图标名称匹配，等待 Modal 可见且焦点进入后操作；没有强制点击或绕过 disabled。隐藏 Modal 不再随普通草稿保存显示 loading。

### 真实指针拖拽

在隔离 fixture 中使用浏览器原生指针 `drag`，没有合成 drop 事件或调用页面内部状态：

1. 商品父项从首页之后拖到首页之前，观察顺序为商品、全部商品、新品、热销商品、首页、关于我们；三个子项仍为一级缩进。
2. 新品从商品下提升到首页之后的根级。
3. 再将新品拖入首页，观察路径变为“首页 / 新品”且缩进为一级。

全部操作只改变浏览器内草稿；没有保存、发布或归档。非法三级、后代、自身落点由同一生产转换函数的 focused 测试覆盖。最后重载 fixture 恢复原始数据。

## 简化与代码复核

按根 AGENTS 的 Task 映射在主线程顺序应用 ce-simplify-code 与 ce-code-review 检查项，没有派发子代理或独立跨模型审查。

简化包括复用同一位置归一函数、避免仅判断子项存在时重复排序、将旧删除按钮 ref 更名为当前节点动作 ref。证明合同的测试全部保留。

### Actionable Findings

没有剩余需要处理的发现。检查中定位并修复的翻译缺项、测试 API 误用和 loading 定位问题已由上述检查验证。

### Coverage

对本轮源码快照差异顺序检查正确性、权限与输入、错误恢复及同步锁、结构与复用、测试可信度、项目规范和交互组合边界。额外核对最多两级、整棵父子树保留、完整 payload、Modal 原版本绑定及 Drawer 兼容。范围不含其他暂存改动，也没有把同线程复核描述为独立审查。

### Verdict

本地验收条件满足，无阻断项。验证使用 transport fixture，不证明真实后台发布或归档成功；本轮没有执行这些后台动作。

## 截图与复现资料

持久化目录：`/Users/studio/.codex/visualizations/2026/10/11/01a12af4-21cd-7df1-bdc4-47f27f0b26fe/navigation-comparison/`。

- `comparison.html`、`comparison.md`：七组前后对比及原图入口。
- `before-manifest.json`、`after-manifest.json`：源码／图片 SHA256、版本、语言、主题和视口；所有配对尺寸一致。
- `fixture-source.tsx`、`baseline-sources.tar.gz`：固定 transport 数据与修改前目标源码。
- 桌面 1440 × 1050；窄屏 390 × 844；中文、浅色、同一权限。Header v7 选中新品，Footer v4 选中联系我们；Admin 全部 39 权限，只读。
- after 采集恢复到与 before 一样的后台标签页方式，避免原生 Chrome 前台窗口将截图裁为 861px 高；采集前核对侧栏／Drawer 动画稳定，所有 before 原图保持不变。

本轮终端详细记录保留在 `/private/tmp/shoppp-navigation-interactions-tlz315rm/`；关键结果已在此留存，不依赖临时日志作为完成权威。
