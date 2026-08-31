# ContextLines Deployment Preflight

本清单只描述待执行操作。当前未创建远程资源、未应用迁移、未设置 secret、未部署、未添加 Git remote，也未推送。

## 1. Stable Chrome identity

1. 生成并安全保存扩展私钥；只把公钥对应的 `WXT_PUBLIC_EXTENSION_KEY` 写入本地构建配置。
2. 构建后在 Chrome 中确认稳定 extension ID。
3. 记录固定回调：`https://<extension-id>.chromiumapp.org/auth-callback`。
4. 在普通 HTTP/HTTPS 音频标签页手动加载 unpacked 扩展，复验开始/停止、导航、关闭标签页和关闭 Side Panel 的清理。

## 2. Supabase target

待用户确认：organization、project name/ID、region、是否为全新空项目。

1. 创建或选择目标项目后记录 `SUPABASE_URL` 与公共 anon key。
2. 配置 Google provider；Google OAuth client 的授权回调使用 Supabase Auth callback。
3. 在 Supabase Auth redirect allow list 中加入稳定 Chromium callback。
4. 审查并应用 `supabase/migrations/202608310001_contextlines_learning.sql`。
5. 允许邮箱首次完成 Google Auth 后，从 Supabase Auth 用户列表核对其 UUID；由管理员将该 UUID 与邮箱写入 `public.allowed_users`。不要向客户端授予此表权限。
6. 将同一邮箱配置为扩展构建变量 `WXT_PUBLIC_ALLOWED_EMAIL` 和 Worker 变量 `ALLOWED_EMAIL`。
7. 用允许邮箱和第二个拒绝邮箱验证 Extension、Worker、RLS/RPC 三层登录边界。
8. 以两个真实 Auth 用户验证三张学习表的 RLS 隔离、触发器、`record_review` 原子更新和删除级联。

待应用迁移只有一项：`202608310001_contextlines_learning.sql`。执行前必须再次核对目标项目和备份/回滚策略。

## 3. Cloudflare Worker target

待用户确认：Cloudflare account ID、Worker 名称、workers.dev 或自定义域、环境名称。

普通变量：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `ALLOWED_EMAIL`
- `ALLOWED_EXTENSION_ID`
- `OPENAI_TRANSCRIPTION_MODEL`
- `OPENAI_QUICK_ANALYSIS_MODEL`
- `OPENAI_DEEP_ANALYSIS_MODEL`

扩展公开构建变量另包括 `WXT_PUBLIC_SUPABASE_URL`、`WXT_PUBLIC_SUPABASE_ANON_KEY`、`WXT_PUBLIC_ALLOWED_EMAIL`、`WXT_PUBLIC_API_BASE_URL` 和稳定 `WXT_PUBLIC_EXTENSION_KEY`。Auth 会话只保存在内存型 `chrome.storage.session`，浏览器重启后重新登录。

secret：

- `OPENAI_API_KEY`

部署前检查 `/health` 不泄漏配置，CORS 只接受 `chrome-extension://<id>`，401/403/429/5xx 均返回统一错误契约。

## 4. OpenAI project

1. 确认 Realtime transcription 与 Responses API 权限、预算和速率限制。
2. 核对项目数据保留设置与组织政策；向用户明确原始音频直达 OpenAI。
3. 使用环境变量中明确模型 ID，不允许代码回退。
4. 运行 100 条合成集的真实模型输出，并由人工逐条复核，要求至少 90/100 可接受且严重误导为 0。

## 5. Staging verification

```powershell
pnpm format:check
pnpm design:lint
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm eval
pnpm test:e2e
$env:CONTEXTLINES_EXTENSION_E2E='1'; pnpm test:e2e
pnpm build
pnpm --filter @contextlines/extension zip
```

随后在真实普通网页完成：捕获并保持原声、partial/final、点句 quick/deep、个人例句约束、三卡、跨会话恢复、Again/Hard/Good/Easy、标签页关闭/导航/Side Panel 关闭/退出登录清理，以及数据库和扩展存储隐私检查。

## Stop condition

到此停止。创建 Supabase/Cloudflare 资源、应用迁移、写入 secrets、部署 Worker、发布扩展或推送 Git 之前，必须由用户明确确认账号、目标项目、迁移和授权。
