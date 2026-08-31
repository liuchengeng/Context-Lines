# Architecture

工具栏点击是唯一的捕获启动入口。后台 Service Worker 获取当前标签页的媒体流 ID，离屏页面消费该 ID，并把声音重新连接到输出，保证视频仍可听。离屏页面将单声道 PCM 保存在 12 秒固定大小循环缓冲区，不写入存储。

`Alt+Q` 触发后，后台将最新 10 秒降采样到 16 kHz WAV，并通过 `chrome.scripting` 把隔离的 Shadow DOM 卡片挂到当前全屏元素或页面根元素。它不暂停视频、不创建窗口、不改变焦点。mock 模式直接返回固定答案；真实模式调用 Worker。再次按 `Alt+Q` 或点击关闭按钮会移除卡片，已取消请求不会重新显示。

Worker 校验固定扩展来源、共享访问令牌和 Zod 请求。它先调用 Qwen OpenAI-compatible ASR，再把转写交给 DeepSeek V4 Flash 非思考模式，强制 JSON 输出并再次通过 Zod。模型输出只会更新当前仍存在的卡片。

公开接口只有 `GET /health` 和 `POST /v1/quick-ask`。浏览器不发送完整 URL、正文或历史，只发送用户触发的短音频、页面标题和 origin。
