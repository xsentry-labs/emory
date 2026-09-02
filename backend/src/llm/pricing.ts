/**
 * Rough per-1M-token USD prices, used only to produce an approximate cost
 * estimate for the run report and the cost ceiling. Not billing-accurate —
 * OpenRouter's own dashboard is the source of truth for real spend.
 */
const PRICE_PER_MILLION: Record<string, { in: number; out: number }> = {
  "google/gemini-2.5-flash-lite": { in: 0.1, out: 0.4 },
  "anthropic/claude-haiku-4.5": { in: 1, out: 5 },
  "anthropic/claude-sonnet-4.5": { in: 3, out: 15 },
  "openai/text-embedding-3-small": { in: 0.02, out: 0 },
};

const DEFAULT_PRICE = { in: 1, out: 3 };

export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const price = PRICE_PER_MILLION[model] ?? DEFAULT_PRICE;
  return (promptTokens / 1_000_000) * price.in + (completionTokens / 1_000_000) * price.out;
}
