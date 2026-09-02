import "dotenv/config";

function bool(v: string | undefined, fallback: boolean): boolean {
  if (v === undefined) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

export const config = {
  port: Number(process.env.PORT ?? 8787),
  dataDir: process.env.DATA_DIR ?? "./data",

  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openrouterSiteUrl: process.env.OPENROUTER_SITE_URL ?? "https://github.com/xsentry-labs/emory",
  openrouterSiteName: process.env.OPENROUTER_SITE_NAME ?? "Emory Audit",

  models: {
    cheap: process.env.OPENROUTER_MODEL_CHEAP ?? "google/gemini-2.5-flash-lite",
    mid: process.env.OPENROUTER_MODEL_MID ?? "anthropic/claude-haiku-4.5",
    strong: process.env.OPENROUTER_MODEL_STRONG ?? "anthropic/claude-sonnet-4.5",
    embed: process.env.OPENROUTER_MODEL_EMBED ?? "openai/text-embedding-3-small",
  },

  costCeilingUsd: Number(process.env.COST_CEILING_USD ?? 2.0),

  firecrawlApiKey: process.env.FIRECRAWL_API_KEY ?? "",
  pagespeedApiKey: process.env.PAGESPEED_API_KEY ?? "",

  githubToken: process.env.GITHUB_TOKEN ?? "",
  githubDefaultOwner: process.env.GITHUB_DEFAULT_OWNER ?? "",
  githubDefaultRepo: process.env.GITHUB_DEFAULT_REPO ?? "",

  maxPages: Number(process.env.MAX_PAGES ?? 60),
  maxCrawlConcurrency: Number(process.env.MAX_CRAWL_CONCURRENCY ?? 5),

  useFirecrawl: bool(process.env.USE_FIRECRAWL, true),
};

export function requireOpenRouter() {
  if (!config.openrouterApiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. All LLM calls in this system go through OpenRouter — see backend/.env.example.",
    );
  }
}
