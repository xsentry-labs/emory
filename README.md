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
- **Website and plans**: `/` and `/pricing` are a public marketing site (`app/(site)`); signed-in users who open `/` go straight to the app. Plans live in `lib/pricing.ts` (Free $0, Starter $49, Growth $149, Scale custom; **prices are proposals**, edit them there). Each plan has monthly allowances for leads found, SEO audits and AI drafts/content, enforced in `lib/quota.ts` at the point where the work happens (lead sourcing, audit start, single-lead AI actions), and shown in the sidebar. New workspaces start on `DEFAULT_PLAN` (default `free`; set `growth` to run a pilot without limits in the way). There is no card billing yet: admins listed in `ADMIN_EMAILS` change a workspace's plan on `/admin`, and paid-plan buttons open an email to `CONTACT_EMAIL`.
- **Server mailbox**: the SMTP/IMAP mailbox from the environment belongs to ONE workspace, named by `SENDING_WORKSPACE_ID`; all others copy approved drafts into their own mail app. Without that variable nothing is sent from the server.

The SQLite file lives on the volume, so run exactly **one replica** (set in `railway.json`).

## Leads: find, people, accounts, approaches

- **Accounts and people**: every lead (a row in `prospects`) belongs to an account (`accounts`, `lib/leads/accounts.ts`). Leads from before accounts existed were grouped into one account per company by the migration; `createProspect` attaches new ones by domain or name.
- **Find** (`/leads`, `lib/leads/find.ts`): a plain-English description becomes Apollo company filters (shown back as chips), the search runs on Apollo (`lib/integrations/apollo.ts`), and the model rates each company 0-100 with a one-line reason. Under 40 is kept but marked dropped, with the reason. The same description pages forward on "find more"; known companies are skipped. Stored companies count toward "leads found". Without `APOLLO_API_KEY`, find uses the earlier AI web search pipeline.
- **People and org chart** (`/accounts/:id`, `lib/leads/people.ts`): Apollo lists people at the account by the titles in the description; the model guesses reporting lines and buying roles (decides, champion, uses it, budget). Guessed lines are drawn dashed. Confirming or correcting a line marks it verified, and a redraw never overwrites it. Loops are cut.
- **Emails** (`/leads/people`): work emails are revealed through Apollo only when you ask (one plan "email found" each; personal emails are never requested). Each email records its source and status: verified, risky (guessed), not found, or manual (typed by you). **The sender never sends to a risky or not-found address.**
- **Approaches** (`/accounts/:id/approach`, `lib/leads/approach.ts`): tick people on the chart and the model proposes an angle and 1-4 touches per person over up to 30 days. Nothing happens until you approve. Then the worker drafts each email step when due, into the normal approval queue, with three account rules: at most one person emailed per day, the whole plan pauses if anyone replies, and only verified or typed emails get email steps (others are skipped and say why). Calls, LinkedIn and meetings are tasks for you in "today".

## Site: fixes, pull requests and results

- **Issues** (`/site`): every audit upserts one issue per rule (`lib/site/issues.ts`). An open or in-PR issue that a later crawl no longer finds closes as fixed; one that comes back reopens. Issues are grouped as code, content, server or redirects (`lib/seo/categories.ts`).
- **Mobile speed**: audits and the public report run PageSpeed Insights on the homepage (`lib/integrations/pagespeed.ts`); a score under 90 becomes an issue. A PageSpeed failure never fails the audit.
- **Pull requests** (`/site/fixes`): with the GitHub App installed and a repository chosen, tick code issues and Emory reads the repo, has the model propose minimal edits (at most 4 files, each validated against the real file: no unknown paths, no no-ops, no wholesale rewrites), and opens **one PR per batch** on an `emory/seo-*` branch (`lib/site/fixes.ts`). Emory never merges. The worker syncs PR state every 5 minutes; a merge schedules a re-crawl 15 minutes later, which is what closes the issues. Closing a PR unmerged reopens its issues.
- **Written steps**: any issue (and every one when no repo is connected) can get step-by-step instructions plus ready-to-paste copy.
- **Results** (`/site/results`): Search Console clicks, impressions and position per page per day are synced daily into `gsc_daily` (16 weeks on first sync). Fixed pages compare two weeks either side of the fix and say "too early" until two weeks of data exist.
- **Nightly crawl**: the worker re-crawls any site whose last audit is over 24 hours old. Scheduled crawls don't count toward the plan's audit allowance.
- **Connections** are stored per workspace in `connections`; tokens are encrypted with AES-256-GCM (`lib/secrets.ts`). OAuth `state` is signed and bound to the workspace, provider and a 15-minute expiry.
- CMS drafts (WordPress, Webflow, Shopify) are not built yet; content issues get written steps.

### GitHub App

Create one at GitHub → Settings → Developer settings → GitHub Apps → New:

- **Homepage URL**: your `APP_URL`.
- **Callback URL** and **Setup URL**: `APP_URL/api/connect/github/callback`. Tick **Request user authorization (OAuth) during installation** (the callback uses it to confirm the installer can access the installation) and **Redirect on update**.
- **Webhook**: off (Emory polls).
- **Repository permissions**: Contents read & write, Pull requests read & write, Checks read-only, Metadata read-only.
- Generate a private key and a client secret. Set `GITHUB_APP_ID`, `GITHUB_APP_SLUG` (from the App's public URL), `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`.

### Google (Search Console)

In Google Cloud: enable the **Google Search Console API**, configure the OAuth consent screen with the scope `https://www.googleapis.com/auth/webmasters.readonly`, and create an **OAuth client ID** (web application) with the redirect URI `APP_URL/api/connect/google/callback`. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `APP_URL`. Optionally create an API key with the PageSpeed Insights API enabled and set `PAGESPEED_API_KEY`.

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
