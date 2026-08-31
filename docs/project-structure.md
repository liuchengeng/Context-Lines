# Project Structure

| Path                 | Role                                          |
| -------------------- | --------------------------------------------- |
| `apps/extension`     | WXT Chrome 扩展、离屏音频和页内解释卡片       |
| `apps/api`           | Hono Cloudflare Worker、Qwen 和 DeepSeek 调用 |
| `packages/contracts` | 请求、响应、错误和 UI 状态 Zod 契约           |
| `docs`               | 产品、架构和部署说明                          |

`.output`、`dist`、`.wrangler`、本地环境文件和所有密钥均不提交。
