# 按环境拆分后台开发配置

独立有界配置整理。沿用现有本地 Wrangler 与 Fashion staging 启动流程，不改变 REL/master、产品顺序、候选或部署状态。

## 范围与决策

- 用户明确要求提交仅用于本地开发的默认账号与密码；默认值放在仓库根目录 `.env.development`，移除 local 脚本中的默认邮箱。
- 保留当前自定义登录：把原 `.env` 中的本地账号与密码迁到被忽略的 `.env.development.local`，在启动时覆盖默认值。
- 把 Fashion staging 配置迁到被忽略的 `.env.test`，提交对应 `.env.test.example`；本地启动和 staging 启动分别显式读取自己的文件。
- 只对 `.env.development` 添加精确 Git 例外；个人覆盖、远程密码及其他真实凭据继续被忽略。
- 更新启动入口、配置边界测试和使用文档。不增加环境加载器、依赖、工作树或 PR。

## 执行检查点

- U1 配置拆分、当前凭据迁移及文档同步：Complete。
- U2 验证与提交准备：Complete。
- 当前单元：无；下一动作：无。执行正文完成并冻结，随本次修改本地提交。
- Tail owner：本独立修复；无产品主计划状态变化。

## 验证安排

L2：可执行的启动配置变更；运行 `tools/dev-admin-local.test.ts` 和 `tools/dev-admin.test.ts`，验证默认账号、缺失邮箱拒绝、可选覆盖和 staging preflight。检查修改文件的格式与 lint，运行一次 Admin typecheck 和 tools typecheck。迁移验证只报告键名与值是否一致，不输出个人凭据；确认提交集合不含忽略文件。

## 完成证据

- `bun test tools/dev-admin-local.test.ts tools/dev-admin.test.ts`：20 pass，0 fail。
- `bun run --cwd apps/admin typecheck` 与 `bun x --no-install tsc --noEmit -p tsconfig.tools.json`：通过。
- 修改的 TypeScript 文件 ESLint 与格式检查：通过；package JSON 格式和文档交叉引用检查通过。环境文件与 `.gitignore` 不受 Prettier 支持，按键名、文件边界和 `git diff --check` 检查。
- 原 `.env` 的两项本地凭据和四项 staging/preflight 配置原值迁移，旧文件移除相应键；现有本地配置解析成功且 API 指向 loopback，现有 staging 配置通过仓库绑定预检。
- 用独立 Bun 子进程确认无覆盖文件时默认账号有效，有覆盖文件时个人配置优先；额外验证父级 `bun run` 启动仍正确选择本地覆盖或 test 配置。
- Git 精确放行根目录 `.env.development`；`.env`、`.env.development.local`、`.env.test` 仍被忽略。提交只含开发默认值与模板，不含当前个人凭据。
- 范围审查：直接使用 Bun 现有环境文件读取能力，无新依赖或加载抽象，无远程数据、产品计划和部署状态变更。
