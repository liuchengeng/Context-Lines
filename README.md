# ContextLines Quick Ask

一个个人使用的 Chrome 116+ 扩展：在内存中保留当前视频最近约 10 秒声音，按 `Alt+Q` 后暂停当前视频，在本地裁掉首尾静音，再经个人 Cloudflare Worker 调用豆包流式语音识别小时版与 DeepSeek 中文解释。英文转写先显示，中文、单词和短语随后补充；可以手动把需要的词条收藏到个人词单。关闭解释后自动继续播放，不退出全屏，也不保存音频与转写历史。

## 使用前准备

- Node.js 24+ 与 Corepack
- 桌面版 Chrome 116+
- Cloudflare、豆包和 DeepSeek 账号

这是一个个人自托管项目。模型调用可能产生费用，具体以各服务商的计费规则为准。

## 本地开发

```powershell
git clone https://github.com/liuchengeng/contextlines.git
cd contextlines
corepack pnpm install
corepack pnpm dev
```

保持终端运行，在 `chrome://extensions` 开启开发者模式，加载仓库中的 `apps/extension/.output/chrome-mv3-dev`。

## 首次部署中转

部署会创建远程 Cloudflare Worker，必须由项目所有者明确执行。先登录：

```powershell
cd contextlines
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

创建只用于个人词单的 D1 数据库，并让 Wrangler 自动把 `VOCAB_DB` 绑定写入配置：

```powershell
corepack pnpm --filter @contextlines/relay exec wrangler d1 create contextlines-vocabulary --binding VOCAB_DB --update-config
corepack pnpm --filter @contextlines/relay exec wrangler d1 migrations apply VOCAB_DB --remote
```

第二条命令只创建词单表，不会写入任何词条。只有用户在解释卡中点击“收藏”后，所选英文、中文意思和单词或短语类型才会写入 D1。

最后部署：

```powershell
corepack pnpm --filter @contextlines/relay exec wrangler deploy
```

部署输出会给出 `https://...workers.dev` 地址。重新加载扩展，点击图标，在设置页只填 Worker 地址和随机连接口令。检查成功后回到视频，再点击扩展图标；绿色 `ON` 表示开始缓存最近音频。播放几秒后按 `Alt+Q`，视频会立即暂停并显示时间点；可以收藏解释中选出的单词和短语，也可以打开“我的词单”查看或删除。点击 `×` 或再按一次 `Alt+Q` 关闭解释并继续播放。

## 隐私边界

- Chrome 只保存 Worker 地址与随机连接口令。
- 豆包和 DeepSeek 密钥只存在于 Cloudflare Worker Secrets。
- 只有用户按 `Alt+Q` 后，最近音频中裁剪出的最多约 8 秒有效语音才经 Worker 转发给豆包。
- 只有豆包转写会发送给 DeepSeek，不发送页面标题或网址。
- 相同音频和转写只在扩展内存中短期缓存；停止监听、关闭标签页或导航后立即清空。
- Worker 的 D1 只保存用户主动收藏的英文词条、中文意思、类型和保存时间。
- Worker 不记录原始音频、完整转写、网页地址或浏览历史。

## 检查

```powershell
corepack pnpm format:check
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```
