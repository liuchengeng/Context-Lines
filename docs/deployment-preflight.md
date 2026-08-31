# Deployment Preflight

部署前需要：稳定 Chrome 扩展 ID、Cloudflare Worker 目标、DashScope API Key 与 Qwen ASR endpoint、DeepSeek API Key、随机共享访问令牌。

将服务端值设置为 Worker secrets/vars，将 API 地址和同一访问令牌用于私有扩展构建，核对 CORS 的扩展 ID，然后验证真实视频的捕获、10 秒转写、全屏内解释卡片、快捷关闭和无持久化记录。当前未执行任何远程操作。
