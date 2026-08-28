# Testing Standards

## 1. Goal
统一测试质量基线，确保新增页面测试具备可维护性、可回归性和生产可用性。

本文件是 `apps/admin` 子树内验证等级、升级条件和命令去重规则的唯一详细政策来源，只约束
Admin 应用，不改变 Shoppp 其他应用、packages 或仓库级发布流程。其他工作流、checklist 和
PR 模板只引用或投影本文件，不另建竞争口径。

## 2. Verification Levels (Mandatory)

执行任何 Admin 任务前，先按实际改动选择一个等级并记录理由；默认选择能够覆盖风险的最低等级。
下列命令默认从 `apps/admin` 执行；从仓库根目录执行时使用等价的
`bun run --cwd apps/admin <script>`。

| Level | 适用范围 | 必须验证 |
| --- | --- | --- |
| `L0` | 仅文档、注释、分析或不影响运行产物的说明变更 | 限定改动路径检查 diff、格式和交叉引用一致性；不运行测试、typecheck 或 build |
| `L1` | 局部非行为改动，例如样式、不被运行时/路由/权限/构建链消费的静态数据，或不改变业务分支的机械调整 | changed-file 质量检查；按风险做一次必要 smoke。可执行配置至少升到 `L2`；纯样式至少检查目标页面或组件，不默认扩大到整个 Admin 或 monorepo |
| `L2` | 普通局部行为变更、新页面或可由明确测试边界覆盖的旧页迁移 | focused tests + changed-file 质量检查；代码稳定后运行一次 `bun run typecheck`，或由包含同一类型检查的 build 替代 |
| `L3` | 共享组件、共享 hook、路由/权限基础设施或跨页面行为变更 | 先用 import/reference 搜索与 workspace/package dependency metadata 列出受影响 consumers 和 suites，再运行这些 focused tests；按真实浏览器风险补 Browser Mode/E2E，并在最后运行一次 `bun run typecheck` |
| `L4` | 发布收口、依赖或构建链升级、用户明确要求全量检查、无法用证据界定影响范围，或项目明确要求的批次/PR closeout | 全量 `bun run test`，以及对应环境的 `bun run build:test` 或 `bun run build:production`；按发布合同运行 Browser Mode/E2E。build 已包含 `tsc -b` 时不得另跑 `bun run typecheck` |

补充口径：

- `L3` 的受影响范围必须有证据：至少包含 `rg` import/reference 结果，并结合根
  `package.json` 的 workspaces、`apps/admin/package.json` 和相关 workspace package 的依赖关系，
  沿 barrel/re-export、路径别名和 workspace 依赖展开反向 consumer 闭包，再为每个 consumer
  映射对应 suite。只有无法据此界定 consumers 或 suites 时才升级为 `L4`。
- focused test 使用现有命令并限定文件或 suite，例如 `bun run test <test-file>`；不要为了
  “更保险”改成全量 `bun run test`。
- changed-file 质量检查可使用 `bunx eslint <changed-files>`、
  `bunx prettier --check <changed-files>` 或任务已有的更具体检查。`bun run lint` 会检查整个
  Admin，不应被误写成默认 changed-file gate。
- 同一代码状态下，等价检查只运行一次。较广检查已经覆盖较窄检查时，不再补跑较窄检查。
- `bun run build:test` 与 `bun run build:production` 都包含 `tsc -b`，可替代独立
  `bun run typecheck`。
- Admin 依赖 `@shoppp/contracts`；若改动触及 contracts 或其他 workspace package，必须按根级
  policy 运行 package 自身的 focused tests/typecheck，并按反向 consumer 关系扩大 Admin checks。
  Admin-local build 或 typecheck 不能替代 package 与根级发布门禁。
- 遇到与本次改动无关的既有失败时，记录命令、失败位置和隔离证据；不要无限重跑。若失败阻止
  判断本次改动是否正确，再升级范围或报告阻塞。

## 3. Test Layering (Mandatory)
1. Rstest + jsdom: 默认层，用于单元/组件测试与快速反馈。
2. Rstest Browser Mode: 用于真实浏览器行为验证，补齐 jsdom 盲区。
3. Playwright E2E: 用于关键业务链路的端到端冒烟验证，少而精。

## 4. Naming and Placement (Mandatory)
- Unit/Component: `src/**/*.test.ts(x)` 或 `src/**/*.spec.ts(x)`
- Browser Mode: `src/**/*.browser.test.ts(x)`
- E2E: `e2e/**/*.spec.ts`

推荐测试命名格式：
- `it('should <behavior> when <condition>')`

## 5. Minimum Coverage Checklist

### 5.1 List Page
- 首次加载成功渲染
- 筛选变更不自动请求，点击“查询”后请求
- 重置筛选恢复默认
- 新增/编辑/查看跳转正确
- 接口失败态（标题 + 描述 + 恢复动作）
- 空态提示与恢复动作
- 权限测试：无写权限用户不可见写操作
- 至少一个参数或数据边界场景

### 5.2 Form Page
- `add / modify / readonly` 三态
- 非法 `mode` 参数错误态
- `readonly` 提交阻断（UI 与行为都验证）
- 提交成功提示与跳转
- 提交失败提示
- 权限拒绝（403）
- 至少一个字段边界（空值/超长/非法类型）

### 5.3 Security Minimum Set
- 权限矩阵单测（角色到权限）
- 写操作权限阻断（入口与行为）
- 路由参数非法/缺失拦截
- HTTP 错误归一化（timeout/404/5xx/unknown）

## 6. Definition of Done (Testing)
- 已记录所选 `L0-L4`、选择依据、实际命令与结果，且该等级要求的检查通过
- 每个新增功能至少包含：
  - 1 个 happy path
  - 1 个 failure/edge path
- 不允许仅“渲染存在”断言，必须覆盖用户动作与结果
- 不要用页面主标题（如 route `title` 或页头文案）证明页面加载成功；优先断言业务内容、关键控件、表格列、空态/错误态标题或可执行恢复动作。
- 清理重复标题或调整页头来源时，必须同步更新旧的 `getByText('页面标题')` 断言，避免测试反向要求页面内容区保留重复主标题。
- 占位页面不得保留误导性通过测试

## 7. Browser Mode vs Playwright E2E Guidance
- Browser Mode 适用：真实 DOM/CSS/浏览器 API 行为验证。
- Playwright E2E 适用：登录、跨页面、权限链路、后端联动的完整旅程。
- 推荐比例：70% jsdom、20% Browser Mode、10% E2E。
- E2E 的关键业务链路、安全边界和发布门禁不得因采用比例验证而弱化；是否执行由变更风险、
  `L3/L4` 条件和明确的交付合同决定。

## 8. Workflow Rule (Mandatory)
在创建或修改测试文件前，必须先阅读本文件；若与历史做法冲突，以本文件为准。

## 9. Template Files
- 新页面单元/组件测试模板：`src/test/templates/new-page.test.template.tsx`
- Browser Mode 模板：`src/test/templates/new-page.browser.test.template.tsx`
- Playwright E2E 模板：`e2e/templates/new-flow.e2e.template.spec.ts`

## 10. E2E Password Sessions

- Admin 使用应用账号密码和服务端 `HttpOnly` 会话，并由 API 返回权威 `/admin/session`。
- 本地 UI E2E 可在 Playwright 路由层返回显式测试 session；不得写入 localStorage 或运行时 fallback。
- 密码、会话 cookie、激活/重置 token 和服务 Bearer 凭据不得写入 spec、docs、trace 或仓库文件。
- 真实人类账号与机器凭据证明由仓库根目录认证 E2E 和发布工作流执行；缺少环境凭据必须 fail closed。

## 11. Playwright Execution and Artifacts

- 无凭据公共入口冒烟：`bun run test:e2e -- e2e/scaffold-smoke.spec.ts`。
- 子路径冒烟：`PUBLIC_APP_BASE=/admin bun run test:e2e -- e2e/scaffold-smoke.spec.ts`。
- 仅校验用例发现：`bun run test:e2e -- --list`。
- 本地运行前先执行 `bun run build`；Playwright 只预览已构建候选，不启动 development/test dev 命令。连接已构建的外部候选时显式设置 `E2E_BASE_URL`。
- 禁止创建或提交登录 storage state；测试 session 必须由每个 spec 显式路由并随 context 销毁。
- `test-results/`、`playwright-report/`、`blob-report/` 可能包含页面截图、trace、请求数据或业务信息，均不得提交；应按最短必要周期保留并在共享前人工检查。
