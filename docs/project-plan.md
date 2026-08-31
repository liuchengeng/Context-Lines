# ContextLines Project Plan

## Current Objective

- Outcome: 生成可部署、可打包但未上线的 Chrome-first MVP 仓库与扩展安装包。
- Completion evidence: 标准检查通过，合成数据集为 100 条，数据库与浏览器流程可复现，独立只读审查返回 `pass` 或给出已处理的阻塞项。

## Current State

- Phase: Independent review and deployment preflight。
- Working end-to-end: workspace 基线、捕获纵切、Study 分析、Google/Supabase OAuth 代码路径、表达收藏、数据库三卡触发器、FSRS 自评和 Review UI 均已实现；mock 浏览器流程与 PGlite 迁移测试通过。
- Incomplete or unverified: 官方 Chrome 151 自动加载 unpacked 扩展受限，真实标签页捕获/浮层仍需安装后复验；真实 OAuth、Supabase RLS、OpenAI 和部署前核对需在获准环境验证。

## Milestones

| Milestone              | Outcome                                           | Status      | Evidence                                             |
| ---------------------- | ------------------------------------------------- | ----------- | ---------------------------------------------------- |
| Baseline               | workspace、文档、设计规则、构建和类型检查一致     | complete    | 本地基线门禁与提交                                   |
| Capture vertical slice | 标签页音频捕获、回放、partial/final 与清理        | implemented | 单测、构建、mock Chrome 渲染；真实安装流程待质量门禁 |
| Analysis and Study     | 点句快速/深入分析、缓存和 schema 防线             | complete    | 19 项单元/契约测试、构建、320/400/600 Chrome 渲染    |
| Cloud and Review       | OAuth、RLS、收藏、三卡和 FSRS                     | implemented | PGlite 约束/RPC 测试；静音 mock 收藏与复习浏览器流程 |
| Quality gate           | 自动测试、Chrome 流程、100 条评测、打包和独立审查 | in progress | 自动门禁与打包完成；等待独立只读审查                 |
| Deployment preflight   | 远程配置与验证清单，停止等待授权                  | complete    | `docs/deployment-preflight.md`                       |

## Active Work

- Now: 由无构建上下文的独立代理复现质量证据并审查阻塞项。
- Next: 修复审查问题后重新跑标准门禁；随后停止等待远程授权。
- Deferred: 真实 Supabase/Cloudflare/OpenAI 验收与所有远程操作。

## Blockers And Decisions

| Item                                        | Why it matters                         | Needed decision or evidence              |
| ------------------------------------------- | -------------------------------------- | ---------------------------------------- |
| 远程凭证缺失                                | 无法真实验证 OAuth、RLS、OpenAI 或部署 | 部署前由用户安全配置并授权               |
| Docker/CLI 缺失                             | 本轮不能用本地 Supabase 栈             | 使用 PGlite 验证 SQL；RLS 留待预发布复验 |
| WXT CLI 在当前 pnpm dlx 环境缺少 tinyglobby | 官方生成器无法直接运行                 | 使用等价手工骨架并由实际构建验证         |
