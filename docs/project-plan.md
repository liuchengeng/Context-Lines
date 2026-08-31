# ContextLines Project Plan

## Current Objective

- Outcome: 生成可部署、可打包但未上线的 Chrome-first MVP 仓库与扩展安装包。
- Completion evidence: 标准检查通过，合成数据集为 100 条，数据库与浏览器流程可复现，独立只读审查返回 `pass` 或给出已处理的阻塞项。

## Current State

- Phase: Capture vertical slice。
- Working end-to-end: workspace 安装、共享契约、Worker `/health`、Side Panel 壳、类型检查、测试与生产构建。
- Incomplete or unverified: 捕获、Realtime、分析、OAuth、云端收藏、复习、真实 RLS 和部署前核对均未完成。

## Milestones

| Milestone              | Outcome                                           | Status   | Evidence           |
| ---------------------- | ------------------------------------------------- | -------- | ------------------ |
| Baseline               | workspace、文档、设计规则、构建和类型检查一致     | complete | 本地基线门禁与提交 |
| Capture vertical slice | 标签页音频捕获、回放、partial/final 与清理        | planned  | 待验证             |
| Analysis and Study     | 点句快速/深入分析、缓存和 schema 防线             | planned  | 待验证             |
| Cloud and Review       | OAuth、RLS、收藏、三卡和 FSRS                     | planned  | 待验证             |
| Quality gate           | 自动测试、Chrome 流程、100 条评测、打包和独立审查 | planned  | 待验证             |
| Deployment preflight   | 远程配置与验证清单，停止等待授权                  | planned  | 待输出             |

## Active Work

- Now: 实现捕获转写纵切。
- Next: 实现点句分析与学习，再实现云端收藏和复习。
- Deferred: 真实 Supabase/Cloudflare/OpenAI 验收与所有远程操作。

## Blockers And Decisions

| Item                                        | Why it matters                         | Needed decision or evidence              |
| ------------------------------------------- | -------------------------------------- | ---------------------------------------- |
| 远程凭证缺失                                | 无法真实验证 OAuth、RLS、OpenAI 或部署 | 部署前由用户安全配置并授权               |
| Docker/CLI 缺失                             | 本轮不能用本地 Supabase 栈             | 使用 PGlite 验证 SQL；RLS 留待预发布复验 |
| WXT CLI 在当前 pnpm dlx 环境缺少 tinyglobby | 官方生成器无法直接运行                 | 使用等价手工骨架并由实际构建验证         |
