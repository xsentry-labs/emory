# Architecture — Emory Beacon

Beacon is the next agent after Audit. Where Audit reads a site once and
diagnoses it, **Beacon keeps it found** — it re-audits on a schedule, drafts
the fixes Audit would have flagged, and reaches beyond the site itself into
the surfaces AI assistants and local search actually pull from: the business
profile, directories, and reviews. This document scopes Beacon the way
`ARCHITECTURE.md` scoped Audit: what it does, what it reuses, what's net new,
and a phased build order — before any Beacon code is written.

## 0. What Beacon is, precisely

Per the product canon (`lib/agents.ts`), Beacon owns:

1. Getting found in search — page titles, descriptions, structure, internal links
2. Getting recommended by AI assistants
3. Answering the questions people actually ask
4. Business profile — categories, hours, photos, posts, map position
5. Directories and listings
6. Reviews — requests, replies, sentiment
7. Making your catalogue readable to AI shopping tools

(1)–(3) are Audit's findings turned into an ongoing loop, not a one-time
report. (4)–(7) are new surfaces Audit never touched — they live outside the
site itself, most of them behind a third-party API and a per-customer
connection (a Google Business Profile a customer owns, a Yelp listing, a
review inbox), not a URL Beacon can just crawl.

That split matters for scoping: (1)–(3) can ship almost entirely on
infrastructure that already exists in `backend/`. (4)–(7) each need a new
integration, a new kind of credential (customer-owned OAuth, not a
system-level API key), and — for directories in particular — a decision
about whether to pay for an aggregator at all. Treat them as separate
phases, not one Beacon release.

## 1. What's reused from Audit, unchanged

Beacon is additive to `backend/`, not a rewrite:

| Piece | Reused as-is |
|---|---|
| `llm/openrouter.ts`, `llm/pricing.ts`, model tiers | Same client, same cheap/mid/strong routing philosophy |
| `crawl/*` (Firecrawl + fallback + robots/sitemap) | Same crawler for re-audits |
| `audit/technical.ts`, `onpage.ts`, `geoAeo.ts`, `pagespeed.ts`, `eeat.ts` | Run unchanged on each scheduled re-crawl |
| `synth/synthesizer.ts`, `synth/report.ts` | Same P0–P3 synthesis and Markdown rendering |
| `approval/store.ts` pattern, `Suggestion` type, approve/reject API shape | Extended (§4), not replaced |
| `coding/agent.ts` + `coding/github.ts` fix-note/PR pattern | Reused for site-level fixes; new suggestion kinds (§4) get their own "apply" path instead of a PR (§5) |
| `util/asyncHandler.ts`, `logging/costTracker.ts`, rate limiting, the whole error-handling posture in `ARCHITECTURE.md` §7 | Applies to every new route the same way |

Nothing above changes. Beacon's job is to call `runAuditPipeline` (or a
trimmed variant of it) on a schedule and route its output through the same
approval gate, then add the four new capability modules in §3.

## 2. What forces a real architecture change: multi-tenancy and schedules

Audit's data model is one-shot: a `POST /audits` call, a run, done. Beacon
is inherently recurring and per-customer — "re-crawl acme.com every night,"
"check ChatGPT's answer about acme.com every week," "poll acme.com's Google
reviews every day" all need a persistent notion of *whose* site this is and
*what's due*, which nothing in Audit's schema captures.

This is the forcing function `ARCHITECTURE.md` §4 already flagged ("swap
the JSON-file store for Postgres once this runs multi-instance, or needs
real persistence"). Beacon is that trigger. Concretely:

- **A `Workspace` becomes a real backend concept**, not just the frontend's
  `lib/store.ts` local one: `{ id, domain, connections, schedule config }`,
  persisted in a real database (Postgres — Railway has a one-click Postgres
  add-on, so this doesn't complicate the deploy story from §"Deploy to
  Railway" in `backend/README.md`).
- **A scheduler** triggers re-audits and the new checks below. Two
  reasonable options, in order of preference: (a) Railway's own cron/scheduled-job
  support if the plan has it, calling a `POST /workspaces/:id/run` endpoint;
  (b) an in-process `node-cron`-style scheduler if Railway cron isn't
  available, accepting that it only works single-instance (already true of
  this service per `ARCHITECTURE.md` §9). Do not build a queue/worker system
  for this — the volume (checks per workspace per day) doesn't warrant it
  yet.
- **Connections** (Google Business Profile OAuth token, a review-source API
  key, a keyword tracking list) are stored per workspace, encrypted at rest.
  This is the first place Beacon handles a customer's own credentials rather
  than an operator-level system key — a materially different trust boundary
  from anything in Audit, and worth its own security review before shipping
  (token storage, scope minimization, revocation) rather than folding it
  into a general PR.

This is the single biggest scope item in this document. Recommendation:
**Phase B1 (§7) explicitly does not require this** — a scheduled re-audit
can run against the same one-shot, no-login model Audit already has (a cron
job that just calls the existing pipeline for a fixed list of URLs from
config, no workspace/connection concept yet). Multi-tenancy becomes
mandatory starting at Phase B3 (business profile / reviews), because those
need a customer's own OAuth grant. That lets Beacon ship real value before
paying the multi-tenancy cost.

## 3. New capability modules

### 3.1 Continuous re-audit (extends existing infra directly)

A thin wrapper, not a new agent: `runAuditPipeline` on a schedule, diffed
against the previous run so Beacon reports *change* ("3 new pages missing
descriptions since last week," "the pricing page's noindex tag is back")
instead of repeating the whole report. Needs one new piece: a diff function
comparing two runs' findings by `(agent, category, evidence[0].url)` and
classifying each as new / resolved / persisting. Suggestions from a diffed
run go through the exact same approval → apply flow Audit already has.

### 3.2 AI visibility tracking ("getting recommended by AI assistants")

The most novel and highest-leverage piece, and it needs **no new external
integration** — it's answered entirely through OpenRouter, which already
gives this system access to GPT, Gemini, Claude, and Perplexity-family
models through one gateway. This is exactly the check the product's own
mock data narrates (`AUDIT_FINDINGS` → `af-ai-absent`: "We asked ChatGPT,
Claude, Perplexity and Google's AI answers... forty times") — Beacon makes
it real and recurring:

- A small, versioned set of prompts per workspace ("what's the best tool
  for X", "compare {brand} to {competitors}") — seeded from Audit's E-E-A-T
  findings and the company docs RAG store where available, editable by the
  customer.
- Run each prompt against 3–5 models on OpenRouter (mixing families
  deliberately — this is the one place calling multiple *model families*
  through OpenRouter is the point, not a routing-cost decision), cheap/mid
  tier since this is classification-shaped, not generation-shaped.
- Score each response for brand mention (present/absent), sentiment, and
  factual accuracy against the Brand RAG store (reuses `rag/docStore.ts`
  unchanged) — flag a stale/wrong answer the same way `eeat.ts` flags a
  page contradicting the company's own docs.
- Findings feed the *same* `AuditFinding`/`Suggestion` pipeline with a new
  `agent: "ai-visibility"` and a new suggestion kind (§4) whose fix is
  usually content, not code — "publish a comparison page," "answer this
  question on the pricing page" — which routes back through the *existing*
  Beacon-fixes-the-site loop (§3.1), not a new apply path.

This is the strongest Phase B1 candidate alongside continuous re-audit: it
reuses 100% of existing plumbing, needs zero new credentials, and directly
answers the most differentiated line in Beacon's own pitch.

### 3.3 Business profile (Google Business Profile)

- **API**: Google Business Profile API (formerly Google My Business).
  Free to call, but requires the *customer's* OAuth consent for their own
  listing — Emory can't act on a profile it doesn't have a grant for. This
  is a real onboarding flow (OAuth redirect, scope consent, token refresh),
  not a config env var.
- **Scope for v1**: read profile completeness (categories, hours, photo
  count, description) and produce findings the same shape as Audit's
  ("no post in 6 months," matching the mock data's `af-catalogue`-style
  framing); draft profile posts as `Suggestion`s with `kind: "profile-post"`
  for approval; on approval, publish via the API (not a PR — there's no
  code to review, so "apply" here means "call the Business Profile API,"
  a new small module analogous to `coding/github.ts` but for this API).
- **Explicitly out of v1**: map-position tracking (needs a paid rank
  tracking API — flag as paid/optional like `PAGESPEED_API_KEY`, no OSS
  equivalent exists for this one), photo *generation* (that's Studio's job
  per the agent canon, not Beacon's).

### 3.4 Reviews

- **API**: Google Business Profile API also covers reviews (same OAuth
  grant as §3.3, so building these together is more efficient than
  sequencing them). Yelp Fusion API as a second source if/when it's worth
  the extra OAuth flow — start with Google only.
- **Pipeline**: poll for new reviews → cheap-tier sentiment/urgency scoring
  → mid-tier drafts a reply grounded in the Brand RAG store (reuses
  `eeat.ts`'s doc-grounding pattern directly) → `Suggestion` with
  `kind: "review-reply"` → approve → publish via API. This is a very close
  structural match to the mock data's `act-review` action, made real.
- **Guard dependency**: a published reply is public, customer-facing
  speech — this is the first Beacon surface where the product canon's Guard
  agent (claim-checking, compliance) genuinely needs to exist before
  autonomy is granted here, even though it's optional for reading/drafting.
  Note this as a dependency, not a blocker for building drafts + human
  approval, which needs no Guard.

### 3.5 Directories and listings

- **Reality check**: keeping a business's NAP (name/address/phone)
  consistent across directories is a genuinely paid-aggregator problem
  (Yext, Uberall, Moz Local) — there's no meaningful open-source
  alternative the way Firecrawl has a crawler fallback, because the value
  *is* the aggregator's existing relationships with dozens of directory
  sites. Recommend: **do not build this in-house.** Either (a) integrate
  with one aggregator's API behind an optional key, clearly flagged paid,
  exactly like `FIRECRAWL_API_KEY`/`PAGESPEED_API_KEY`, with the feature
  simply absent (not faked) if unset, or (b) skip it for the MVP and let
  Beacon's v1 pitch be "profile, reviews, AI visibility, and the site
  itself" — still matches most of the canon capability list.

### 3.6 AI shopping catalogue readiness

- Schema generation (Product, Offer, AggregateRating JSON-LD) is the same
  shape of work `coding/agent.ts` already does for FAQPage/Organization
  schema from Audit's GEO/AEO findings — extend `audit/geoAeo.ts`'s schema
  checks to Product-type pages and generate the same kind of fix note.
  Genuinely low-effort, high-reuse; a good Phase B2 item alongside §3.1/§3.2
  hardening, since it needs no new integration.

## 4. Data model additions

New types alongside `backend/src/types.ts` (illustrative, not final):

```ts
type SuggestionKind =
  | "code-fix"        // existing behavior: routes through coding/agent.ts -> PR/patch
  | "profile-post"     // routes through a new Business Profile API module
  | "review-reply"     // routes through the same Business Profile API module
  | "content-brief";   // an AI-visibility gap that needs a page/answer written,
                        // handed off in Beacon's output rather than auto-published
                        // (writing it is Write's job per the agent canon, not Beacon's)

interface Workspace {
  id: string;
  domain: string;
  createdAt: string;
  connections: Connection[];
  schedule: { reaudit: string; aiVisibility: string }; // cron expressions
}

interface Connection {
  id: string;
  provider: "google-business-profile" | "yelp";
  workspaceId: string;
  // token storage: encrypted at rest, scoped minimally, with a documented
  // revocation path -- specced in full at Phase B3, not here.
  status: "connected" | "expired" | "revoked";
}
```

`Suggestion.kind` is the one change to an *existing* type — everything else
is additive. The `apply` step already branches on how a suggestion gets
implemented (`coding/agent.ts` vs. nothing); adding a `kind` field makes
that branch explicit instead of implicit in what fields are populated.

## 5. Human approval gate: unchanged shape, new "apply" targets

Audit's non-negotiable — nothing publishes without explicit approval — holds
exactly as-is for Beacon. What changes is what "apply" does per suggestion
kind: a `code-fix` still becomes a PR (`coding/github.ts`); a `profile-post`
or `review-reply` calls the Business Profile API instead. `routes/apply.ts`'s
job becomes dispatching on `suggestion.kind` rather than assuming every
suggestion is a code fix — a small, mechanical change to that route, not a
new approval model.

## 6. Paid vs. open-source accounting (extending `ARCHITECTURE.md` §6)

| Capability | Paid? | Notes |
|---|---|---|
| Continuous re-audit | No new cost | Same OpenRouter usage as Audit, just recurring |
| AI visibility tracking | No new cost | OpenRouter only — this is the standout free-to-build capability |
| Business profile + reviews | Free API, customer OAuth | No system-level key; the "cost" is engineering (OAuth flow), not a bill |
| Directories | **Paid, no OSS equivalent** | Recommend an optional aggregator integration, clearly flagged, or deferred entirely (§3.5) |
| Map-position / rank tracking | **Paid, no OSS equivalent** | Deferred out of v1 |
| Shopping catalogue schema | No new cost | Reuses existing schema-generation pattern |

## 7. Phased build plan

**Phase B1 — ship value with zero new infrastructure.**
Continuous re-audit (§3.1) as a cron job against a fixed config list (no
workspace/connection model yet — reuse Audit's one-shot model, just
scheduled), plus AI visibility tracking (§3.2). Both are pure extensions of
`backend/` as it exists today. This is the natural "next PR" after this
architecture doc.

**Phase B2 — round out the site-level story.**
Diffing polish on re-audits (change-over-time reporting), shopping
catalogue schema (§3.6). Still no multi-tenancy required.

**Phase B3 — the multi-tenancy line.**
`Workspace`/`Connection` model, Postgres migration (§2), Business Profile
OAuth + profile posts (§3.3). This is where the database upgrade flagged in
`ARCHITECTURE.md` §9 actually has to happen.

**Phase B4 — reviews, and the Guard dependency.**
Reviews (§3.4), which shares Phase B3's OAuth grant. Autonomous reply
publishing waits on a minimal Guard (claim/compliance check) even if
drafting + human approval doesn't.

**Deferred / needs a product decision, not just engineering:**
Directories (§3.5) — pay for an aggregator, or drop it from Beacon's v1
scope. Recommend deciding this before Phase B3, since it affects whether
Beacon's OAuth/connections model needs to support a third provider type.

## 8. What this document deliberately doesn't do

It doesn't write any Beacon code — per the ask, this PR is the architecture
pass only, the same way Audit started with `ARCHITECTURE.md` before
`backend/` existed. Phase B1 (§7) is the recommended scope for the next
implementation PR.
