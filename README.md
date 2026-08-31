# ContextLines Quick Ask

一个只做一件事的 Chrome 116+ 扩展：保留当前视频标签页最近约 10 秒的声音，按 `Alt+Q` 暂停视频并解释刚才听到的英语短语或俚语。

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
4. 视频自动暂停，小窗口显示 mock 解释；关闭窗口后继续播放。
5. 再次点击扩展图标即可停止监听。

如果快捷键无效，在 `chrome://extensions/shortcuts` 为 ContextLines Quick Ask 设置快捷键。

## 真实模型

Worker 的 `POST /v1/quick-ask` 先使用 Qwen ASR 转写 10 秒 WAV，再使用 DeepSeek 输出简短结构化解释。复制 `.env.example` 中的配置到本地环境；真实密钥不得提交。当前仓库只生成可部署代码，不创建或部署远程资源。

## 检查

```powershell
corepack pnpm format:check
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```
