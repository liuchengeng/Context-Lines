# Architecture

工具栏点击是捕获启动入口。后台 Service Worker 获取当前标签页媒体流 ID，离屏页面消费该 ID并把声音重新连接到输出。离屏页面只将单声道 PCM 保存在 12 秒固定大小循环缓冲区。

首次使用时，设置页只把个人 Worker 地址和随机连接口令写入 `chrome.storage.local`。豆包 APP ID、Access Token 和 DeepSeek API Key 仅保存在 Cloudflare Worker Secrets，不进入扩展存储或构建产物。

`Alt+Q` 先暂停页面中面积最大的可见视频并记录时间点，再从最新 10 秒中按本地音量裁掉首尾静音，最多保留约 8 秒并降采样为 16 kHz WAV。扩展通过带随机子协议口令的 WebSocket 连接个人 Worker，Worker 在服务端加入豆包 2.0 小时版资源 `volc.seedasr.sauc.duration` 要求的鉴权头并双向转发二进制帧。豆包返回后扩展立即显示英文，再只把转写发给 Worker；Worker 调用 DeepSeek V4 Flash 并校验 JSON 输出，随后补充整句中文和彩色短语。相同音频和转写在扩展内存中缓存两分钟、最多 12 条，停止监听或页面离开时清空。Worker 和扩展都不持久保存音频或转写。结果通过 `chrome.scripting` 显示在当前全屏元素内，不抢焦点；关闭解释时仅恢复由扩展暂停的视频。
