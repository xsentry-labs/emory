import OpenAI from "openai";
import { z } from "zod";

/**
 * Structured-output LLM calls through OpenRouter (OpenAI-compatible API), so
 * any OpenRouter model can be used. Everything that needs an LLM takes a
 * `StructuredLlm`, so tests pass a fake and the app degrades cleanly when no
 * API key is configured.
 */
export type StructuredLlm = <T extends z.ZodType>(req: {
  system: string;
  user: string;
  schema: T;
}) => Promise<z.infer<T>>;

export const DEFAULT_MODEL = "openai/gpt-6-luna";

export const llmModel = () => process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

export const isLlmConfigured = () => Boolean(process.env.OPENROUTER_API_KEY);

let client: OpenAI | undefined;
const getClient = () =>
  (client ??= new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: { "X-Title": "Emory Growth" },
  }));

export const openRouterLlm: StructuredLlm = async ({ system, user, schema }) => {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  let lastError = "";
  // One retry: some models occasionally return JSON that fails validation.
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await getClient().chat.completions.create({
      model: llmModel(),
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: attempt === 0 ? user : `${user}\n\nYour previous reply was invalid (${lastError}). Reply with valid JSON only.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "result", strict: true, schema: jsonSchema },
      },
    });
    const text = res.choices[0]?.message?.content ?? "";
    try {
      return schema.parse(JSON.parse(text));
    } catch (err) {
      lastError = err instanceof Error ? err.message.slice(0, 200) : "parse error";
    }
  }
  throw new Error(`The model did not return valid output (${lastError}).`);
};
