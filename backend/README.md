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
npm run dev
```

Only `OPENROUTER_API_KEY` is required to run something end to end. Everything
else degrades gracefully:

| Missing env var | What happens instead |
|---|---|
| `FIRECRAWL_API_KEY` | Falls back to a same-origin `fetch` + cheerio crawler |
| `PAGESPEED_API_KEY` | Performance agent reports a heuristic payload-size estimate instead of real Core Web Vitals |
| `GITHUB_TOKEN` / `GITHUB_DEFAULT_OWNER` / `GITHUB_DEFAULT_REPO` | `/apply` writes fix files to `DATA_DIR/patches/<runId>/` instead of opening a PR |

## Run an audit

**HTTP API:**

```bash
curl -X POST localhost:8787/audits \
  -H "content-type: application/json" \
  -d '{"url": "https://example.com", "constraints": "homepage and pricing only"}'
# -> { "id": "run-xxxx", "status": "awaiting_approval", "score": 74, "suggestions": [...], ... }

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
| `POST` | `/audits` | Start an audit: `{ url, constraints?, docs?: [{name, text}], maxPages? }`. Responds once the run reaches `awaiting_approval` (or `failed`). |
| `GET` | `/audits` | List runs (summary only). |
| `GET` | `/audits/:id` | Full run: findings, suggestions, cost, status. |
| `GET` | `/audits/:id/report.md` | The same report as Markdown. |
| `GET` | `/approvals/:runId` | List that run's suggestions and their decision state. |
| `POST` | `/approvals/:runId/suggestions/:suggestionId` | `{ decision: "approve" \| "reject", edits?: { recommendedChange?, note? } }` |
| `POST` | `/audits/:runId/apply` | Implements every currently-`approved` suggestion: generates fix files, opens a GitHub PR (`{ owner?, repo?, baseBranch? }`, defaults from env), or writes a local patch dir if GitHub isn't configured. |

## Company documents (RAG)

Pass `docs: [{ name, text }]` on `POST /audits` — plain text extracted from
PDFs/brand guidelines/product docs upstream of this API (this service doesn't
do PDF parsing itself; pipe files through `pdf-parse`/Unstructured/LlamaParse
first, or send already-extracted text). Docs are chunked, embedded via
OpenRouter, and grounded into the E-E-A-T agent's findings — every
contradiction it flags must point at a specific doc excerpt.

## Cost controls

- Three model tiers (`cheap`/`mid`/`strong`), configurable per-tier in
  `.env` — see `backend/.env.example` for the routing philosophy and
  current defaults.
- `COST_CEILING_USD` (default `2.00`) stops further `strong`-tier calls once
  a run's running estimate crosses it; cheap/mid calls are never blocked, so
  a run degrades gracefully instead of failing outright.
- Every run response includes `modelCalls` (per-call model/tokens/estimated
  cost) and a running `costUsd` total.
- `maxPages` (default `MAX_PAGES=60`) caps crawl size; a truncated crawl is
  noted in the report rather than silently sampled.

## Deploy to Railway

`railway.json` is set up for Nixpacks (`npm install && npm run build`,
`npm start`). From the Railway dashboard: New Project → Deploy from GitHub →
select this repo → set the service's **root directory to `backend/`** → add
the env vars from `.env.example` → deploy. `DATA_DIR` defaults to `./data`,
which is fine on a single Railway instance; attach a volume at that path if
you want runs to survive redeploys, or point it at Postgres/S3 later (see
"Persistence" in `../ARCHITECTURE.md`).

## Tests

```bash
npm test         # vitest — deterministic pieces only (technical audit rules,
                  # scoring, report rendering); no API keys needed
npm run typecheck
```

The LLM-backed agents (`onpage`, `geo-aeo`, `eeat`, `synthesizer`,
`coding/agent`) aren't unit-tested against real OpenRouter calls — they're
exercised via `npm run audit:cli` against a real site once `OPENROUTER_API_KEY`
is set.

## Wiring this up to the existing frontend

The Next.js app in the repo root (`app/`, `components/`, `lib/mock-data.ts`)
is currently a fully mock, backend-free prototype (see the root `README.md`).
This service is what its `/audit` and `/approvals` screens would call in a
real deployment — that wiring (swap `lib/mock-data.ts` reads for `fetch`
calls to this API's base URL) is a follow-up, not part of this backend.
