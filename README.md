# Emory Growth

A growth agent for anyone who sells a service (agencies, B2B startups, consultants, and so on). It finds leads, researches them, qualifies and ranks them (ICP fit + BANT), runs outreach, and follows up until a lead becomes a conversation or a meeting. Every outbound message waits for human approval.

Emory Marketing (executing marketing for a customer's own clients) is a possible second product and is not built.

## How it works

1. **Your website** (`/start`): enter your URL.
2. **Your service**: describe what you do (up to 5,000 words) and optionally upload docs (PDF, TXT, MD, CSV, HTML; 5 files, 5 MB each). We build your offer and ideal customer profile from the website, text and documents (`lib/onboarding.ts`).
3. **Your leads** (`/leads`): a background pipeline (`lib/pipeline.ts`) finds leads for your ICP, then researches and scores each one (ICP fit + BANT) and writes its first outreach. The table fills in live (it polls `/api/leads`) and stays ranked by score. Approve outreach inline; approved messages are sent by the worker.

Open `/` to land on the right place: `/start` until onboarding is done, then `/leads`.

## Architecture

One deployable unit: a single Railway container with a volume.

- **Next.js 14** serves the UI and the API (server actions, `/api/health`).
- **SQLite** (`better-sqlite3`, WAL) at `$DATA_DIR/emory.db`. Migrations run on startup (`lib/db.ts`).
- **Worker** runs in-process, started from `instrumentation.ts`. Each tick it queues follow-up *drafts* for approval, sends approved emails, and polls the inbox for replies (the last two only when configured, below).
- **Qualification**: ICP fit plus BANT, each rated 0-3 and combined into a 0-100 score and A/B/C tier (`lib/qualify.ts`). Leads are ranked by score. What you sell and who it is for lives in the `profile` table (Offer & ICP page).
- **LLM**: calls go through OpenRouter (`lib/llm.ts`, default model `openai/gpt-6-luna`, override with `OPENROUTER_MODEL`). AI drafting (`lib/draft.ts`) writes into the Approvals queue; it needs `OPENROUTER_API_KEY`.
- **SEO agent** (`/seo`, `lib/seo/`): crawls the site (up to 12 pages, seeded from the sitemap, public addresses only), runs ~20 deterministic checks (titles, descriptions, H1, mobile viewport, canonicals, alt text, duplicates, thin pages, HTTPS, robots.txt, sitemap, structured data, speed), scores it 0-100, and has the model write a prioritised fix plan with ready-to-paste titles, descriptions and schema. Findings still appear if the AI step fails. Limited to 3 audits per workspace per day.
- **Content agent** (`/content`, `lib/content.ts`): suggests blog topics for the ideal customer, turns a topic into a full Markdown draft (with meta description and slug) you can edit, and drafts a week of X posts (280-character limit enforced). Everything is a draft for the user to copy and publish; nothing posts automatically. Prompts forbid invented statistics, clients or results. Each generation counts as one AI action toward the daily cap.
- **Reddit agent** (`/reddit`): a locked preview with clearly labelled example data; not live.
- **Lead sourcing**: "Find leads with AI" uses OpenRouter's web search (`openRouterSearch`) to propose businesses matching your ICP (`lib/sourcing.ts`). A lead is added only if its website is one of the pages the search cited; duplicates (same site or email) are skipped; emails are kept only if shown publicly. New leads are unscored until you run research.
- **Research**: "Research & score with AI" on a lead fetches its website (SSRF-guarded, `lib/safeFetch.ts`), has the LLM rate ICP fit and BANT against your offer/ICP, and stores the summary, rationale and score (`lib/research.ts`). Ratings stay editable by hand.
- **Sending**: the worker emails approved messages over SMTP (`lib/send.ts`, `lib/mailer.ts`). Off unless `SMTP_URL` and `FROM_EMAIL` are set. It only sends what a human approved, caps volume (`SEND_DAILY_CAP`, rolling 24h), retries a failure up to 3 times, threads follow-ups onto earlier emails, skips leads without a valid address, and never sends a follow-up after the lead replied. Set `EMAIL_FOOTER` to add your postal address and an opt-out line to every email.
- **Replies**: the worker polls an IMAP inbox (`lib/imap.ts`, off unless `IMAP_HOST`/`IMAP_USER`/`IMAP_PASS` are set) and logs replies to the right lead, matched by `In-Reply-To`/`References` and falling back to the sender address (`lib/inbound.ts`). Quoted text is stripped; out-of-office, bounces and duplicates are ignored. A logged reply marks the lead `replied` and stops follow-ups. It tracks the last UID and starts from "now" on first run, so old mail is not imported; read/unread flags are untouched.
- **Accounts and isolation**: users sign up with email, password and a shared `INVITE_CODE` (`app/auth/actions.ts`). Logins live in `accounts.db`; **every workspace has its own SQLite file** (`workspaces/<id>.db`), so one customer's data can never appear in another's. Sessions are signed cookies verified in `middleware.ts`, which also stamps the verified workspace onto the request. `/api/health` is open. Data from the earlier single-user version is moved to workspace 1, and the first person to sign up owns it.
- **Spend guard**: each workspace is capped per UTC day (`lib/usage.ts`): 3 lead hunts, 5 business setups, 40 other AI actions (override with `LIMIT_*` variables).
- **Server mailbox**: the SMTP/IMAP mailbox from the environment belongs to ONE workspace, named by `SENDING_WORKSPACE_ID`; all others copy approved drafts into their own mail app. Without that variable nothing is sent from the server.

The SQLite file lives on the volume, so run exactly **one replica** (set in `railway.json`).

## Limits

- Lead sourcing quality depends on the model and its web search; always review new leads. Most sourced leads will have no public email, so add one before they can be emailed.
- Replies from a different address than the lead's (forwarded, assistant) that don't thread are not matched.
- There is no unsubscribe handling beyond the footer text you configure.

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
3. Set variables: `SESSION_SECRET` (required, a long random string), `INVITE_CODE` (required to allow sign-ups), `OPENROUTER_API_KEY`, and `DATA_DIR=/data` (already the image default). `ADMIN_PASSWORD` from older deployments still works as the session secret.
4. Keep replicas at 1. Health check is `/api/health`.
