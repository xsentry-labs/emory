# emory — The Daily Growth Wire

An AI CMO prototype, framed as a newsroom wire service. You give it a website;
it builds a company profile and strategy documents, then puts eight marketing
desks on the beat. The desks file **dispatches** — SEO, GEO/AI-answer
visibility, Reddit, X, LinkedIn, longform, Hacker News and technical SEO — into
a live feed you approve, edit or spike.

This is an internal-review prototype: **mock data only**, no backend, no auth,
no external API calls. Every interaction is real and stateful, and state
persists across navigation and page reloads via localStorage.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

`npm run build` / `npm start` for a production build, `npm run typecheck` for
types.

First load drops you at `/onboarding`. Type any domain (`acme.com`,
`https://acme.com/pricing` — both work) and the desks file against it: the
domain and brand name are substituted through the dispatches, strategy
documents and keyword list, so the whole app reads as if it were written for
that site.

## Routes

| Route | What it is |
| --- | --- |
| `/onboarding` | Full-screen flow: domain entry, staged filing sequence, then the feed |
| `/feed` | The wire — filter tabs, desk filters, approve / edit / spike, live edition stats |
| `/strategy` | Strategy room — position, house voice, competitor landscape, six readable documents |
| `/seo` | Audit desk — overall and sub-scores, severity-coded fault log, keyword gaps |
| `/integrations` | Wire room — connect/disconnect the feeds behind each desk |
| `/profile` | Company profile — domain, vertical, audience, voice tags, goal, position |

Deep links work: the audit desk's "Draft fix filed" buttons open
`/feed?dispatch=…` and highlight that filing; its keyword panel links to
`/feed?desk=seo`.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind (custom theme, no default
palette) · shadcn/ui primitives restyled to the wire tokens · Framer Motion ·
Zustand + localStorage · lucide-react · next/font (Source Serif 4, IBM Plex
Mono, Inter).

## Where things live

```
app/
  onboarding/page.tsx        full-screen filing flow
  (wire)/                    everything behind the masthead + sidebar shell
components/
  shell/                     masthead, sidebar contents, mobile nav, page shell
  feed/                      dispatch card, edit sheet, edition rail, urgent stamp
  strategy/ seo/ integrations/ profile/
  ui/                        shadcn primitives, restyled
lib/
  mock-data.ts               desks, dispatches, docs, competitors, issues, gaps, feeds
  store.ts                   Zustand store + actions; every mutation goes through here
  types.ts  utils.ts
```

Every mutation — approve, push live, spike, restore, edit, connect, save
profile, reset — is a store action, so the feed, masthead, sidebar counts,
ticker and stat rail all stay in step.

## Design notes

- Tokens: paper `#EEEAE1`, ink `#1B1D22`, hairline `#DCD5C4`, wire-red
  `#B31B1B`, teletype-green `#2F6E4F`, plus one accent per desk. Defined as HSL
  CSS variables in `app/globals.css` and mapped in `tailwind.config.ts`.
- Type: Source Serif 4 for headlines and body copy, IBM Plex Mono for desk
  tags, timestamps, labels and numerals (uppercase, 0.12–0.2em tracking), Inter
  for UI. The Tailwind size ramp is a ~1.22 modular scale, not the default.
- Motion: page transitions, staggered list entry, an approve stamp that lands
  before the card leaves the pending list. All of it respects
  `prefers-reduced-motion`.
- Responsive: the sidebar becomes a bottom nav below 768px, cards reflow to a
  single column, and the edit drawer swaps between a dialog and a bottom sheet.

## Prototype boundaries

Nothing is published anywhere. "Approve", "push to the wire", "connect" and
"hand to engineering" all mutate local state and tell you what happened.
`Company Profile → Reset the wire` re-files the seed edition for a fresh demo
run.
