# ContextLines Architecture

## System Context

- Runtime: Chrome 116+ Manifest V3 Side Panel、Cloudflare Worker、Supabase Postgres/Auth、OpenAI Realtime/Responses。
- External actors: 单个允许邮箱用户、Google OAuth、OpenAI、Supabase、Cloudflare。
- Constraints: 音频由浏览器直连 OpenAI；ContextLines 不保存或代理音频；浏览器只动态注入 active tab。

## Entry Points

| Entry            | Caller or trigger  | Owned outcome                          |
| ---------------- | ------------------ | -------------------------------------- |
| Extension action | 用户点击扩展图标   | 打开 Side Panel                        |
| Start capture    | 用户点击“开始识别” | 捕获所选标签页音频并建立 Realtime 会话 |
| Overlay message  | Side Panel         | 更新 active tab 的 Shadow DOM 英文字幕 |
| Worker HTTP      | 已登录扩展         | 签发短期凭证或执行 schema 约束分析     |
| Review mode      | 用户               | 加载到期卡、揭示答案并记录 FSRS 自评   |

## Modules And Ownership

| Module                | Responsibility                              | State owned            | Public callers     |
| --------------------- | ------------------------------------------- | ---------------------- | ------------------ |
| `packages/contracts`  | Zod 契约、消息协议、Provider 接口           | 版本化 schema          | 扩展、Worker、测试 |
| `apps/extension`      | 授权、捕获、WebRTC、内存字幕、学习和复习 UI | 当前内存会话与 UI 状态 | Chrome 用户        |
| `apps/api`            | JWT/邮箱/CORS、OpenAI 代理、统一错误        | 请求级状态             | 已登录扩展         |
| `supabase/migrations` | 收藏、三卡、事件、约束、触发器和 RLS        | 持久学习数据           | Supabase           |
| `evals`               | 完全合成的质量用例和评测规则                | 非用户测试数据         | 测试命令           |

## Runtime And Data Flow

1. 用户动作触发 `chrome.tabCapture`；Side Panel 重连音频至 `AudioContext.destination`。
2. 扩展用 JWT 向 Worker 请求短期 Realtime 客户端凭证，再通过 WebRTC 将音轨直连 OpenAI。
3. `TranscriptAssembler` 在内存中归并乱序 partial/final，只保留有限上下文并同步英文浮层。
4. 点击 final 台词时，仅发送 previous 3、current、可选 next 1、页面 title 和 origin。
5. Worker 校验 JWT、允许邮箱、长度与模型输出 schema；扩展只渲染通过契约的数据。
6. 用户选择表达块并填写个人例句后写入 Supabase；数据库原子创建三类复习卡。

## Public Contracts And Integrations

| Boundary         | Contract                                                                           | Failure behavior                                              |
| ---------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Worker           | `/health`, `/v1/realtime/client-secret`, `/v1/analysis/quick`, `/v1/analysis/deep` | `{code,message,request_id,retryable}`，不泄漏提示词或上游响应 |
| Browser messages | `packages/contracts` 中的判别联合                                                  | 未识别消息被拒绝                                              |
| OpenAI           | 模型 ID 只来自 Worker 环境变量                                                     | 缺失配置即失败，不隐式回退                                    |
| Supabase         | migration SQL + RLS                                                                | `auth.uid()` 不匹配时拒绝                                     |

## Cross-Cutting Constraints

- Security/privacy: 永久 OpenAI key 只在 Worker secret；CORS 只允许固定扩展 ID；不发送完整 URL、页面正文或浏览历史。
- Reliability: 所有外部响应先过 Zod；分析以上下文指纹去重；后一句到达最多静默刷新一次快速分析。
- Cleanup: 来源切换、导航、Panel 关闭、标签页关闭、音轨结束或退出登录立即停止轨道、PeerConnection 和 AudioContext 并清空内存；捕获注册保存在 `chrome.storage.session`，MV3 worker 重启后仍可恢复生命周期监听。

## Validation And Release

- Focused: Vitest 单元/契约、PGlite migration、Playwright Chrome 流程。
- Standard: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`。
- Packaging: WXT zip 产物，仅本地生成。
- Deployment: 本轮禁止；预检后等待授权。
- Rollback: Git 基线提交与分阶段本地提交。

## Current Architecture Decisions

| Decision                             | Reason                  | Consequence                             |
| ------------------------------------ | ----------------------- | --------------------------------------- |
| Side Panel 持有媒体与 PeerConnection | 用户可见且生命周期明确  | Panel 关闭必须清理                      |
| activeTab 动态注入 Shadow DOM        | 最小权限且隔离样式      | 不支持受限 Chrome 页面                  |
| 音频直连 OpenAI                      | Worker 不接触音频       | 上游保留受 OpenAI 项目设置约束          |
| PGlite 测 SQL                        | 当前机器无 Docker       | 真实 Supabase RLS 留待预发布复验        |
| PKCE + `launchWebAuthFlow`           | OAuth 留在扩展身份边界  | 稳定扩展 ID 决定固定回调 URL            |
| 复习只经 `record_review` RPC         | 卡片与事件必须原子更新  | 客户端不能直接插入或更新卡片            |
| 双层单用户允许列表                   | Supabase 是数据权威边界 | Extension、Worker 与 RLS 都拒绝第二用户 |
| Auth 只用 `storage.session`          | 禁止持久 session        | 浏览器重启后需要重新登录                |

## Open Technical Questions

- 部署前需用真实扩展公钥确认稳定 ID 与 Google OAuth 回调 URL。
- 真实 Realtime/Responses 请求需在获得测试密钥后复验上游配额、保留和错误形态。
