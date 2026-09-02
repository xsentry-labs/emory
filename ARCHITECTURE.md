# Architecture — Emory Audit backend

This document covers the backend added in `backend/`: a multi-agent SEO +
GEO/AEO audit system with a human approval gate and a coding agent that opens
GitHub PRs for approved changes. It is deployed separately from the existing
Next.js frontend in this repo (frontend → Vercel, backend → Railway).

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
| Performance | `audit/pagespeed.ts` | none (API) | Core Web Vitals via PageSpeed Insights, degrades to a heuristic estimate without a key |
| On-Page & Content | `audit/onpage.ts` | mid | Titles/metas/headings quality, keyword alignment, content depth vs. thin content |
| GEO/AEO | `audit/geoAeo.ts` | mid | llms.txt, answer-shaped content, citation-friendliness, AI-oriented schema |
| Brand/Company RAG | `rag/docStore.ts` + `audit/eeat.ts` | embed + mid | Ingests uploaded docs, grounds E-E-A-T and brand-voice findings in them |
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

Every run produces both `report.json` (typed, consumed by the approval UI)
and `report.md` (human-readable, same content) under
`DATA_DIR/runs/<runId>/`. Suggestion IDs are stable across both so an
approval decision made against the JSON maps directly onto the Markdown
section.

## 6. Cost controls

- Cheap tier for anything that runs once per page (technical checks can be
  O(hundreds) of pages).
- Mid tier for anything that runs once per page *and* needs judgment
  (on-page, GEO/AEO) — batched into single calls per page rather than one
  call per check.
- Strong tier called exactly twice per run: once for synthesis, once for
  code/PR generation on the approved subset.
- Page sampling: crawls beyond `MAX_PAGES` (config, default 60) are capped
  and the excess is noted in the report rather than silently dropped.
- `costTracker` gives per-run token/cost totals in the API response and the
  Markdown report footer.

## 7. What's deliberately out of scope for this pass

- Live SERP/competitor analysis (needs a paid SERP API; stubbed as an
  optional agent behind `SERPAPI_KEY` for a later phase).
- Vector DB beyond an in-memory store for company docs (fine at MVP doc
  volumes; swap for LanceDB/Chroma if doc corpora grow).
- Wiring the existing `/audit` and `/approvals` Next.js screens to this API
  (they still render `lib/mock-data.ts`) — left as a follow-up so this change
  stays reviewable as "the backend exists and works," not "the frontend was
  rewritten too."
