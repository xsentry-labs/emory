# Emory Audit backend

SEO + GEO/AEO audit and coding-agent backend: crawl a site, run specialist
audit agents, synthesize a prioritized (P0–P3) report, gate every suggestion
behind human approval, then hand approved items to a coding agent that opens
a GitHub PR (or writes a local patch). All LLM calls go through OpenRouter.

See `../ARCHITECTURE.md` for the design decisions and data flow. This file is
setup and usage.

## Setup

```bash
cd backend
npm install
cp .env.example .env   # then fill in OPENROUTER_API_KEY at minimum
npm run dev             # http://localhost:8787
```

Only `OPENROUTER_API_KEY` is required — it's the sole LLM/embedding provider
this system calls, by design. Everything else in `.env.example` is an
**optional paid upgrade with a working open-source fallback wired in
automatically** when its key is left unset:

| Env var | Paid service it upgrades to | Open-source fallback used when unset |
|---|---|---|
| `FIRECRAWL_API_KEY` | Firecrawl (clean markdown extraction) | Built-in `fetch` + cheerio crawler (`src/crawl/fallbackCrawler.ts`) |
| `PAGESPEED_API_KEY` | Google PageSpeed Insights (Core Web Vitals) | **Real local Lighthouse** on Puppeteer's bundled, self-hosted Chromium (`src/audit/localLighthouse.ts`) — actual Lighthouse scoring, not a fake estimate. Only if that also can't launch does it drop to a page-weight heuristic. |
| `GITHUB_TOKEN` (+ owner/repo) | GitHub PR delivery | Fix files written to `DATA_DIR/patches/<runId>/` instead of a PR |

Nothing in this system is a required paid dependency except OpenRouter
itself, which is usage-billed by design (that's the point of the
cheap/mid/strong tiering below).

## Run an audit

**HTTP API:**

```bash
curl -X POST localhost:8787/audits \
  -H "content-type: application/json" \
  -d '{"url": "https://example.com", "constraints": "homepage and pricing only"}'
# -> { "id": "run-xxxx", "status": "awaiting_approval", "score": 74, "suggestions": [...], "warnings": [...], ... }

curl localhost:8787/audits/run-xxxx
curl localhost:8787/audits/run-xxxx/report.md

# approve one suggestion
curl -X POST localhost:8787/approvals/run-xxxx/suggestions/s-xxxx \
  -H "content-type: application/json" \
  -d '{"decision": "approve"}'

# implement everything approved so far (opens a GitHub PR, or writes a local patch)
curl -X POST localhost:8787/audits/run-xxxx/apply \
  -H "content-type: application/json" \
  -d '{"owner": "your-org", "repo": "your-site"}'
```

**CLI** (no server, one-shot, prints the Markdown report):

```bash
npm run audit:cli -- https://example.com --docs ./brand-guidelines.txt --constraints "technical only"
```

## API surface

| Method | Path | Does |
|---|---|---|
| `POST` | `/audits` | Start an audit: `{ url, constraints?, docs?: [{name, text}], maxPages? }`. Rate-limited (`RATE_LIMIT_AUDITS_PER_HOUR`, default 20/hour per client). Responds once the run reaches `awaiting_approval` (or `failed`, with `error` set). |
| `GET` | `/audits` | List runs (summary only). |
| `GET` | `/audits/:id` | Full run: findings, suggestions, cost, status, `warnings`. |
| `GET` | `/audits/:id/report.md` | The same report as Markdown. |
| `GET` | `/approvals/:runId` | List that run's suggestions and their decision state. |
| `POST` | `/approvals/:runId/suggestions/:suggestionId` | `{ decision: "approve" \| "reject", edits?: { recommendedChange?, note? } }`. 404 if the run/suggestion doesn't exist, 409 if that suggestion was already applied. |
| `POST` | `/audits/:runId/apply` | Implements every currently-`approved` suggestion: generates fix files, opens a GitHub PR (`{ owner?, repo?, baseBranch? }`, defaults from env), or writes a local patch dir if GitHub isn't configured. 400 if nothing is approved yet; 409 if the run is already applying/applied. |
| `GET` | `/audits/:id/diff` | Diffs this run's findings against the most recent prior completed run for the same URL — Beacon's "what changed since last time" view. 404 if there's no prior run to diff against. Add `?format=md` for the same comparison as a human-readable Markdown report. |

Every response is JSON; every 4xx/5xx is `{ "error": "..." }`. An unknown
route returns 404 the same way rather than Express's default HTML page.

## Beacon: AI visibility + continuous re-audit

Beacon Phase B1 and B2 features (see `../BEACON_ARCHITECTURE.md`), all built
entirely on the infrastructure above — no new paid dependency, no
multi-tenancy:

**AI visibility.** Pass `aiVisibilityPrompts` (and optionally `brand`) on
`POST /audits` to also check whether AI models mention the brand when asked
buying questions — the same check the product's own copy describes ("we
asked ChatGPT, Claude, Perplexity... forty times"), made real:

```bash
curl -X POST localhost:8787/audits -H "content-type: application/json" -d '{
  "url": "https://example.com",
  "brand": "Acme",
  "aiVisibilityPrompts": ["best tool for weekly marketing reports", "Acme vs Cadence"]
}'
```

Each prompt is asked to every model in `AI_VISIBILITY_MODELS` (mixing model
families deliberately). A prompt no model mentions the brand for becomes a
`critical` finding; some-but-not-all becomes `warning` — each with the
model's actual answer as evidence. If company docs were also uploaded, a
brand mention that contradicts them (wrong price, wrong feature) is flagged
separately. Skipped entirely (zero extra cost) when `aiVisibilityPrompts` is
omitted.

**Continuous re-audit.** Set `BEACON_TARGET_URLS` (comma-separated) and the
server re-audits each one on `BEACON_REAUDIT_CRON` (default: daily at 3am),
logging a summary (`added`/`resolved`/`persisting` finding counts) each time.
Pull the full comparison anytime with `GET /audits/:id/diff` (JSON) or
`GET /audits/:id/diff?format=md` (a "what changed" report: score delta,
then Resolved/New/Still open sections). A no-op — nothing starts —
if `BEACON_TARGET_URLS` is left empty, so this changes nothing for an
Audit-only deployment. Single-instance only (see "Deploy to Railway" below).

## Company documents (RAG)

Pass `docs: [{ name, text }]` on `POST /audits` — plain text extracted from
PDFs/brand guidelines/product docs upstream of this API (this service doesn't
do PDF parsing itself; pipe files through `pdf-parse`/Unstructured/LlamaParse
first, or send already-extracted text). Docs are chunked, embedded via
OpenRouter, and grounded into the E-E-A-T agent's findings — every
contradiction it flags must point at a specific doc excerpt. A single doc is
capped at ~300k characters and the combined set at 400 chunks (bounds the
embedding call's size and cost); going over either is noted in `warnings`,
not silently dropped.

## Cost controls

- Three model tiers (`cheap`/`mid`/`strong`), configurable per-tier in
  `.env` — see `backend/.env.example` for the routing philosophy and
  current defaults.
- `COST_CEILING_USD` (default `2.00`) stops further `strong`-tier calls once
  a run's running estimate crosses it; cheap/mid calls are never blocked, so
  a run degrades gracefully instead of failing outright. The coding agent
  respects the same ceiling: once hit, it writes fix notes straight from the
  suggestion's own (already-approved) text instead of one more LLM call per
  suggestion.
- Every run response includes `modelCalls` (per-call model/tokens/estimated
  cost) and a running `costUsd` total.
- `maxPages` (default `MAX_PAGES=60`) caps crawl size; a truncated crawl is
  noted in the report rather than silently sampled.
- `RATE_LIMIT_AUDITS_PER_HOUR` (default 20) caps how many audits a single
  client can start per hour — the single most expensive endpoint here.

## Error handling and edge cases

- **Nothing can crash the process.** Every route is wrapped (`src/util/asyncHandler.ts`)
  so a thrown/rejected error lands in a global Express error handler instead
  of hanging the request or (Node 15+ default) killing the server on an
  unhandled rejection. `process.on("unhandledRejection"/"uncaughtException")`
  log rather than exit, as a second line of defense.
- **A site that returns zero fetchable pages fails the run clearly**
  (`status: "failed"`, a specific `error`) instead of producing a
  near-empty "successful" audit — including when Firecrawl's API call
  itself succeeds but the mapped/scraped result is empty (falls back to the
  open-source crawler and only fails if that comes back empty too).
- **Every non-fatal LLM failure is recorded, not swallowed.** If any audit
  agent's model call fails (bad/missing `OPENROUTER_API_KEY`, a transient
  OpenRouter error, a cost-ceiling stop), the run still completes with
  whatever it *did* get, and the specific reason lands in `warnings` —
  surfaced in both the JSON response and the Markdown report's "This run is
  incomplete" section. Repeats of the same root cause (a missing key failing
  identically per batch) are deduplicated to one line.
- **Malformed LLM JSON output can't reach the report.** The model is asked
  for a JSON object; if a finding/suggestion is missing a required field
  (empty title, no evidence, an invalid priority) it's dropped rather than
  rendered as `"undefined"` in the UI (`src/util/validateLlm.ts`).
- **Concurrent requests against the same run don't race.** Two approval
  decisions, or two `/apply` calls, arriving at once for the same run are
  serialized by an in-process per-run lock (`src/approval/runLock.ts`) so
  the read-modify-write against the run's JSON file can't lose an update.
  `/apply` also rejects a second call outright (409) while a run is already
  `applying` or once it's `applied`.
- **A local Lighthouse browser crash self-heals.** If the shared Chromium
  instance disconnects mid-run, the next performance-audit call launches a
  fresh one instead of failing forever for the rest of the process's life.

## Deploy to Railway

1. Railway dashboard → New Project → Deploy from GitHub → select this repo.
2. Set the service's **root directory to `backend/`**.
3. Builder is Nixpacks (`railway.json` sets `npm install && npm run build`
   as the build command and `npm start` to run it — no extra config needed).
   `nixpacks.toml` additionally installs the shared libraries headless
   Chromium needs (`libnss3`, `libgbm1`, etc.) so the local-Lighthouse
   fallback can actually launch a browser on Railway's build image; nothing
   else in this service depends on it, and it's a no-op if you never hit
   that code path (e.g. `PAGESPEED_API_KEY` is set, or
   `DISABLE_LOCAL_LIGHTHOUSE=true`).
4. Add environment variables (Settings → Variables): at minimum
   `OPENROUTER_API_KEY`; anything else from `.env.example` you want the paid
   upgrade for. Set `NEXT_PUBLIC_API_BASE_URL` on the **frontend's** Vercel
   project to this service's Railway URL once deployed.
5. Deploy. Railway gives you a public URL (`https://<service>.up.railway.app`);
   `GET /health` should return `{"ok":true}`.

Notes specific to Railway:

- `DATA_DIR` (default `./data`, i.e. runs live inside the container) is fine
  for trying this out, but **resets on every redeploy** since Railway's
  container filesystem isn't persistent by default. Attach a Railway volume
  mounted at `DATA_DIR` if you want runs to survive redeploys, or swap the
  JSON-file store for Postgres before relying on this in production (see
  "Persistence" in `../ARCHITECTURE.md`) — either is a change to
  `src/approval/store.ts` alone.
- This is a single-instance MVP: the run lock, the local-Lighthouse browser
  pool, and the Beacon re-audit scheduler are all in-process state, so don't
  scale this service to multiple Railway replicas without moving the run
  store to a real database first (a second instance wouldn't see the
  first's lock or in-flight runs, and would double up scheduled re-audits).
- Set `CORS_ORIGIN` (comma-separated origins) once you know your frontend's
  deployed URL, to stop accepting requests from arbitrary origins — it's
  wide open by default, which is fine for local development only.

## Tests

```bash
npm test         # vitest — 77 tests across 16 files, no API keys needed
npm run typecheck
```

Covers both the deterministic pieces (technical audit rules, scoring, report
rendering, doc chunking, findings diffing and its Markdown rendering) and
the LLM-backed agents (`onpage`, `geoAeo`, `synthesizer`, `aiVisibility`,
`pagespeed`'s three-tier fallback) with OpenRouter mocked out — so the
routing/validation/warning logic is verified without spending real tokens.
Also covers the hardening added alongside them (the per-run lock actually
serializes, a zero-page crawl fails clearly, malformed LLM output is
dropped) and the scheduler (starts only when `BEACON_TARGET_URLS` is set,
validates its cron expression, one target's failure doesn't stop the
batch). The coding agent and full
end-to-end pipeline aren't mocked-tested; exercise those via
`npm run audit:cli` against a real site once `OPENROUTER_API_KEY` is set.

## Wiring to the frontend

The Next.js app in the repo root now has this wired up for real: see
`lib/audit-api.ts` and `components/audit/audit-view.tsx` there, and the root
`README.md`'s "Run it" section for running both together locally. The other
screens (`/approvals`, `/brain`, `/customers`, `/revenue`, `/connections`)
still render `lib/mock-data.ts` — they're a different product surface (CRM,
ad spend, attribution) this backend doesn't implement.
