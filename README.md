# ContextLines Quick Ask

一个只做一件事的 Chrome 116+ 扩展：保留当前视频标签页最近约 10 秒的声音，按 `Alt+Q` 在画面右上角解释刚才听到的英语短语或俚语。它不会暂停视频或退出全屏。

## 本地试用（不调用模型）

```powershell
cd D:\subtitle
$env:WXT_PUBLIC_USE_MOCKS="true"
corepack pnpm dev
```

保持终端运行。在 `chrome://extensions` 开启开发者模式，点击“加载已解压的扩展程序”，选择 `D:\subtitle\apps\extension\.output\chrome-mv3-dev`。如果之前加载过旧版，先移除旧版或改为这个新目录。

1. 打开普通网页视频并开始播放。
2. 点击扩展图标，角标显示 `ON`。
3. 播放至少一秒后按 `Alt+Q`。
4. 画面右上角显示 mock 解释；点 `×` 或再按一次 `Alt+Q` 关闭。
5. 再次点击扩展图标即可停止监听。

如果快捷键无效，在 `chrome://extensions/shortcuts` 为 ContextLines Quick Ask 设置快捷键。

## 真实模型

Worker 的 `POST /v1/quick-ask` 先使用豆包录音文件极速版识别 10 秒 WAV，再使用 DeepSeek 输出简短结构化解释。复制 `.env.example` 中的配置到本地环境；真实密钥不得提交。当前仓库只生成可部署代码，不创建或部署远程资源。

### 本地真实测试配置

创建 `D:\subtitle\apps\api\.dev.vars`，填入：

```env
ALLOWED_EXTENSION_ID=chrome扩展页面显示的ID
QUICK_ASK_ACCESS_TOKEN=自己生成的随机长字符串
DOUBAO_ASR_URL=https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash
DOUBAO_ASR_RESOURCE_ID=volc.bigasr.auc_turbo
DOUBAO_ASR_MODEL=bigmodel
DOUBAO_API_KEY=新版豆包语音控制台的AppKey
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_API_KEY=你的DeepSeek密钥
```

旧版豆包语音控制台不填写 `DOUBAO_API_KEY`，改填 `DOUBAO_APP_KEY` 和 `DOUBAO_ACCESS_KEY`。

再创建 `D:\subtitle\apps\extension\.env.local`：

```env
WXT_PUBLIC_USE_MOCKS=false
WXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8787
WXT_PUBLIC_QUICK_ASK_ACCESS_TOKEN=与Worker完全相同的随机长字符串
```

分别在两个 PowerShell 窗口运行 `corepack pnpm dev:api` 和 `corepack pnpm dev`。密钥文件已被 Git 忽略，不要把内容发到聊天中。

## 检查

```powershell
corepack pnpm format:check
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```
