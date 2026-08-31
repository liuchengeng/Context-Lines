# ContextLines Project Charter

## Purpose

- Problem: 英语学习者在真实网页音频中能看懂字面意思，却常错过语气、意图、表达块和适用场景。
- Intended user: 一个通过 Google 登录且邮箱与 Worker 允许列表匹配的个人用户。
- Useful outcome: 在不中断网页声音的前提下获得实时英文字幕，主动点句分析、收藏带个人例句的表达，并用三类卡片复习。

## Core Workflow

1. 用户打开普通 HTTP/HTTPS 标签页，通过扩展 Side Panel 点击“开始识别”。
2. Chrome 明确让用户选择捕获来源；扩展仅在内存中处理字幕并保持原标签页声音播放。
3. 用户点击确认台词后才请求快速分析，可再请求深入解释。
4. 用户选择表达块并填写个人例句后保存，系统创建三张复习卡并按自评更新 FSRS 进度。

## In Scope

- Chrome 桌面版 116+，普通 HTTP/HTTPS 标签页，英文实时转写。
- partial/final 字幕、点句翻译和语用分析、表达收藏、个人例句、三类复习卡。
- Google OAuth、单邮箱限制、Supabase RLS、Cloudflare Worker、OpenAI Realtime 与 Responses API。
- 云端只保存主动收藏内容、复习卡和复习事件。

## Non-Goals

- 本地媒体、字幕导入、网站原生字幕抓取、系统音频、麦克风、说话人识别。
- 自动翻译、网页文化检索、播放控制、字幕下载、DRM 绕过和 Chrome Web Store 发布。
- 保存原始音频、完整转写、浏览历史或会话历史。
- 创建远程资源、应用迁移、部署、推送或发布。

## Quality Priorities

1. 隐私与授权边界清晰，捕获可立即停止且不持久化原始音频或完整转写。
2. 转写状态与语用分析可靠，无效模型输出绝不渲染或保存。
3. 320、400、600px Side Panel 上的核心流程紧凑、清晰、键盘可用。

## Product Decision Rules

| Decision area  | Current rule                               | Rationale              |
| -------------- | ------------------------------------------ | ---------------------- |
| Translation    | 仅点击 final 台词后生成                    | 避免噪声和无意数据发送 |
| Cultural facts | 标记“外部事实，未联网核实”                 | 首版不进行网页文化检索 |
| Identity       | 不猜测人物身份，不显示 Speaker A/B         | 无可靠说话人信息       |
| Saving         | 必须选择表达块并填写个人例句               | 收藏应可用于主动回忆   |
| Grading        | 用户揭示答案后以 Again/Hard/Good/Easy 自评 | 首版不调用 AI 评分     |

## Open Product Questions

- 真实账号配置后，允许邮箱、OAuth 品牌信息与上游数据保留策略需在部署前核对。
