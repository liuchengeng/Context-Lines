import {
  DeepAnalysisSchema,
  QuickAnalysisSchema,
  WorkerErrorSchema,
  type AnalysisProvider,
  type ClassifiedText,
  type DeepAnalysis,
  type QuickAnalysis,
  type TranscriptContext,
} from "@contextlines/contracts";
import type { z } from "zod";

interface WorkerAnalysisProviderOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  fetcher?: typeof fetch;
}

export class WorkerAnalysisProvider implements AnalysisProvider {
  readonly #baseUrl: string;
  readonly #getAccessToken: () => Promise<string | null>;
  readonly #fetcher: typeof fetch;

  constructor(options: WorkerAnalysisProviderOptions) {
    this.#baseUrl = options.baseUrl.replace(/\/$/, "");
    this.#getAccessToken = options.getAccessToken;
    this.#fetcher = options.fetcher ?? fetch;
  }

  quick(context: TranscriptContext): Promise<QuickAnalysis> {
    return this.#post("/v1/analysis/quick", { context }, QuickAnalysisSchema);
  }

  deep(
    context: TranscriptContext,
    quick: QuickAnalysis,
  ): Promise<DeepAnalysis> {
    return this.#post(
      "/v1/analysis/deep",
      { context, quick },
      DeepAnalysisSchema,
    );
  }

  async #post<TSchema extends z.ZodType>(
    path: string,
    body: unknown,
    schema: TSchema,
  ): Promise<z.infer<TSchema>> {
    const token = await this.#getAccessToken();
    if (!token) throw new Error("请先使用允许的 Google 邮箱登录。");

    let response: Response;
    try {
      response = await this.#fetcher(`${this.#baseUrl}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new Error("无法连接 ContextLines 分析服务。");
    }

    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const parsedError = WorkerErrorSchema.safeParse(data);
      throw new Error(
        parsedError.success ? parsedError.data.message : "分析服务请求失败。",
      );
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new Error("分析服务返回了无效数据。");
    }
    return parsed.data;
  }
}

const languageNote = (text: string, confidence = 0.94): ClassifiedText => ({
  text,
  classification: "language_fact",
  confidence,
});

const sceneNote = (text: string, confidence = 0.76): ClassifiedText => ({
  text,
  classification: "scene_inference",
  confidence,
});

const mockEntries: Record<
  string,
  {
    natural: string;
    literal: string;
    intent: string;
    tone: string;
    chunk: string;
    meaning: string;
    usage: string;
  }
> = {
  "I wouldn't read too much into it.": {
    natural: "我觉得你别过度解读这件事。",
    literal: "我不会从这件事里读出太多含义。",
    intent: "劝对方降低解读强度，不要把一个信号看得过重。",
    tone: "委婉、降温，也可能带一点保留。",
    chunk: "read too much into it",
    meaning: "对某件事作过度解读",
    usage: "常用于提醒别人不要从一句话或一个动作推断太多。",
  },
  "She was just trying to keep the peace.": {
    natural: "她只是想息事宁人。",
    literal: "她只是在努力维持和平。",
    intent: "为她的做法解释动机，弱化责备。",
    tone: "解释性、带维护意味。",
    chunk: "keep the peace",
    meaning: "维持和气，避免冲突",
    usage: "用于人际冲突中某人试图让各方冷静或妥协。",
  },
  "That ship has sailed, honestly.": {
    natural: "说实话，那个机会已经错过了。",
    literal: "说实话，那艘船已经开走了。",
    intent: "指出某个选项已经不再现实，劝对方停止等待。",
    tone: "坦率、略显最终，也可能让人失望。",
    chunk: "that ship has sailed",
    meaning: "时机已过，机会已经错过",
    usage: "用于已经无法回到原方案或原机会的情形。",
  },
};

function mockEntry(transcript: string) {
  return (
    mockEntries[transcript] ?? {
      natural: `自然理解：${transcript}`,
      literal: `字面理解：${transcript}`,
      intent: "仅凭当前台词无法可靠判断完整意图。",
      tone: "语气需要更多前后文确认。",
      chunk: transcript.split(/[,.;!?]/)[0]?.trim() || transcript,
      meaning: "结合当前语境理解的表达块",
      usage: "请在更多真实场景中确认其搭配和语气。",
    }
  );
}

export class MockAnalysisProvider implements AnalysisProvider {
  async quick(context: TranscriptContext): Promise<QuickAnalysis> {
    const transcript = context.current.text;
    const entry = mockEntry(transcript);
    return QuickAnalysisSchema.parse({
      transcript,
      natural_zh: languageNote(entry.natural),
      literal_zh: languageNote(entry.literal),
      intent: sceneNote(entry.intent),
      tone: sceneNote(entry.tone),
      register: languageNote("自然日常口语，可用于非正式对话。", 0.86),
      chunks: [
        {
          text: entry.chunk,
          meaning_zh: languageNote(entry.meaning),
          usage_note: languageNote(entry.usage, 0.9),
        },
      ],
      confidence: context.next ? 0.94 : 0.86,
      scene_inference: [
        {
          ...sceneNote(
            context.next
              ? "结合后一句看，说话者正在为讨论降温或收束选择。"
              : "当前可能是在为讨论降温；需等待后文确认。",
            context.next ? 0.82 : 0.62,
          ),
          classification: "scene_inference",
        },
      ],
      insufficient_context: !context.next && context.previous.length === 0,
    });
  }

  async deep(
    context: TranscriptContext,
    quick: QuickAnalysis,
  ): Promise<DeepAnalysis> {
    const chunk = quick.chunks[0]?.text ?? context.current.text;
    return DeepAnalysisSchema.parse({
      transcript: context.current.text,
      implied_meaning: sceneNote(
        "表面上在陈述判断，实际功能是调整对方的期待和下一步行动。",
        0.8,
      ),
      pragmatic_function: languageNote(
        "通过较间接的表达完成劝阻、解释或结束某个话题。",
        0.88,
      ),
      usage_notes: [
        languageNote(`把 “${chunk}” 作为完整表达块记忆，不要逐词硬译。`),
        sceneNote("对方情绪强烈时，可先表示理解再使用，语气会更柔和。"),
      ],
      example_variants: [
        {
          english: `I think ${chunk} applies here.`,
          natural_zh: "我觉得这里可以用这个表达来概括。",
          context: sceneNote("适合练习表达块，但真实使用时应改成自然完整句。"),
        },
      ],
      inappropriate_contexts: [
        sceneNote(
          "需要给出正式承诺、法律结论或精确信息时，不应只用含蓄表达代替事实。",
        ),
      ],
      cultural_context: [],
      confidence: 0.86,
      insufficient_context: quick.insufficient_context,
    });
  }
}
