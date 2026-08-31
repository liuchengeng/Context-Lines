# Architecture

工具栏点击是捕获启动入口。后台 Service Worker 获取当前标签页媒体流 ID，离屏页面消费该 ID并把声音重新连接到输出。离屏页面只将单声道 PCM 保存在 12 秒固定大小循环缓冲区。

首次使用时，设置页把豆包和 DeepSeek 密钥写入 `chrome.storage.local`。网页无法访问扩展存储。密钥不进入构建产物，但本地存储并非操作系统级加密。

`Alt+Q` 将最新 10 秒降采样为 16 kHz WAV。后台直接调用豆包录音文件极速版识别，再调用 DeepSeek V4 Flash JSON 输出；两个上游响应都经过 Zod。结果通过 `chrome.scripting` 显示在当前全屏元素内，不暂停、不抢焦点。
