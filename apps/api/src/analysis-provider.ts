import {
  DeepAnalysisSchema,
  QuickAnalysisSchema,
  type AnalysisProvider,
  type DeepAnalysis,
  type QuickAnalysis,
  type TranscriptContext,
} from "@contextlines/contracts";
import { z } from "zod";

import { HttpError } from "./http";
import { safetyIdentifier } from "./openai";

const QUICK_INSTRUCTIONS = `You analyze one English utterance for a Chinese-speaking learner.
Return only the requested schema. Translate naturally and literally, then explain intent, tone, register, useful expression chunks, and limited scene inferences.
Use only the supplied transcript window, page title, and origin. Never infer or name speaker identities. Never browse, cite, or claim that a film, historical, celebrity, meme, or pop-culture fact was verified.
Classify stable language meaning as language_fact, situational interpretation as scene_inference, and any claim depending on outside real-world knowledge as external_fact. An external_fact must explicitly say it was not verified online.
If context is weak or ambiguous, set insufficient_context=true, lower confidence, and describe alternatives instead of presenting a guess as fact.`;

const DEEP_INSTRUCTIONS = `You provide a deeper pragmatic explanation of one English utterance for a Chinese-speaking learner.
Return only the requested schema. Use the supplied transcript window and validated quick analysis. Explain implied meaning, pragmatic function, usage limits, example variants, and inappropriate contexts.
Never identify speakers or browse. Do not invent citations. Any film, history, celebrity, meme, or pop-culture claim that depends on outside knowledge must be classification=external_fact and explicitly say it was not verified online.
Keep language facts distinct from scene inference. If context is insufficient, state alternatives and reduce confidence.`;

interface OpenAIResponseShape {
  status?: string;
  output_text?: unknown;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: unknown;
    }>;
  }>;
}

function extractOutputText(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const response = value as OpenAIResponseShape;
  if (typeof response.output_text === "string") return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  return null;
}

export class OpenAIAnalysisProvider implements AnalysisProvider {
  constructor(
    private readonly env: Env,
    private readonly userId: string,
    private readonly requestId: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async quick(context: TranscriptContext): Promise<QuickAnalysis> {
    return this.#request({
      model: this.env.OPENAI_QUICK_ANALYSIS_MODEL,
      name: "contextlines_quick_analysis",
      schema: QuickAnalysisSchema,
      instructions: QUICK_INSTRUCTIONS,
      input: { context },
      maxOutputTokens: 1_800,
      reasoningEffort: "low",
    });
  }

  async deep(
    context: TranscriptContext,
    quick: QuickAnalysis,
  ): Promise<DeepAnalysis> {
    return this.#request({
      model: this.env.OPENAI_DEEP_ANALYSIS_MODEL,
      name: "contextlines_deep_analysis",
      schema: DeepAnalysisSchema,
      instructions: DEEP_INSTRUCTIONS,
      input: { context, quick },
      maxOutputTokens: 3_200,
      reasoningEffort: "medium",
    });
  }

  async #request<TSchema extends z.ZodType>(options: {
    model: string;
    name: string;
    schema: TSchema;
    instructions: string;
    input: unknown;
    maxOutputTokens: number;
    reasoningEffort: "low" | "medium";
  }): Promise<z.infer<TSchema>> {
    const model = options.model?.trim();
    const apiKey = this.env.OPENAI_API_KEY?.trim();
    if (!model || !apiKey) {
      throw new HttpError(
        500,
        "SERVER_MISCONFIGURED",
        "分析模型尚未配置。",
        false,
      );
    }

    let response: Response;
    try {
      response = await this.fetcher("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "OpenAI-Safety-Identifier": await safetyIdentifier(this.userId),
        },
        body: JSON.stringify({
          model,
          instructions: options.instructions,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: JSON.stringify(options.input),
                },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: options.name,
              schema: z.toJSONSchema(options.schema),
              strict: true,
            },
            verbosity: "low",
          },
          reasoning: { effort: options.reasoningEffort },
          max_output_tokens: options.maxOutputTokens,
          store: false,
        }),
      });
    } catch {
      throw new HttpError(
        503,
        "UPSTREAM_UNAVAILABLE",
        "分析服务暂时不可用。",
        true,
      );
    }

    if (!response.ok) {
      console.error(
        JSON.stringify({
          event: "openai_analysis_failed",
          request_id: this.requestId,
          upstream_status: response.status,
          analysis: options.name,
        }),
      );
      throw new HttpError(
        response.status === 429 ? 429 : 502,
        response.status === 429 ? "RATE_LIMITED" : "UPSTREAM_ERROR",
        response.status === 429
          ? "分析请求过于频繁，请稍后重试。"
          : "分析服务未能完成请求。",
        response.status === 429 || response.status >= 500,
      );
    }

    const upstream: unknown = await response.json().catch(() => null);
    const outputText = extractOutputText(upstream);
    if (!outputText) {
      throw new HttpError(
        502,
        "INVALID_MODEL_RESPONSE",
        "分析模型未返回可用结果。",
        true,
      );
    }

    let candidate: unknown;
    try {
      candidate = JSON.parse(outputText);
    } catch {
      throw new HttpError(
        502,
        "INVALID_MODEL_RESPONSE",
        "分析模型返回了无效 JSON。",
        true,
      );
    }

    const parsed = options.schema.safeParse(candidate);
    if (!parsed.success) {
      throw new HttpError(
        502,
        "INVALID_MODEL_RESPONSE",
        "分析模型返回了不符合契约的结果。",
        true,
      );
    }
    return parsed.data;
  }
}
