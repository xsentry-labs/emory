import OpenAI from "openai";
import { config, requireOpenRouter } from "../config.js";
import type { ModelCallLog, ModelTier } from "../types.js";
import { estimateCostUsd } from "./pricing.js";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  requireOpenRouter();
  if (!client) {
    client = new OpenAI({
      apiKey: config.openrouterApiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": config.openrouterSiteUrl,
        "X-Title": config.openrouterSiteName,
      },
    });
  }
  return client;
}

export function modelForTier(tier: ModelTier): string {
  return config.models[tier];
}

export interface CompleteOptions {
  agent: string;
  tier: ModelTier;
  system: string;
  user: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  /** Called with a usage log entry after the call completes. Wire this to a run's cost tracker. */
  onUsage?: (log: ModelCallLog) => void;
}

/**
 * A single non-streaming chat completion through OpenRouter. Every LLM call
 * in this system funnels through here so model routing and cost logging stay
 * in one place.
 */
export async function complete(opts: CompleteOptions): Promise<string> {
  const model = modelForTier(opts.tier);
  const openai = getClient();

  const res = await openai.chat.completions.create({
    model,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 2000,
    response_format: opts.json ? { type: "json_object" } : undefined,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  });

  const content = res.choices[0]?.message?.content ?? "";
  const promptTokens = res.usage?.prompt_tokens ?? 0;
  const completionTokens = res.usage?.completion_tokens ?? 0;

  opts.onUsage?.({
    agent: opts.agent,
    tier: opts.tier,
    model,
    promptTokens,
    completionTokens,
    estUsd: estimateCostUsd(model, promptTokens, completionTokens),
    at: new Date().toISOString(),
  });

  return content;
}

/** Same as {@link complete}, but parses and returns JSON, retrying once on a parse failure. */
export async function completeJson<T>(opts: Omit<CompleteOptions, "json">): Promise<T> {
  const raw = await complete({ ...opts, json: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    const retry = await complete({
      ...opts,
      json: true,
      user: `${opts.user}\n\nYour previous reply was not valid JSON. Reply with ONLY a valid JSON object, no prose, no markdown fences.`,
    });
    return JSON.parse(retry) as T;
  }
}

export async function embed(texts: string[]): Promise<number[][]> {
  const openai = getClient();
  const res = await openai.embeddings.create({
    model: config.models.embed,
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}
