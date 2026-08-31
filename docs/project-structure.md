# ContextLines Project Structure

## Repository Map

| Path                   | Role                           | Policy                                 |
| ---------------------- | ------------------------------ | -------------------------------------- |
| `/apps/extension`      | WXT React Chrome 扩展          | tracked；`.output` generated/ignored   |
| `/apps/api`            | Hono Cloudflare Worker         | tracked；`.wrangler` generated/ignored |
| `/packages/contracts`  | Zod 类型、协议和 Provider 接口 | tracked；构建输出 ignored              |
| `/supabase/migrations` | 顺序 SQL migration             | tracked；禁止放凭证                    |
| `/evals`               | 100 条合成对话与评测工具       | tracked；结果输出 ignored              |
| `/tests/e2e`           | Playwright Chrome 扩展流程     | tracked；报告 ignored                  |
| `/docs`                | 项目事实文档                   | tracked                                |
| `/scripts`             | 仓库级验证和打包工具           | tracked                                |

## Placement Rules

| File role         | Place in                 | Do not place in        | Exception               |
| ----------------- | ------------------------ | ---------------------- | ----------------------- |
| 跨端 schema/消息  | `packages/contracts/src` | 扩展或 Worker 私有目录 | 单端内部状态可本地定义  |
| 扩展 UI/媒体/Auth | `apps/extension`         | Worker                 | 无                      |
| Server secret/API | `apps/api`               | 扩展                   | 无                      |
| 数据库行为        | `supabase/migrations`    | 应用启动脚本           | 测试 fixture 在测试目录 |
| 合成质量用例      | `evals`                  | 产品代码               | 无                      |

## Generated And Local Artifacts

| Artifact              | Produced by             | Location                                     | Git policy                    |
| --------------------- | ----------------------- | -------------------------------------------- | ----------------------------- |
| Chrome unpacked build | WXT                     | `apps/extension/.output/chrome-mv3`          | ignored                       |
| Extension zip         | WXT                     | `apps/extension/.output/*.zip`               | ignored                       |
| Worker output         | Wrangler                | `apps/api/.wrangler`                         | ignored                       |
| Coverage/report       | Vitest/Playwright/evals | `coverage`, `playwright-report`, `artifacts` | ignored                       |
| Secrets/local config  | developer/runtime       | `.env*`, `.dev.vars`, key files              | ignored except `.env.example` |

## Structural Decisions

| Decision         | Reason                               | Affected paths                     |
| ---------------- | ------------------------------------ | ---------------------------------- |
| pnpm workspace   | 共享契约且保持运行时独立             | root manifests, `apps`, `packages` |
| 单一共享契约包   | 浏览器、Worker、SQL 测试使用相同边界 | `packages/contracts`               |
| 真实远程资源外置 | 本轮无部署授权                       | 仓库只保留声明与迁移               |

## Unresolved Placement Questions

- None.
