# ContextLines Quick Ask

一个个人使用的 Chrome 116+ 扩展：在本机内存中保留当前视频最近约 10 秒声音，按 `Alt+Q` 后才调用豆包流式语音识别模型 2.0 小时版与 DeepSeek 中文解释。它不会暂停视频或退出全屏。

## 使用

```powershell
cd D:\subtitle
corepack pnpm dev
```

保持终端运行，在 `chrome://extensions` 开启开发者模式，加载 `D:\subtitle\apps\extension\.output\chrome-mv3-dev`。

1. 第一次点击扩展图标会打开设置页。
2. 填写豆包语音新版控制台 App Key 和 DeepSeek API Key，点击保存。
3. 回到视频，再点击扩展图标；绿色 `ON` 表示开始缓存最近音频。
4. 进入全屏，按 `Alt+Q`；解释显示在右上角。
5. 点击 `×` 或再次按 `Alt+Q` 关闭；再次点击扩展图标停止监听。

豆包账号需要开通流式语音识别模型 2.0 小时版资源 `volc.seedasr.sauc.duration`。这里的“小时版”按实际发送的音频时长计量，不是每次调用扣一整小时。如果快捷键无效，在 `chrome://extensions/shortcuts` 手动设置。

## 隐私与密钥

两个密钥保存在 `chrome.storage.local`，不会交给网页，也不会写入仓库；扩展后台会直接请求豆包和 DeepSeek。Chrome 本地扩展存储不是操作系统级加密保险库。卸载扩展会移除设置。

## 检查

```powershell
corepack pnpm format:check
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```
