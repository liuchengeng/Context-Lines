# ContextLines Evaluations

`src/dataset.ts` 在运行时产生恰好 100 条完全合成的对话用例，覆盖拒绝、讽刺、习语、潜台词、方言、职场、约会和流行文化提及。每条用例包含有限 `TranscriptContext`、通过正式契约的 quick/deep 参考输出，以及显式的人工复核状态。

运行：

```powershell
pnpm eval
```

自动门禁要求：100% 上下文与输出 schema 通过、每类至少 10 条、外部事实全部明确写明“未联网核实”、不得出现说话人标签或身份猜测。

## Human review gate

真实模型输出接入后，人工评审者必须逐条判断 `natural_zh` 与语用结论是否可接受，并记录严重误导。发布门槛为至少 90/100 可接受且严重误导为 0。当前仓库不伪造人工签字，因此数据中的 `humanReviewStatus` 保持 `pending`，直到获准的预发布 OpenAI 运行和人工复核完成。
