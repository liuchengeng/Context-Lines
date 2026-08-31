# Project Structure

| Path                 | Role                                                       |
| -------------------- | ---------------------------------------------------------- |
| `apps/extension`     | WXT Chrome 扩展、设置页、离屏音频、Provider 和页内解释卡片 |
| `apps/relay`         | Cloudflare Worker，豆包 WebSocket 鉴权中转与 DeepSeek 调用 |
| `packages/contracts` | 解释响应等 Zod 契约                                        |
| `docs`               | 产品、架构和质量说明                                       |

`.output`、`dist`、`.wrangler`、本地环境文件和密钥均不提交。
