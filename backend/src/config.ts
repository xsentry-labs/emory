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

  // PAID, optional. Without a key, crawling falls back to the built-in
  // open-source fetch+cheerio (and, for hydration-heavy pages, Puppeteer) crawler.
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY ?? "",
  // PAID (Google Cloud), optional. Without a key, performance auditing falls
  // back to a real local Lighthouse run on bundled open-source Chromium.
  pagespeedApiKey: process.env.PAGESPEED_API_KEY ?? "",
  // Optional override for the Chromium binary Puppeteer/Lighthouse launch
  // (e.g. a system Chromium installed via the Railway/nixpacks build). Left
  // unset, Puppeteer uses the Chromium it downloads itself at npm install time.
  chromiumExecutablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? "",
  // Set to skip real local Lighthouse entirely (e.g. a deploy target with no
  // headless-browser support at all) and go straight to the page-weight heuristic.
  disableLocalLighthouse: bool(process.env.DISABLE_LOCAL_LIGHTHOUSE, false),

  githubToken: process.env.GITHUB_TOKEN ?? "",
  githubDefaultOwner: process.env.GITHUB_DEFAULT_OWNER ?? "",
  githubDefaultRepo: process.env.GITHUB_DEFAULT_REPO ?? "",

  maxPages: Number(process.env.MAX_PAGES ?? 60),
  maxCrawlConcurrency: Number(process.env.MAX_CRAWL_CONCURRENCY ?? 5),

  useFirecrawl: bool(process.env.USE_FIRECRAWL, true),

  // AI visibility ("does an AI assistant recommend/mention this brand?").
  // Mixing model families deliberately — this is the one place calling
  // several different models through OpenRouter is the point, not a
  // cost-routing decision. See BEACON_ARCHITECTURE.md §3.2.
  aiVisibilityModels: (process.env.AI_VISIBILITY_MODELS ?? "openai/gpt-4o-mini,google/gemini-2.5-flash,anthropic/claude-haiku-4.5")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean),

  // Beacon's continuous-re-audit scheduler (Phase B1 — no per-workspace
  // model yet, see BEACON_ARCHITECTURE.md §2/§7). A fixed, comma-separated
  // list of site URLs and a cron expression; empty by default (opt-in).
  beaconTargetUrls: (process.env.BEACON_TARGET_URLS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean),
  beaconReauditCron: process.env.BEACON_REAUDIT_CRON ?? "0 3 * * *",
};

export function requireOpenRouter() {
  if (!config.openrouterApiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. All LLM calls in this system go through OpenRouter — see backend/.env.example.",
    );
  }
}
