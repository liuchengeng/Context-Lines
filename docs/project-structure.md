# Project Structure

| Path                    | Role                                                               |
| ----------------------- | ------------------------------------------------------------------ |
| `apps/extension`        | WXT Chrome 扩展、设置页、词单页、离屏音频、Provider 和页内解释卡片 |
| `apps/relay`            | Cloudflare Worker，豆包 WebSocket、DeepSeek 与个人 D1 词单 API     |
| `apps/relay/migrations` | 个人 D1 词单的版本化 SQL 迁移                                      |
| `packages/contracts`    | 解释响应和词单数据的 Zod 契约                                      |
| `docs`                  | 产品、架构和质量说明                                               |

`.output`、`dist`、`.wrangler`、本地环境文件和密钥均不提交。
