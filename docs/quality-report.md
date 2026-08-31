# ContextLines Quality Report

## Automated evidence

| Gate                        | Result | Evidence                                                      |
| --------------------------- | ------ | ------------------------------------------------------------- |
| Formatting and design rules | pass   | Prettier；DESIGN.md 为 0 error、0 warning                     |
| TypeScript                  | pass   | contracts、extension、Worker、evals 全部通过                  |
| Unit and contract tests     | pass   | 转写、上下文、分析、Auth mock、FSRS、API 错误与学习仓库       |
| Database                    | pass   | PGlite 验证迁移、约束、三卡触发器、乐观锁、事件与级联         |
| Browser mock flow           | pass   | Chrome 渠道完成捕获、点句、收藏、三卡、揭示、自评与清理       |
| Browser faults              | pass   | 权限拒绝、无音轨；单测覆盖断网、401、429、过期凭证、无效 JSON |
| Responsive UI               | pass   | 320、400、600px 无横向溢出，Flow/Study/Review 均已渲染检查    |
| Synthetic evals             | pass   | 100/100 schema；8 类各至少 10 条；外部事实无伪装为已核实      |
| Extension package           | pass   | WXT Chrome zip 已在本地生成                                   |

## Privacy checks

- 音轨停止后 `readyState` 为 `ended`，AudioContext、Realtime transport、字幕与来源状态均被清理。
- E2E 在停止会话后确认扩展持久存储不包含完整测试台词。
- schema 中不存在 session、audio、完整 transcript 或 browsing-history 持久化对象。
- Supabase migration 只创建 `saved_expressions`、`review_cards`、`review_events`；保存内容必须由用户明确选择表达块并填写包含该表达的个人例句。

## Environment-limited gates

| Gate                                | Current status             | Why                                                                                             |
| ----------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| Installed Chrome unpacked smoke     | pending manual rerun       | 当前 Chrome 151 忽略自动化 `--load-extension`，测试已保留为 `CONTEXTLINES_EXTENSION_E2E=1` 开关 |
| Real Google OAuth and allowed email | pending authorized staging | 本轮无 Supabase 项目、OAuth client 或稳定扩展 ID                                                |
| Real Supabase RLS                   | pending authorized staging | PGlite 验证 SQL 行为，但不能替代 Supabase Auth role 的真实验收                                  |
| Real OpenAI Realtime/Responses      | pending authorized staging | 本轮无获授权 secret，不发送真实音频或分析请求                                                   |
| Human quality review                | pending                    | 100 条数据已准备；不得伪造人工签字，发布门槛为至少 90/100 可接受且严重误导为 0                  |

这些项目是部署前外部验收项，不授权本轮创建资源、应用迁移或部署。
