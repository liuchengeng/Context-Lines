# ContextLines

ContextLines 是面向单个允许邮箱的 Chrome 116+ 英语语境学习扩展。用户主动捕获普通网页标签页音频后可查看实时英文字幕，并在点击确认台词时按需生成翻译与语用解释；只有主动收藏的表达和复习进度会持久化。

## Quick Start

### Prerequisites

- Node.js 24+
- pnpm 11+
- Google Chrome 116+

### Install

```powershell
pnpm install
```

### Run

```powershell
pnpm dev
```

扩展开发构建位于 `apps/extension/.output/chrome-mv3`。在 `chrome://extensions` 开启开发者模式并加载该目录。未配置云端环境时，可通过 `.env.example` 中的显式 mock 开关运行本地合成流程；mock 不代表真实 OAuth、RLS 或 OpenAI 验收。

### Verification

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Configuration

项目只读取 [.env.example](./.env.example) 列出的变量。复制为本地 `.env` 或按各运行时的 secret 机制设置，禁止提交真实凭证。

## Project Documentation

- 产品范围：[docs/project-charter.md](./docs/project-charter.md)
- 当前计划：[docs/project-plan.md](./docs/project-plan.md)
- 技术架构：[docs/architecture.md](./docs/architecture.md)
- 仓库结构：[docs/project-structure.md](./docs/project-structure.md)
- UI 设计系统：[DESIGN.md](./DESIGN.md)
- Agent 规则：[AGENTS.md](./AGENTS.md)

## External Operations

本仓库不包含已创建的 Supabase 项目、Cloudflare Worker 或线上部署。应用迁移、设置 secrets、OAuth 配置、添加 Git remote、推送与发布必须另行核对并授权。
