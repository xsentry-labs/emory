# Emory Growth

A growth agent for anyone who sells a service (agencies, B2B startups, consultants, and so on). It finds leads, researches them, qualifies and ranks them (ICP fit + BANT), runs outreach, and follows up until a lead becomes a conversation or a meeting. Every outbound message waits for human approval.

Emory Marketing (executing marketing for a customer's own clients) is a possible second product and is not built.

## Architecture

One deployable unit: a single Railway container with a volume.

- **Next.js 14** serves the UI and the API (server actions, `/api/health`).
- **SQLite** (`better-sqlite3`, WAL) at `$DATA_DIR/emory.db`. Migrations run on startup (`lib/db.ts`).
- **Worker** runs in-process, started from `instrumentation.ts`. Each tick it queues follow-up *drafts* for approval, sends approved emails, and polls the inbox for replies (the last two only when configured, below).
- **Qualification**: ICP fit plus BANT, each rated 0-3 and combined into a 0-100 score and A/B/C tier (`lib/qualify.ts`). Leads are ranked by score. What you sell and who it is for lives in the `profile` table (Offer & ICP page).
- **LLM**: calls go through OpenRouter (`lib/llm.ts`, default model `openai/gpt-6-luna`, override with `OPENROUTER_MODEL`). AI drafting (`lib/draft.ts`) writes into the Approvals queue; it needs `OPENROUTER_API_KEY`.
- **Research**: "Research & score with AI" on a lead fetches its website (SSRF-guarded, `lib/safeFetch.ts`), has the LLM rate ICP fit and BANT against your offer/ICP, and stores the summary, rationale and score (`lib/research.ts`). Ratings stay editable by hand.
- **Sending**: the worker emails approved messages over SMTP (`lib/send.ts`, `lib/mailer.ts`). Off unless `SMTP_URL` and `FROM_EMAIL` are set. It only sends what a human approved, caps volume (`SEND_DAILY_CAP`, rolling 24h), retries a failure up to 3 times, threads follow-ups onto earlier emails, skips leads without a valid address, and never sends a follow-up after the lead replied. Set `EMAIL_FOOTER` to add your postal address and an opt-out line to every email.
- **Replies**: the worker polls an IMAP inbox (`lib/imap.ts`, off unless `IMAP_HOST`/`IMAP_USER`/`IMAP_PASS` are set) and logs replies to the right lead, matched by `In-Reply-To`/`References` and falling back to the sender address (`lib/inbound.ts`). Quoted text is stripped; out-of-office, bounces and duplicates are ignored. A logged reply marks the lead `replied` and stops follow-ups. It tracks the last UID and starts from "now" on first run, so old mail is not imported; read/unread flags are untouched.
- **Auth**: one shared `ADMIN_PASSWORD` over HTTP Basic Auth (`middleware.ts`). `/api/health` is open.

The SQLite file lives on the volume, so run exactly **one replica** (set in `railway.json`).

## Not built yet

- Lead sourcing (leads are added by hand; the `source` field records where they came from).

## Develop

```bash
cp .env.example .env.local
npm install
npm run dev        # http://localhost:3000
npm test
npm run typecheck
```

Requires Node 22+.

## Deploy to Railway

1. New service from this repo (it uses the `Dockerfile`).
2. Add a **volume** and mount it at `/data`.
3. Set variables: `ADMIN_PASSWORD` (required), `DATA_DIR=/data` (already the image default).
4. Keep replicas at 1. Health check is `/api/health`.
