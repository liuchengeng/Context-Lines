# ContextLines Quick Ask

一个个人使用的 Chrome 116+ 扩展：在内存中保留当前视频最近约 10 秒声音，按 `Alt+Q` 后暂停当前视频，在本地裁掉首尾静音，再经个人 Cloudflare Worker 调用豆包流式语音识别小时版与 DeepSeek 中文解释。英文转写先显示，中文和短语随后补充；关闭解释后自动继续播放，不退出全屏，也不保存音频与转写历史。

## 本地开发

```powershell
cd D:\subtitle
corepack pnpm dev
```

保持终端运行，在 `chrome://extensions` 开启开发者模式，加载 `D:\subtitle\apps\extension\.output\chrome-mv3-dev`。

## 首次部署中转

部署会创建远程 Cloudflare Worker，必须由项目所有者明确执行。先登录：

```powershell
cd D:\subtitle
corepack pnpm --filter @contextlines/relay exec wrangler login
```

生成一个随机连接口令，只显示一次并妥善保存：

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).TrimEnd('=').Replace('+','-').Replace('/','_')
```

依次写入四个 Worker Secrets。命令会在本机提示输入值，不要把值写进命令或聊天：

```powershell
corepack pnpm --filter @contextlines/relay exec wrangler secret put DOUBAO_APP_ID
corepack pnpm --filter @contextlines/relay exec wrangler secret put DOUBAO_ACCESS_TOKEN
corepack pnpm --filter @contextlines/relay exec wrangler secret put DEEPSEEK_API_KEY
corepack pnpm --filter @contextlines/relay exec wrangler secret put RELAY_TOKEN
```

其中 `RELAY_TOKEN` 填刚生成的随机口令。豆包使用流式语音识别大模型 2.0 小时版的 APP ID 与 Access Token，资源 ID 为 `volc.seedasr.sauc.duration`，Secret Key 不需要。

最后部署：

```powershell
corepack pnpm --filter @contextlines/relay exec wrangler deploy
```

部署输出会给出 `https://...workers.dev` 地址。重新加载扩展，点击图标，在设置页只填 Worker 地址和随机连接口令。检查成功后回到视频，再点击扩展图标；绿色 `ON` 表示开始缓存最近音频。播放几秒后按 `Alt+Q`，视频会立即暂停并显示时间点；点击 `×` 或再按一次 `Alt+Q` 关闭解释并继续播放。

## 隐私边界

- Chrome 只保存 Worker 地址与随机连接口令。
- 豆包和 DeepSeek 密钥只存在于 Cloudflare Worker Secrets。
- 只有用户按 `Alt+Q` 后，最近音频中裁剪出的最多约 8 秒有效语音才经 Worker 转发给豆包。
- 只有豆包转写会发送给 DeepSeek，不发送页面标题或网址。
- 相同音频和转写只在扩展内存中短期缓存；停止监听、关闭标签页或导航后立即清空。
- Worker 不写数据库，不记录原始音频或完整转写历史。

## 检查

```powershell
corepack pnpm format:check
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```
