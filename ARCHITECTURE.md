# Architecture — Emory Audit backend

This document covers the backend added in `backend/`: a multi-agent SEO +
GEO/AEO audit system with a human approval gate and a coding agent that opens
GitHub PRs for approved changes. It is deployed separately from the existing
Next.js frontend in this repo (frontend → Vercel, backend → Railway).

This is the Audit agent specifically. `BEACON_ARCHITECTURE.md` scopes the
next agent (continuous re-audit + AI visibility, business profile, reviews),
Phase B1 of which now lives alongside Audit in `backend/` — the agent table
below (§2) includes it.

## 0. Why a separate backend

The rest of this repository (`app/`, `components/`, `lib/`) is a static,
mock-data Next.js prototype of a broader product ("Emory") — no server, no
external calls, `localStorage` only (see root `README.md`). It has no crawler,
no LLM integration, and no persistence. The brief asks for a *real* audit +
coding-agent pipeline, so it lives in `backend/` as an independently
deployable Node/TypeScript service with its own `package.json`. The Next.js
`/audit` and `/approvals` screens are the natural future consumers of this
API (swap their mock data for `fetch` calls to the Railway URL); wiring that
up is a follow-on, not part of this change.

## 1. Research summary and decisions

Reviewed patterns from the brief's link list plus general knowledge of the
current SEO-agent ecosystem (Firecrawl's structured-extraction API, MCP-SEO's
tool taxonomy, CrewAI/LangGraph multi-agent conventions, and the "AI Overview
readiness" checks now common in GEO/AEO tooling). The recurring winning
pattern across the strongest examples (SEOAgent's audit→approve→fix loop, the
Devpost SEO-Auto-Fix agent's PR delivery, claude-seo's specialist/evidence
format):

- **Specialist agents, each narrow and cheap**, feeding a **single stronger
  synthesizer** that does the prioritization and writing. Nobody runs the
  expensive model per-page.
- **Evidence-first findings**: every finding carries the exact URL and the
  exact current value (a title string, a header, a status code), never a
  vague "improve your titles."
- **Firecrawl (or an equivalent clean-markdown crawler) as the extraction
  layer**, decoupled from the LLM — HTML parsing/DOM logic never happens
  inside a prompt.
- **A hard human gate between "suggested" and "applied."** No system in the
  reviewed set auto-publishes; the ones that feel trustworthy (SEOAgent,
  Devpost's PR bot) all stop at a PR or an approval screen.
- **GEO/AEO as its own checklist**, not folded into on-page SEO: llms.txt
  presence, answer-shaped content (extractable Q/A blocks), citation-friendly
  structure (headings that stand alone, self-contained paragraphs), schema
  aimed at AI consumption (FAQPage, HowTo, Organization sameAs).

### Framework: Claude-Code-native / plain TypeScript orchestration, not CrewAI or LangGraph

Chosen over the alternatives for this specific deliverable:

- **CrewAI / LangGraph are Python.** This repo, the frontend, and the coding
  agent's own output (JS/TS file edits, PR diffs) are all TypeScript/Next.js.
  A Python service would mean two runtimes, two deploy targets, and a
  language boundary right where the coding agent needs the most fidelity
  (editing the actual repo's `.tsx`/`.ts` files). Plain TypeScript keeps one
  language end to end and one Railway service.
- **LangGraph's value (durable state, explicit HITL checkpoints) is
  reproducible here with far less machinery**: the pipeline is a short,
  finite sequence (collect → audit → synthesize → gate → apply), not a
  long-horizon agent loop with cycles. A typed pipeline of plain async
  functions plus a JSON-backed run store gives the same "resume after
  approval" checkpoint semantics without adopting a graph runtime.
- **CrewAI's value (role-based crews, fast prototyping) is reproduced with
  a directory of small, single-purpose modules** (`audit/technical.ts`,
  `audit/onpage.ts`, …) run with `Promise.all`, which is CrewAI's parallel
  "crew" pattern minus the framework's own orchestration DSL and its
  Python-only tool ecosystem.
- If the system later needs long-horizon autonomy (e.g., an agent that
  crawls, decides, re-crawls, and iterates many rounds), LangGraph becomes
  the right call and the audit modules here port over unchanged as its
  "tools."

### Crawling: Firecrawl primary, fetch+cheerio fallback

Firecrawl is used when `FIRECRAWL_API_KEY` is set (`/scrape` and `/map` for
clean markdown + link discovery, batched). When it isn't, `fallbackCrawler.ts`
does a same-origin BFS crawl with `fetch` + `cheerio`, extracting the same
shape (title, meta, headings, links, text) so every downstream agent is
crawler-agnostic. This keeps the MVP runnable with zero paid services beyond
OpenRouter.

### LLM provider: OpenRouter only, three-tier routing

All calls go through `backend/src/llm/openrouter.ts`, an OpenAI-SDK client
pointed at `https://openrouter.ai/api/v1`. No other provider SDK exists in
the codebase. Tiers (overridable via env, see `.env.example`):

| Tier | Default model | Used for |
|---|---|---|
| `cheap` | `google/gemini-2.5-flash-lite` | Per-page technical checks, classification, extraction cleanup |
| `mid` | `anthropic/claude-haiku-4.5` | On-page/content reasoning, GEO/AEO judgment, E-E-A-T scoring against brand docs |
| `strong` | `anthropic/claude-sonnet-4.5` | Final synthesis/prioritization, code/PR generation |
| `embed` | `openai/text-embedding-3-small` | Company-doc RAG store |

`llm/costTracker.ts` logs `{agent, tier, model, promptTokens, completionTokens,
estUsd}` per call to the run record and enforces `COST_CEILING_USD` by
refusing further `strong`-tier calls once the running estimate for a run
exceeds the ceiling (cheap/mid calls are never blocked, since a partial audit
is more useful than a killed one).

## 2. Agents

| Agent | File | Model tier | Responsibility |
|---|---|---|---|
| Data Collector | `crawl/*` | none (deterministic) | Crawl, robots.txt, sitemap.xml, per-page raw extraction |
| Technical SEO | `audit/technical.ts` | none (rule-based) | Indexation, canonicals, redirects, status codes, structured data validity, security headers, mobile viewport — deterministic checks, zero LLM cost since they don't need judgment |
| Performance | `audit/pagespeed.ts` + `audit/localLighthouse.ts` | none (API or local browser) | Core Web Vitals via PageSpeed Insights (paid) if configured, else a **real local Lighthouse run** on Puppeteer's bundled open-source Chromium (`browser/pool.ts`) — only degrades to a page-weight heuristic if a headless browser can't launch at all |
| On-Page & Content | `audit/onpage.ts` | mid | Titles/metas/headings quality, keyword alignment, content depth vs. thin content |
| GEO/AEO | `audit/geoAeo.ts` | mid | llms.txt, answer-shaped content, citation-friendliness, AI-oriented schema |
| Brand/Company RAG | `rag/docStore.ts` + `audit/eeat.ts` | embed + mid | Ingests uploaded docs, grounds E-E-A-T and brand-voice findings in them |
| AI Visibility *(Beacon B1)* | `audit/aiVisibility.ts` | mid | Opt-in: does the brand get mentioned when several distinct model families are asked buying questions (deterministic substring check, not judgment), and where it is mentioned, is what's said accurate against the company's own docs — see `BEACON_ARCHITECTURE.md` §3.2 |
| Synthesizer | `synth/synthesizer.ts` | strong | Merges all findings, dedupes, scores severity × effort → P0–P3, writes the Markdown report |
| Coding Agent | `coding/agent.ts` | strong (only for generated snippets; file edits are deterministic where possible) | Applies **approved** items only: meta/title fixes, JSON-LD generation, robots/sitemap patches; opens a GitHub PR via Octokit, or writes a local patch if no repo is configured |

No dedicated Reviewer/QA agent in the MVP — the synthesizer's own
falsifiability check (every suggestion must cite a URL + current value or it
is dropped) substitutes for it; a stronger-model review pass is the first
thing to add in Phase 6 if suggestion quality needs a second opinion.

## 3. Data flow

```
POST /audits { url, docs?, constraints? }
        |
        v
 [Collector] crawl (Firecrawl | fallback) + robots + sitemap
        |
        v  (parallel, per page, cheap/mid tier)
 [Technical] [On-Page] [GEO/AEO] [Performance] [E-E-A-T/RAG]
        |            (each returns AuditFinding[] with url + evidence)
        v
 [Synthesizer] (strong tier) -> prioritized Suggestion[] (P0-P3) + report.md + report.json
        |
        v
 run persisted to DATA_DIR/runs/<runId>.json  (status: "awaiting_approval")
        |
        v
 GET  /audits/:id                 -> report + suggestions
 POST /audits/:id/suggestions/:sid { decision: approve|reject, edits? }
        |
        v  (only approved items, only after explicit "apply" call)
 POST /audits/:id/apply
        |
        v
 [Coding Agent] generates file-level patches for approved suggestions
        |
        v
 GitHub configured?  -> branch + commits + PR (Octokit)
 not configured?      -> writes patch files under DATA_DIR/patches/<runId>/
        |
        v
 run updated: status "applied", pr_url or patch paths recorded
```

Everything downstream of "awaiting_approval" requires an explicit approval
call per suggestion and an explicit `/apply` call — nothing runs
automatically, matching the brief's non-negotiable human gate and this
product's existing "nothing runs without approval" rule (`README.md`).

## 4. Persistence

MVP uses a JSON-file run store (`approval/store.ts`, one file per run under
`DATA_DIR/runs/`) rather than a database — Railway gives ephemeral local disk
per deploy, which is fine for a single-instance MVP and keeps the "easy to
run, zero external services beyond OpenRouter" bar from the brief. The store
is a single small module with `get/save/list`, so swapping in Postgres later
(recommended once this runs multi-instance) touches one file.

## 5. Output artifacts

Every run is one JSON file, `DATA_DIR/runs/<runId>.json` (the full `AuditRun`
record — findings, suggestions, cost, warnings), with the Markdown report
generated from it and stored inline as `reportMarkdown` rather than as a
second file; `GET /audits/:id/report.md` serves that field with a Markdown
content type. Suggestion IDs are stable across both representations, so a
decision recorded against the JSON is reflected in the Markdown on next
render (`renderMarkdown` is re-run and re-saved on every approval decision).

## 6. Paid vs. open-source, by design

OpenRouter is the only mandatory paid dependency — it's the sole LLM/embedding
provider, deliberately, and it's usage-billed. Every other external service is
optional and has a real open-source fallback wired in automatically, not just
a degraded stub:

| Capability | Paid option | Default / fallback |
|---|---|---|
| Crawling | Firecrawl (`FIRECRAWL_API_KEY`) | `fetch` + cheerio (`crawl/fallbackCrawler.ts`) |
| Core Web Vitals | Google PageSpeed Insights (`PAGESPEED_API_KEY`) | **Real local Lighthouse** on Puppeteer's bundled Chromium (`audit/localLighthouse.ts`, `browser/pool.ts`) — actual Lighthouse scoring, self-hosted, not a heuristic. A page-weight heuristic is the *third* tier, used only if a headless browser can't launch at all. |
| PR delivery | GitHub API (free, just needs `GITHUB_TOKEN`) | Local patch directory under `DATA_DIR/patches/<runId>/` |

`.env.example` labels each of these `[PAID]` explicitly. Model tiering
(cheap/mid/strong, `llm/openrouter.ts`) is the cost control *within* the one
mandatory paid dependency, covered in §7.

## 7. Reliability and edge-case handling

A handful of failure modes matter enough to call out as deliberate design,
not gaps discovered later:

- **A non-fatal LLM failure never fails the whole run.** Every audit agent
  and the synthesizer catch their own model-call errors, record a
  deduplicated message in the run's `warnings` array, and continue with
  whatever they did get — a missing `OPENROUTER_API_KEY` degrades an audit
  to its rule-based findings plus clear warnings, rather than a 500. The
  Markdown report surfaces the same warnings as a "this run is incomplete"
  callout.
- **A site that can't be fetched at all fails loudly and specifically**
  (`crawl/collect.ts` throws if zero pages come back from either crawler,
  including the case where Firecrawl's call succeeds but returns nothing)
  instead of quietly producing a hollow "successful" audit.
- **LLM JSON output is checked for the fields it actually needs**
  (`util/validateLlm.ts`) before becoming a finding/suggestion — a model
  that emits valid JSON with an empty or missing field gets that entry
  dropped, not rendered as `"undefined"`.
- **No route can hang or crash the process.** `util/asyncHandler.ts` wraps
  every Express handler so a rejected promise reaches a single error
  middleware instead of an unhandled rejection (which, on Node 15+, kills
  the process by default).
- **Concurrent writes to the same run are serialized**, not raced —
  `approval/runLock.ts` is an in-process per-run mutex around the JSON
  store's read-modify-write, and `/apply` additionally refuses a second
  call while a run is `applying` or already `applied` (409). This is a
  single-instance-appropriate fix; a multi-instance deploy needs the
  database-backed store noted in §4, with real row locking.
- **The single most expensive endpoint (`POST /audits`) is rate-limited**
  (`RATE_LIMIT_AUDITS_PER_HOUR`, default 20/hour/client) — a cost control
  that sits above the per-run `COST_CEILING_USD`, which only bounds one
  run's spend, not how many runs a client can start.

## 8. Cost controls

- Cheap tier for anything that runs once per page (technical checks can be
  O(hundreds) of pages) — currently rule-based (§2) rather than an actual
  cheap-tier call, since these checks don't need judgment; the tier exists
  for when a future check does.
- Mid tier for anything that runs once per page *and* needs judgment
  (on-page, GEO/AEO, E-E-A-T) — batched into single calls per page/batch
  rather than one call per check.
- Strong tier used for synthesis (once or twice per run, depending on
  whether chunk consolidation is needed) and for the coding agent's fix
  notes (once per *approved* suggestion, capped by `COST_CEILING_USD` — once
  hit, remaining notes are built straight from the suggestion's own text
  instead of another call).
- Page sampling: crawls beyond `MAX_PAGES` (config, default 60) are capped
  and the excess is noted in the report rather than silently dropped;
  company-doc ingestion is similarly capped (§ Company documents in
  `backend/README.md`) so an oversized upload can't blow up embedding cost.
- `RATE_LIMIT_AUDITS_PER_HOUR` bounds how many audits (the expensive
  endpoint) a client can start per hour — a ceiling above the per-run one.
- `costTracker` gives per-run token/cost totals in the API response and the
  Markdown report footer.

## 9. What's deliberately out of scope for this pass

- Live SERP/competitor analysis. Evaluated Serper.dev (~$0.001–0.003/query),
  SerpApi (~$0.01–0.015/query, most established), and DataForSEO
  (comparable to Serper, more setup) — Serper.dev would be the pick given
  the cost-consciousness bar, gated behind an optional key the same way
  Firecrawl/PSI are, and simply skipped (not faked) if unset. Not wired in
  yet.
- Vector DB beyond an in-memory store for company docs (fine at MVP doc
  volumes, now with an explicit size cap; swap for LanceDB/Chroma if doc
  corpora grow past a few hundred chunks).
- Wiring the remaining Next.js screens (`/approvals`, `/brain`,
  `/customers`, `/revenue`, `/connections`) to this API — `/audit` itself is
  wired (see `lib/audit-api.ts` and `components/audit/audit-view.tsx` in the
  repo root), but the others cover product surface (CRM, ad spend, reviews,
  attribution) this backend doesn't implement.
- Horizontal scaling: the run lock (§7) and the local-Lighthouse browser
  pool are both in-process state, so this is a single-instance service until
  the run store moves to a real database.
