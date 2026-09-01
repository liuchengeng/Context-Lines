# Distribution Preflight

当前版本面向个人加载的未打包扩展，必须先部署个人 Cloudflare Worker，并创建绑定为 `VOCAB_DB` 的 D1 数据库。豆包和 DeepSeek 密钥只能放在 Worker Secrets 中；扩展只保存 Worker 地址和随机连接口令。远程 D1 创建、迁移和 Worker 部署都需要项目所有者明确执行。分发给其他用户前，必须重新设计多用户认证与词单隔离，不得共用个人连接口令、模型密钥或 D1 词单。
