# Architecture

工具栏点击是捕获启动入口。后台 Service Worker 获取当前标签页媒体流 ID，离屏页面消费该 ID并把声音重新连接到输出。离屏页面只将单声道 PCM 保存在 12 秒固定大小循环缓冲区。

首次使用时，设置页只把个人 Worker 地址和随机连接口令写入 `chrome.storage.local`。豆包 APP ID、Access Token 和 DeepSeek API Key 仅保存在 Cloudflare Worker Secrets，不进入扩展存储或构建产物。

`Alt+Q` 将最新 10 秒降采样为 16 kHz WAV。扩展通过带随机子协议口令的 WebSocket 连接个人 Worker，Worker 在服务端加入豆包要求的鉴权头并双向转发二进制帧。识别完成后，扩展只把转写和页面标题发给 Worker，由 Worker 调用 DeepSeek V4 Flash 并校验 JSON 输出。Worker 和扩展都不保存音频或转写。结果通过 `chrome.scripting` 显示在当前全屏元素内，不暂停、不抢焦点。
