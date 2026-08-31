# ContextLines Project Plan

## Current Objective

- Outcome: 生成可部署、可打包但未上线的 Chrome-first MVP 仓库与扩展安装包。
- Completion evidence: 标准检查通过，合成数据集为 100 条，数据库与浏览器流程可复现，独立只读审查返回 `pass` 或给出已处理的阻塞项。

## Current State

- Phase: Analysis and Study。
- Working end-to-end: workspace 基线；受限页检查、tabCapture 生命周期、音频回放、Realtime 短期凭证/WebRTC、乱序字幕组装、Shadow DOM 浮层和 mock Flow 流程已实现并通过自动检查。
- Incomplete or unverified: 官方 Chrome 151 自动加载 unpacked 扩展受限，真实标签页捕获/浮层仍需安装后复验；分析、OAuth、云端收藏、复习、真实 RLS 和部署前核对未完成。

## Milestones

| Milestone              | Outcome                                           | Status      | Evidence                                             |
| ---------------------- | ------------------------------------------------- | ----------- | ---------------------------------------------------- |
| Baseline               | workspace、文档、设计规则、构建和类型检查一致     | complete    | 本地基线门禁与提交                                   |
| Capture vertical slice | 标签页音频捕获、回放、partial/final 与清理        | implemented | 单测、构建、mock Chrome 渲染；真实安装流程待质量门禁 |
| Analysis and Study     | 点句快速/深入分析、缓存和 schema 防线             | planned     | 待验证                                               |
| Cloud and Review       | OAuth、RLS、收藏、三卡和 FSRS                     | planned     | 待验证                                               |
| Quality gate           | 自动测试、Chrome 流程、100 条评测、打包和独立审查 | planned     | 待验证                                               |
| Deployment preflight   | 远程配置与验证清单，停止等待授权                  | planned     | 待输出                                               |

## Active Work

- Now: 实现点句快速与深入分析、上下文去重和学习界面。
- Next: 实现 Google OAuth、云端收藏和复习。
- Deferred: 真实 Supabase/Cloudflare/OpenAI 验收与所有远程操作。

## Blockers And Decisions

| Item                                        | Why it matters                         | Needed decision or evidence              |
| ------------------------------------------- | -------------------------------------- | ---------------------------------------- |
| 远程凭证缺失                                | 无法真实验证 OAuth、RLS、OpenAI 或部署 | 部署前由用户安全配置并授权               |
| Docker/CLI 缺失                             | 本轮不能用本地 Supabase 栈             | 使用 PGlite 验证 SQL；RLS 留待预发布复验 |
| WXT CLI 在当前 pnpm dlx 环境缺少 tinyglobby | 官方生成器无法直接运行                 | 使用等价手工骨架并由实际构建验证         |
