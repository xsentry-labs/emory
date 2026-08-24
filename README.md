# Emory

**The only marketing team you'll need.**

Eleven AI agents that get you found, talk to your customers, and close them.
One brain that learns your business and never forgets it.

This is a clickable product prototype built against the three canon documents —
*Strategy & Architecture v4.0*, *Agent Architecture v1.0* and the *Positioning &
Messaging Bible v1.0*. **Mock data only**: no backend, no auth, no external
calls. Every interaction is real and stateful, and state survives navigation and
a page reload (localStorage).

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

`npm run build` / `npm start` for production, `npm run typecheck` for types.

Start at `/`, put any domain into the field (`acme.com` or
`https://acme.com/pricing`, both work). The domain and company name are
substituted through the analysis, the Brain, the queue and the timeline, so the
whole prototype reads as if it were built for that site.

## Deploy to Vercel

The repo is ready to deploy as-is — no environment variables, no external
services.

**From the dashboard (easiest to share):**

1. [vercel.com/new](https://vercel.com/new) → Import Git Repository → pick this
   repo.
2. Framework preset is detected as **Next.js**. Leave every default alone.
3. Deploy. Vercel builds `main` and gives you a production URL, plus a preview
   URL for every branch and pull request.

**From the CLI:**

```bash
npx vercel          # preview deployment, shareable link
npx vercel --prod   # production deployment
```

`vercel.json` pins the framework, build command and a few security headers.
`.nvmrc` and the `engines` field keep the build on Node 22 (Node 20+ works).
Nothing else is required — there is no database, no API key, no secret.

To point your partner at a specific branch, deploy from that branch
(`npx vercel --prod` on the branch, or open a pull request and use the preview
URL Vercel comments on it).

## What's in it

**Before the account exists**

| Route | What it is |
| --- | --- |
| `/` | The landing page. One field, one action. Eleven agents on the same screen as the claim, the customer timeline as a worked example, an interactive replacement calculator, pricing. |
| `/audit` | **Emory Audit** — free, no signup. Visible analysis, a health score, findings written in business language with what each is costing, and the agent that repairs each one. Audit never fixes anything. Email is asked for after the value, never before. |
| `/onboarding` | Three steps: correct what Emory inferred (least certain first, never a blank form), connect what you already use (skippable, degrades gracefully), then the first queue of things to approve. |

**Inside the account**

| Route | What it is |
| --- | --- |
| `/today` | Owner view. Four numbers, what is waiting on you, what shipped this week, what the Brain learned, what is not yet in your queue. |
| `/approvals` | The trust surface. Every action shows what, why, expected impact, owning agent colour and one tap to approve. Edit the wording, decline, undo. Risk is classified: low can be promoted to run without asking (per action type), high needs an explicit confirmation. Guard's blocks are shown beside the queue. |
| `/brain` | Everything Emory knows, grouped, each field with a confidence and where it came from — and editable, because letting people correct it is the point. Second tab is the change log: what changed, why, and which agent learned it. |
| `/agents` | Eleven agents, their colour, what each handles, standalone pricing, and an activation month for the ones that are not live yet. |
| `/customers` | One person, one scroll: assistant answer → website → chat → consent check → CRM → call → payment → attribution. The screen no separate-products stack can render. |
| `/revenue` | Where revenue actually came from, including the third of "Direct" that is AI assistants, the experiments behind those numbers, and the monthly Proof report. |
| `/connections` | Read and write connections, which agents each one feeds, and health — including a token that is about to expire, because a silently dead connection looks exactly like a channel that stopped working. |

## Canon this build follows

- **Category**: an AI marketing team. Not a platform, not a suite, not a
  dashboard, not an AI CMO.
- **Only Emory speaks.** The eleven agents are functions, not personalities.
  They appear as a name and a colour on the thing they own; they never address
  the customer.
- **Colour is functional.** The brand is black and white (`#0D0D0F` on
  `#FFFFFF`, `#F7F8F9` wash, `#E6E9EC` rules, `#6F7883` secondary text). The
  only colour in the product is the eleven agent hexes, used flat, only where
  an agent owns what is being shown.
- **Motion in two places only**: the analysis running, and state changes in the
  approval queue. Everything else is static, and `prefers-reduced-motion` is
  respected.
- **Vocabulary**: get found, get recommended by AI, know what worked. Never
  "SEO", "GEO", "attribution", "schema", "AI-powered", "all-in-one", or a saving
  percentage. Approved strings from the copy bank are used verbatim.
- **Nothing runs without approval**, everything is reversible, and autonomy is
  granted one low-risk action type at a time.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind (custom theme, no default
palette) · shadcn/ui primitives restyled to the tokens · Zustand + localStorage ·
lucide-react · next/font (Newsreader for display, Inter for everything else).

No animation library: the two allowed motions are CSS keyframes, which keeps the
bundle honest against the design rule.

## Where things live

```
app/
  page.tsx              landing
  audit/                the free analysis
  onboarding/           correct → connect → first queue
  (app)/                everything behind the shell
components/
  approvals/            action card, risk classes
  audit/ brain/ agents/ customers/ revenue/ connections/ onboarding/ today/
  shell/                side nav, top bar, mobile nav
  ui/                   shadcn primitives, restyled
lib/
  agents.ts             the eleven agents, colours, capabilities, pricing
  mock-data.ts          audit, actions, brain, changes, people, timeline, revenue, connections
  store.ts              Zustand store; every mutation goes through it
  types.ts  utils.ts
```

Every mutation — approve, decline, undo, edit wording, promote an action type to
run on its own, correct a Brain field, connect or disconnect — is a store
action, so the queue count in the nav, the Today screen, the Brain change log
and the top bar all stay in step.

## Prototype boundaries

Nothing is published, sent or changed anywhere. "Approve", "Connect" and "Send
this month's report" mutate local state and tell you what happened.
`Connections → Reset this demo` puts everything back to day one.
