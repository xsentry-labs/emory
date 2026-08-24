import type {
  BrandVoiceRule,
  Competitor,
  CompanyProfile,
  Desk,
  Dispatch,
  Integration,
  KeywordGap,
  SeoIssue,
  StrategyDoc,
} from "./types";

/**
 * Every string below may carry {{brand}} / {{domain}} tokens. They are resolved
 * once, when the store seeds itself from the domain typed at onboarding, so the
 * whole wire reads as if the desks really did file on that site.
 */
export const BRAND_TOKEN = /\{\{(brand|domain)\}\}/g;

export function hydrate<T>(value: T, brand: string, domain: string): T {
  if (typeof value === "string") {
    return value.replace(BRAND_TOKEN, (_m, key) =>
      key === "brand" ? brand : domain,
    ) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => hydrate(item, brand, domain)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = hydrate(item, brand, domain);
    }
    return out as T;
  }
  return value;
}

/** Brand name inferred from the filed domain: "northbeam.io" -> "Northbeam". */
export function brandFromDomain(domain: string) {
  const root = domain.split(".")[0]?.replace(/[-_]/g, " ") ?? "the brand";
  return root
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const ago = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

export const DESKS: Desk[] = [
  {
    id: "seo",
    tag: "SEO DESK",
    name: "Search",
    beat: "Rankings, SERP movement and the pages worth writing next.",
    dot: "bg-desk-gold",
    text: "text-desk-gold",
    chip: "bg-desk-gold/10 text-desk-gold",
    rule: "border-desk-gold",
    icon: "search",
  },
  {
    id: "geo",
    tag: "GEO DESK",
    name: "AI Answers",
    beat: "How ChatGPT, Perplexity and AI Overviews describe you — or don't.",
    dot: "bg-desk-purple",
    text: "text-desk-purple",
    chip: "bg-desk-purple/10 text-desk-purple",
    rule: "border-desk-purple",
    icon: "sparkles",
  },
  {
    id: "reddit",
    tag: "REDDIT DESK",
    name: "Reddit",
    beat: "Threads where buyers ask for a tool like yours by name.",
    dot: "bg-wire-red",
    text: "text-wire-red",
    chip: "bg-wire-red/10 text-wire-red",
    rule: "border-wire-red",
    icon: "messages",
  },
  {
    id: "x",
    tag: "X DESK",
    name: "X / Twitter",
    beat: "Timeline moments where a reply lands better than a post.",
    dot: "bg-ink",
    text: "text-ink",
    chip: "bg-ink/10 text-ink",
    rule: "border-ink",
    icon: "hash",
  },
  {
    id: "linkedin",
    tag: "LINKEDIN DESK",
    name: "LinkedIn",
    beat: "Founder and operator posts aimed at the buying committee.",
    dot: "bg-desk-navy",
    text: "text-desk-navy",
    chip: "bg-desk-navy/10 text-desk-navy",
    rule: "border-desk-navy",
    icon: "briefcase",
  },
  {
    id: "articles",
    tag: "FEATURES DESK",
    name: "Longform",
    beat: "Articles, teardowns and original data worth a byline.",
    dot: "bg-desk-teal",
    text: "text-desk-teal",
    chip: "bg-desk-teal/10 text-desk-teal",
    rule: "border-desk-teal",
    icon: "newspaper",
  },
  {
    id: "hn",
    tag: "HN DESK",
    name: "Hacker News",
    beat: "Front-page threads where an honest technical answer travels.",
    dot: "bg-desk-orange",
    text: "text-desk-orange",
    chip: "bg-desk-orange/10 text-desk-orange",
    rule: "border-desk-orange",
    icon: "flame",
  },
  {
    id: "technical",
    tag: "TECH DESK",
    name: "Technical SEO",
    beat: "Crawl, render and Core Web Vitals faults that cap everything else.",
    dot: "bg-slate",
    text: "text-slate",
    chip: "bg-slate/10 text-slate",
    rule: "border-slate",
    icon: "wrench",
  },
];

export const DESK_BY_ID = Object.fromEntries(
  DESKS.map((desk) => [desk.id, desk]),
) as Record<Desk["id"], Desk>;

export const SEED_DISPATCHES: Dispatch[] = [
  {
    id: "dsp-001",
    deskId: "geo",
    kicker: "AI ANSWER VISIBILITY",
    headline:
      "ChatGPT names three rivals and not {{brand}} on the buying question that matters",
    body: "Across 40 runs of “best tools for automated marketing reporting,” ChatGPT cited Ravelin, Northsound and Cadence — {{brand}} appeared in 4 of 40. The models are pulling from three comparison round-ups none of which include us, plus a G2 category page where our profile is thin.\n\nRecommended filing: publish a source-grade comparison page at {{domain}}/compare that answers the question directly in the first 80 words, with a specification table the models can lift verbatim. Then pitch the two round-up editors with a factual correction and a screenshot of the missing row.\n\nDraft opener: “{{brand}} automates the weekly marketing report end to end — pulling spend, pipeline and attribution into one reviewable brief. Here is how it compares with the three tools most often recommended alongside it.”",
    source: "40-run answer sweep · ChatGPT, Perplexity, Claude, AI Overviews",
    impact: {
      label: "Answer share",
      value: "10% → 55%",
      note: "Projected within two crawls of the comparison page going live",
    },
    priority: "urgent",
    status: "pending",
    filedAt: ago(22),
    tags: ["comparison page", "answer engines", "category"],
  },
  {
    id: "dsp-002",
    deskId: "seo",
    kicker: "SERP MOVEMENT",
    headline:
      "Cadence took page one for “{{brand}} alternative” overnight — file the counter-page today",
    body: "Cadence published /alternatives/{{brand}} eleven days ago and it now sits at position 4 for eight branded-alternative queries worth 2,900 searches a month combined. Our own comparison content is a single paragraph on the pricing page.\n\nRecommended filing: a proper /alternatives page under our control that concedes the two things Cadence genuinely does better, then wins on the three that decide the deal — migration time, per-seat cost at 20+ seats, and the audit trail. Honest comparison pages outrank defensive ones; the desk has the objection language pulled from 60 sales-call notes.\n\nStructure filed: verdict box up top, spec table, “when Cadence is the better buy” section, migration checklist, FAQ marked up with schema.",
    source: "Daily rank tracker · 8 branded queries",
    impact: {
      label: "Recoverable clicks",
      value: "+1,240/mo",
      note: "Position 4→1 on the branded-alternative cluster",
    },
    priority: "urgent",
    status: "pending",
    filedAt: ago(46),
    tags: ["competitive", "bottom of funnel", "page brief"],
  },
  {
    id: "dsp-003",
    deskId: "technical",
    kicker: "CRAWL FAULT",
    headline:
      "Blog pagination is serving noindex past page 2 — 190 posts are invisible",
    body: "The rendered HTML on {{domain}}/blog/page/3 and beyond carries <meta name=\"robots\" content=\"noindex,follow\">, applied by a template condition that was meant to hide tag archives. 190 published posts have no crawlable path from the blog index; 41 of them still hold rankings from internal links alone.\n\nFix ready for review: remove the condition from the pagination template, keep it on /blog/tag/*, then submit the recovered URLs in a fresh sitemap. The tech desk has the one-line template diff and a before/after crawl of 200 URLs attached.\n\nThis is the highest-leverage item on the wire this week: every content dispatch we approve compounds on top of a blog that is currently half-crawlable.",
    source: "Nightly crawl · 4,180 URLs · diff vs. last Tuesday",
    impact: {
      label: "Pages recovered",
      value: "190",
      note: "41 already ranking despite being uncrawlable",
    },
    priority: "urgent",
    status: "pending",
    filedAt: ago(95),
    tags: ["indexation", "one-line fix", "blog"],
  },
  {
    id: "dsp-004",
    deskId: "reddit",
    kicker: "THREAD IN PLAY",
    headline:
      "r/SaaS thread asking exactly what {{brand}} does is 90 minutes old and climbing",
    body: "Thread: “How are you handling weekly marketing reporting without a full-time analyst?” — 34 comments, top comment recommends doing it by hand in Sheets. The asker runs a 30-person B2B company, which is dead centre of our ICP.\n\nDraft reply (from the founder account, disclosed): “We built {{brand}} because we were the person doing this by hand every Monday. Two things that helped before you buy anything: pick the four numbers you will actually act on, and write the commentary before you look at the charts. If you want it automated after that, mine is at {{domain}} — happy to answer setup questions either way.”\n\nHouse rule respected: disclosure in the first line, one link, and genuine advice that stands on its own if the link is stripped.",
    source: "r/SaaS · 34 comments · rising",
    impact: {
      label: "Thread reach",
      value: "12k views",
      note: "Median for a rising r/SaaS thread at this comment velocity",
    },
    priority: "standard",
    status: "pending",
    filedAt: ago(88),
    tags: ["community", "founder voice", "time-sensitive"],
  },
  {
    id: "dsp-005",
    deskId: "x",
    kicker: "TIMELINE MOMENT",
    headline: "A 400-repost thread on dashboard fatigue is missing our answer",
    body: "@priyabuilds posted “nobody reads the dashboard. they read the one sentence someone writes above it.” — 412 reposts, and the replies are full of our exact buyers arguing about it.\n\nDraft reply: “This is the whole reason we stopped shipping dashboards. The weekly brief that says ‘spend is up 12% because the retargeting cap lifted on Tuesday’ gets read by the whole exec team. The chart underneath it gets read by nobody. We wrote up what changed when we flipped the order: {{domain}}/brief”\n\nThe desk recommends replying rather than quote-posting — quote-posts of a popular take read as piggybacking, replies read as participating.",
    source: "X · 412 reposts · in-network account",
    impact: {
      label: "Est. impressions",
      value: "38k",
      note: "Reply position 6 on a thread this size",
    },
    priority: "standard",
    status: "pending",
    filedAt: ago(140),
    tags: ["reply not post", "founder account"],
  },
  {
    id: "dsp-006",
    deskId: "linkedin",
    kicker: "OPERATOR POST",
    headline:
      "File the “we killed our own dashboard” post while the category is arguing about it",
    body: "Three of the accounts our buyers follow posted about reporting overload this week. The window is open for a first-person operator post rather than a product one.\n\nDraft: “We deleted the dashboard we spent four months building.\n\nNot because it was bad. Because eleven people had access and two opened it in a month.\n\nWhat replaced it: one page, sent Monday 7am. Four numbers, and a paragraph explaining why each moved. Written by a machine, edited by a human in about six minutes.\n\nThe uncomfortable part: the paragraph was always the product. The charts were decoration we were proud of.\n\nIf your team has a dashboard nobody opens, the fix probably is not a better dashboard.”\n\nNo link in the post body; link in the first comment, per platform reach behaviour.",
    source: "Feed scan · 3 in-network posts on the theme this week",
    impact: {
      label: "Est. reach",
      value: "9.4k",
      note: "Founder account baseline × 2.1 for first-person posts",
    },
    priority: "standard",
    status: "pending",
    filedAt: ago(210),
    tags: ["founder voice", "no link in body"],
  },
  {
    id: "dsp-007",
    deskId: "hn",
    kicker: "FRONT PAGE",
    headline:
      "“Ask HN: what broke when you automated your reporting?” is at #14 with 96 comments",
    body: "The thread rewards specifics and punishes marketing language, so the desk has drafted a comment with real numbers and a real failure in it.\n\nDraft: “We automate weekly marketing reports, so: the thing that broke for us was attribution windows. Our first version recomputed a 30-day window every run, so a report sent Monday disagreed with the same report re-run Thursday, and people stopped trusting it faster than we could explain why. We froze the window at send time and stored the snapshot. Boring fix, but trust in an automated report is binary — once two runs disagree you are back to Sheets.”\n\nNo link. HN converts on credibility, not clicks; the profile URL does the work.",
    source: "Hacker News · #14 · 96 comments",
    impact: {
      label: "Qualified reach",
      value: "6.8k devs",
      note: "Front-page thread, technical buyer overlap 40%",
    },
    priority: "wire",
    status: "pending",
    filedAt: ago(260),
    tags: ["no link", "credibility play"],
  },
  {
    id: "dsp-008",
    deskId: "articles",
    kicker: "ORIGINAL DATA",
    headline:
      "Teardown: we read 200 weekly marketing reports so nobody else has to",
    body: "A 1,800-word feature built on the 200 anonymised reports in our own corpus. The finding that carries the piece: 71% of reports open with a chart, and the ones that get replies open with a sentence.\n\nOutline filed:\n1. The Monday ritual nobody defends\n2. What 200 reports actually contain (chart of section frequency)\n3. The 12% that get replies — what they do differently\n4. A template you can steal, with the commentary slots marked\n5. What we automated and what we deliberately left to a human\n\nOriginal data is the linkable asset here — the desk expects the section-frequency chart to be the thing people cite. Publish on {{domain}}/research, then file the LinkedIn and X cut-downs off the same piece.",
    source: "Internal corpus · 200 anonymised reports",
    impact: {
      label: "Referring domains",
      value: "+18 est.",
      note: "Original-data features average 18 links in 90 days",
    },
    priority: "standard",
    status: "approved",
    filedAt: ago(1_500),
    tags: ["original research", "linkable asset"],
  },
  {
    id: "dsp-009",
    deskId: "seo",
    kicker: "PAGE BRIEF",
    headline: "Build the “marketing report template” hub — 4,400 searches, nobody owns it",
    body: "The top three results are all thin blog posts with no downloadable asset; the SERP has a featured snippet nobody has claimed properly and a People Also Ask block with six questions we can answer on one page.\n\nBrief approved and filed to the queue: a hub page with the template embedded, six PAA answers marked up with FAQ schema, and three internal links from the highest-authority blog posts we already have.\n\nTarget cluster: marketing report template (4,400), weekly marketing report (1,900), marketing report example (1,600).",
    source: "Keyword gap scan · cluster of 11 queries",
    impact: {
      label: "Cluster volume",
      value: "7,900/mo",
      note: "Difficulty 22 — lowest in the tracked set",
    },
    priority: "standard",
    status: "approved",
    filedAt: ago(2_600),
    tags: ["hub page", "schema", "top of funnel"],
  },
  {
    id: "dsp-010",
    deskId: "geo",
    kicker: "SOURCE CORRECTION",
    headline: "Perplexity is citing a 2023 pricing page that no longer exists",
    body: "Perplexity answers about {{brand}} pricing cite an archived page quoting a per-seat number we retired 14 months ago, and two aggregator sites are repeating it. Prospects are arriving pre-anchored to the wrong figure.\n\nApproved plan: publish a canonical, crawlable pricing page with the numbers in plain HTML text rather than inside a script-rendered table, add a dated “pricing last updated” line the models can read, and file correction requests with both aggregators.\n\nThe plain-text detail matters: our current table renders client-side, so the answer engines see an empty page and fall back to whatever is cached elsewhere.",
    source: "Answer sweep · 12 pricing prompts",
    impact: {
      label: "Corrected citations",
      value: "9 of 12",
      note: "Prompts currently returning stale pricing",
    },
    priority: "standard",
    status: "approved",
    filedAt: ago(3_100),
    tags: ["pricing", "citations", "rendering"],
  },
  {
    id: "dsp-011",
    deskId: "reddit",
    kicker: "RAN ON THE WIRE",
    headline: "Reply in r/marketing on attribution drift is the top comment",
    body: "Published Tuesday. The reply explained why re-running the same report produces different numbers and how to freeze the attribution window — no pitch, one link at the end.\n\nResult: top comment, 214 upvotes, 31 replies, and the moderator pinned a link to it in the weekly thread. Referral traffic to {{domain}} is 340 sessions with a 4:12 median time on page, which is roughly double our blog average.\n\nThe features desk has picked this up as the basis for a longer piece.",
    source: "r/marketing · published Tuesday 09:12",
    impact: {
      label: "Referral sessions",
      value: "340",
      note: "4:12 median time on page · 2× blog average",
    },
    priority: "standard",
    status: "live",
    filedAt: ago(4_400),
    tags: ["top comment", "published"],
  },
  {
    id: "dsp-012",
    deskId: "linkedin",
    kicker: "RAN ON THE WIRE",
    headline: "“Four numbers” post is the account's best-performing of the quarter",
    body: "Published Monday 07:40. 22,900 impressions, 187 reactions, 44 comments, 31 profile visits from named accounts on the target list — including two we have been trying to reach since February.\n\nThe comment thread turned into a de facto feature request list; the features desk has flagged three of them for the longform queue and the product team has the transcript.",
    source: "LinkedIn · founder account · Monday 07:40",
    impact: {
      label: "Impressions",
      value: "22.9k",
      note: "3.1× the account's rolling median",
    },
    priority: "standard",
    status: "live",
    filedAt: ago(5_900),
    tags: ["published", "inbound"],
  },
  {
    id: "dsp-013",
    deskId: "articles",
    kicker: "RAN ON THE WIRE",
    headline: "“The Monday report is a management problem, not a data problem”",
    body: "1,400 words, published to {{domain}}/blog nine days ago. Ranking position 6 for “weekly marketing report” after eight days, which is fast for a page with no external links yet.\n\nSix referring domains so far, two of them newsletters in the category. The desk recommends a follow-up piece rather than an update — the comment traffic is asking a different question than the article answers.",
    source: "{{domain}}/blog · published 9 days ago",
    impact: {
      label: "Position",
      value: "#6",
      note: "“weekly marketing report” · up from unranked",
    },
    priority: "standard",
    status: "live",
    filedAt: ago(12_600),
    tags: ["published", "ranking"],
  },
  {
    id: "dsp-014",
    deskId: "x",
    kicker: "RAN ON THE WIRE",
    headline: "Thread on report-writing latency picked up by two newsletters",
    body: "Six-post thread published last week on why reports get read when they arrive before the meeting rather than after it. 91k impressions, 640 reposts, and pickups in two operator newsletters with a combined 40k list.\n\n61 link clicks through to {{domain}}/brief and 14 trial starts attributed to the thread in the 72 hours after posting.",
    source: "X · 6-post thread · published last Thursday",
    impact: {
      label: "Trial starts",
      value: "14",
      note: "91k impressions · 640 reposts",
    },
    priority: "wire",
    status: "live",
    filedAt: ago(14_100),
    tags: ["published", "newsletter pickup"],
  },
];

export const SEED_PROFILE: CompanyProfile = {
  domain: "{{domain}}",
  brand: "{{brand}}",
  vertical: "B2B SaaS · Marketing analytics",
  audience:
    "Heads of marketing and founder-operators at 20–200 person B2B companies who own the weekly report but have no analyst.",
  voice: ["Plain-spoken", "Specific", "Operator-to-operator", "No hype"],
  goal: "Qualified trial starts from organic and community channels",
  positioning:
    "{{brand}} writes the weekly marketing report your team actually reads — numbers, commentary and the reason each one moved, delivered before the Monday meeting.",
};

export const BRAND_VOICE: BrandVoiceRule[] = [
  {
    do: "“Spend is up 12% because the retargeting cap lifted on Tuesday.”",
    dont: "“We leverage AI to unlock actionable marketing insights.”",
  },
  {
    do: "“Two runs of the same report disagreed. Here is why, and the fix.”",
    dont: "“Our best-in-class platform ensures data accuracy at scale.”",
  },
  {
    do: "“It takes about six minutes to edit. Most people send it unedited by week three.”",
    dont: "“Save countless hours with our revolutionary automation engine.”",
  },
  {
    do: "“Cadence is better if you need per-channel forecasting. We do not do that.”",
    dont: "“We are the only complete solution for modern marketing teams.”",
  },
];

export const STRATEGY_DOCS: StrategyDoc[] = [
  {
    id: "doc-positioning",
    title: "Positioning Brief",
    kind: "Foundation",
    summary:
      "Where {{brand}} sits in a crowded reporting category, and the one sentence every desk writes against.",
    updated: "Rewritten after the March pricing change",
    pages: 4,
    sections: [
      {
        heading: "The one-line position",
        paragraphs: [
          "{{brand}} writes the weekly marketing report your team actually reads — numbers, commentary and the reason each one moved, delivered before the Monday meeting.",
          "Everything the desks file is written against that sentence. When a draft could be published by a generic analytics vendor without changing a word, it goes back to the desk.",
        ],
      },
      {
        heading: "Category context",
        paragraphs: [
          "The reporting category splits three ways. Dashboard tools sell surface area and lose on adoption. BI platforms sell power and lose on time-to-value. Agencies sell the human write-up and lose on price and latency.",
          "{{brand}} takes the agency's deliverable — a written brief a human would send — and delivers it at software price and software latency. That is the wedge, and it is defensible because the hard part is the commentary, not the charts.",
        ],
        bullets: [
          "Dashboards: high surface area, low adoption — we win on “nobody opens it”",
          "BI platforms: high power, slow setup — we win on week-one value",
          "Agencies: right deliverable, wrong economics — we win on price and speed",
        ],
      },
      {
        heading: "What we deliberately do not claim",
        paragraphs: [
          "We do not claim per-channel forecasting, MMM, or incrementality testing. Two competitors do those well and prospects who need them should buy those. Conceding this in comparison content measurably improves conversion on the pages where we do compete.",
        ],
      },
      {
        heading: "Proof points the desks may cite",
        paragraphs: [
          "Each of these is verifiable and may be used in any filed draft without further approval. Anything not on this list needs a source attached to the dispatch.",
        ],
        bullets: [
          "Median edit time before send: 6 minutes, across 200 accounts",
          "71% of reports in our corpus open with a chart; the ones that get replies open with a sentence",
          "Setup to first report: under 20 minutes for a standard stack",
        ],
      },
    ],
  },
  {
    id: "doc-icp",
    title: "ICP Dossier",
    kind: "Foundation",
    summary:
      "Who we file for: the buyer, the room they sit in, and the four objections that decide the deal.",
    updated: "Refreshed from 60 call transcripts",
    pages: 6,
    sections: [
      {
        heading: "Primary buyer",
        paragraphs: [
          "Head of Marketing at a 20–200 person B2B company. Owns the weekly report, has no analyst, and personally assembles it on Sunday night or Monday morning. Reports to a founder or CRO who reads the first paragraph and skips the charts.",
          "They are not shopping for analytics. They are shopping for their Sunday evening back, and for the report to stop being argued with.",
        ],
      },
      {
        heading: "The room",
        paragraphs: [
          "Three people matter. The buyer wants the time back. The founder wants to trust the numbers without auditing them. The one technical person on the team wants to know where the data comes from and whether it can be re-run.",
          "Every comparison page and every longform piece should have a paragraph aimed at each. The technical paragraph is the one most often missing, and it is the one that stalls deals in week two.",
        ],
      },
      {
        heading: "The four objections",
        paragraphs: [
          "Pulled from 60 recorded calls. In order of how often they end the conversation:",
        ],
        bullets: [
          "“Will the numbers match what I see in the platform?” — answer with the frozen-window explanation, not a trust claim",
          "“We already pay for a dashboard.” — answer with the adoption number, not a feature list",
          "“I don't want it to sound like a robot wrote it.” — answer with a real unedited sample",
          "“What happens when our stack changes?” — answer with the reconnect flow and the frozen history",
        ],
      },
      {
        heading: "Who we do not file for",
        paragraphs: [
          "Enterprise teams with an in-house analytics function, agencies reselling reporting, and pre-revenue startups with one channel. Desks that file drafts aimed at these audiences get them spiked — the traffic converts at roughly a fifth of the primary segment.",
        ],
      },
    ],
  },
  {
    id: "doc-voice",
    title: "Voice & Style Sheet",
    kind: "Editorial",
    summary:
      "House style for every desk: sentence rhythm, banned constructions, and how to concede a point.",
    updated: "Standing document",
    pages: 3,
    sections: [
      {
        heading: "The rule under all the other rules",
        paragraphs: [
          "Write like an operator explaining something to another operator over coffee. Specific, unhurried, willing to say what did not work. If a sentence could appear in any vendor's copy, it is not our sentence.",
        ],
      },
      {
        heading: "Banned constructions",
        paragraphs: [
          "These are spiked on sight, in every channel, including replies filed by the community desks.",
        ],
        bullets: [
          "“Leverage,” “unlock,” “seamless,” “best-in-class,” “game-changing”",
          "“In today's fast-paced world” and every variant of it",
          "Rhetorical questions as openers — “Tired of manual reporting?”",
          "Claims without a number attached, when a number exists",
        ],
      },
      {
        heading: "How to concede",
        paragraphs: [
          "Conceding a competitor's genuine strength is house style, not a slip. It reads as confidence, it survives fact-checking, and on comparison pages it correlates with our highest conversion rates.",
          "Format: name the competitor, name the specific thing they do better, name the buyer for whom that is decisive. Then move on — no recovery sentence, no “but.”",
        ],
      },
      {
        heading: "Channel adjustments",
        paragraphs: [
          "The voice holds everywhere; the length and the disclosure change.",
        ],
        bullets: [
          "Reddit and HN: disclose affiliation in the first line, one link maximum, advice must stand alone if the link is stripped",
          "LinkedIn: first person, short paragraphs, link in the first comment",
          "X: reply rather than quote-post when joining someone else's thread",
          "Longform: a number or a specific in the first two sentences, always",
        ],
      },
    ],
  },
  {
    id: "doc-90day",
    title: "90-Day Growth Plan",
    kind: "Plan",
    summary:
      "The sequence the desks are filing against: fix the floor, own the comparison layer, then compound.",
    updated: "Week 3 of 13",
    pages: 8,
    sections: [
      {
        heading: "Phase 1 · Fix the floor (weeks 1–3)",
        paragraphs: [
          "Nothing else compounds while half the blog is uncrawlable and the pricing page renders client-side. The technical desk owns this phase and it is deliberately short.",
        ],
        bullets: [
          "Pagination noindex removed, 190 posts resubmitted",
          "Pricing rendered server-side in plain HTML text",
          "Core Web Vitals: LCP under 2.5s on the top 20 landing pages",
        ],
      },
      {
        heading: "Phase 2 · Own the comparison layer (weeks 3–8)",
        paragraphs: [
          "Every buyer in this category runs a comparison search before they buy, and right now our rivals write those pages for us. This phase puts our own honest comparisons in front of that search, and makes them the source the answer engines quote.",
        ],
        bullets: [
          "/alternatives and /compare pages for the three named rivals",
          "Specification tables in crawlable HTML, structured for verbatim citation",
          "Two round-up corrections filed with editors",
          "Answer-engine sweep re-run weekly to measure share",
        ],
      },
      {
        heading: "Phase 3 · Compound (weeks 8–13)",
        paragraphs: [
          "With the floor fixed and the comparison layer owned, original data becomes the growth engine. One substantial research piece per month, cut down into community and social dispatches rather than written fresh.",
        ],
        bullets: [
          "Monthly original-data feature from the report corpus",
          "Each feature cut into one LinkedIn post, one X thread, two community replies",
          "Community desks file only where the question is genuinely ours to answer",
        ],
      },
      {
        heading: "What success looks like at day 90",
        paragraphs: [
          "Answer share above 50% on the ten buying-intent prompts we track. Page one for six of the eight branded-alternative queries. 40 new referring domains. And the number that matters more than any of them: qualified trial starts from organic and community up 2× on the January baseline.",
        ],
      },
    ],
  },
  {
    id: "doc-geo",
    title: "Answer-Engine Playbook",
    kind: "Playbook",
    summary:
      "How the GEO desk gets {{brand}} named, cited and correctly described by the models.",
    updated: "Rewritten this month",
    pages: 5,
    sections: [
      {
        heading: "What actually moves an answer",
        paragraphs: [
          "Answer engines are not ranking pages, they are assembling a claim from sources they can parse and trust. Three things move the answer: being present in the round-ups the models already cite, publishing a page that answers the question in the first eighty words, and making the facts machine-readable in plain HTML.",
          "Volume of content does not move it. We have tested this: eleven blog posts on a topic moved answer share less than one correctly structured comparison page.",
        ],
      },
      {
        heading: "The weekly sweep",
        paragraphs: [
          "Forty runs across ChatGPT, Perplexity, Claude and Google AI Overviews, on ten buying-intent prompts. We record which brands are named, which sources are cited, and whether our description is accurate.",
          "The desk files a dispatch whenever named-share moves more than ten points on any prompt, or whenever a cited source about us is factually wrong.",
        ],
      },
      {
        heading: "Rendering rules",
        paragraphs: [
          "Anything we want quoted must exist in the server-rendered HTML. Client-rendered tables, tabbed pricing, and accordion FAQs are invisible to most crawlers used by answer engines — this is the single most common cause of a stale or wrong answer about us.",
        ],
        bullets: [
          "Prices, plan names and limits in plain text, server-rendered",
          "A dated “last updated” line on every factual page",
          "FAQ schema on any page answering a question we want cited",
          "One canonical URL per fact — duplicates split the citation",
        ],
      },
      {
        heading: "Correction protocol",
        paragraphs: [
          "When a model repeats a wrong fact about us, the fix is upstream: identify the cited source, file a factual correction with the publisher, and publish our own canonical version of the fact. Requests to the model provider do nothing. Median time from correction to changed answer, in our tracking, is nineteen days.",
        ],
      },
    ],
  },
  {
    id: "doc-calendar",
    title: "Editorial Calendar",
    kind: "Plan",
    summary:
      "What every desk is committed to filing over the next six weeks, and what is deliberately not on it.",
    updated: "Reviewed Monday",
    pages: 4,
    sections: [
      {
        heading: "Standing commitments",
        paragraphs: [
          "The calendar is a floor, not a ceiling. Desks file opportunistically on top of it — a live Reddit thread outranks anything scheduled.",
        ],
        bullets: [
          "One original-data feature per month, from the report corpus",
          "Two comparison or alternatives pages per month until the set is complete",
          "LinkedIn: two founder posts a week, Monday and Thursday",
          "X: one thread a week, replies as they arise",
          "Community desks: file only on genuine matches, no quota",
        ],
      },
      {
        heading: "Weeks 1–2",
        paragraphs: [
          "Technical floor work lands first, then the comparison layer opens with the rival currently taking our branded traffic.",
        ],
        bullets: [
          "Pagination fix and sitemap resubmission",
          "/alternatives page for the highest-traffic rival",
          "Feature: “We read 200 weekly marketing reports”",
        ],
      },
      {
        heading: "Weeks 3–6",
        paragraphs: [
          "Comparison layer completes and the research piece gets cut down across channels rather than replaced with new writing.",
        ],
        bullets: [
          "Two further /compare pages with specification tables",
          "“Marketing report template” hub with FAQ schema",
          "Cut-downs: one LinkedIn post and one X thread per feature",
          "Round-up corrections filed with two editors",
        ],
      },
      {
        heading: "Deliberately not on the calendar",
        paragraphs: [
          "No SEO glossary, no “ultimate guide” series, no weekly newsletter. Each was tested and each cost more editorial time than it returned. If a desk files against one of these it needs a new argument, not a new draft.",
        ],
      },
    ],
  },
];

export const COMPETITORS: Competitor[] = [
  {
    id: "cmp-cadence",
    name: "Cadence",
    domain: "cadence-analytics.com",
    positioning: "Dashboards plus per-channel forecasting for growth teams",
    shareOfVoice: 34,
    monthlyTraffic: "128k",
    strength: "Owns the comparison layer — writes our alternatives page for us",
    softSpot: "Setup takes three weeks; their own G2 reviews say so",
  },
  {
    id: "cmp-ravelin",
    name: "Ravelin",
    domain: "ravelin.io",
    positioning: "Enterprise marketing BI with an in-house services team",
    shareOfVoice: 27,
    monthlyTraffic: "96k",
    strength: "Named first in most AI answers — heavy round-up presence",
    softSpot: "Priced for 200+ seats; loses every deal under 50",
  },
  {
    id: "cmp-northsound",
    name: "Northsound",
    domain: "northsound.co",
    positioning: "Lightweight reporting for agencies and their clients",
    shareOfVoice: 19,
    monthlyTraffic: "54k",
    strength: "Fast, cheap, excellent onboarding video",
    softSpot: "No commentary layer — charts only, which is our whole wedge",
  },
  {
    id: "cmp-tally",
    name: "Tally Reports",
    domain: "tallyreports.com",
    positioning: "Spreadsheet-native reporting add-on",
    shareOfVoice: 11,
    monthlyTraffic: "31k",
    strength: "Zero switching cost for spreadsheet-first teams",
    softSpot: "Breaks at scale; churns into our segment at 40+ seats",
  },
];

export const SEO_ISSUES: SeoIssue[] = [
  {
    id: "iss-noindex",
    severity: "critical",
    title: "Blog pagination serves noindex past page 2",
    detail:
      "A template condition meant for tag archives is applied to /blog/page/*, hiding 190 published posts from crawlers. 41 of them still rank on internal links alone.",
    pages: 190,
    actionLabel: "Draft fix filed · open dispatch",
    dispatchId: "dsp-003",
    fix: {
      summary:
        "Scope the noindex condition to tag archives only, then resubmit the recovered URLs.",
      steps: [
        "Restrict the robots meta condition to /blog/tag/* in the blog index template",
        "Verify with a rendered fetch on /blog/page/3 — the robots tag must be absent",
        "Regenerate sitemap.xml so the 190 recovered posts are included",
        "Resubmit the sitemap and watch the indexed-pages count for two weeks",
      ],
      snippet:
        '{/* before */}\n{isArchive && <meta name="robots" content="noindex,follow" />}\n\n{/* after */}\n{isTagArchive && <meta name="robots" content="noindex,follow" />}',
    },
  },
  {
    id: "iss-pricing-render",
    severity: "critical",
    title: "Pricing table renders client-side — crawlers see an empty page",
    detail:
      "Plan names, prices and limits are injected after hydration. Answer engines fall back to a cached 2023 page, which is why Perplexity quotes retired pricing.",
    pages: 1,
    actionLabel: "Draft fix filed · open dispatch",
    dispatchId: "dsp-010",
    fix: {
      summary:
        "Server-render the pricing table as plain HTML text with a dated last-updated line.",
      steps: [
        "Move plan data into a server component and render the table statically",
        "Add a machine-readable “Pricing last updated” date under the table",
        "Add Product and Offer schema with the current figures",
        "Request re-crawl, then re-run the twelve pricing prompts in the answer sweep",
      ],
    },
  },
  {
    id: "iss-lcp",
    severity: "warning",
    title: "LCP above 4s on the top three landing pages",
    detail:
      "A 1.4MB hero image is served uncompressed at full resolution on mobile, and the web-font load is render-blocking on first paint.",
    pages: 3,
    actionLabel: "Preview the fix",
    fix: {
      summary:
        "Compress and size the hero correctly, preload the display face, and defer the rest.",
      steps: [
        "Export the hero at 2× target width in AVIF with a WebP fallback",
        "Serve responsive sources so mobile stops downloading the desktop asset",
        "Preload the display face and set font-display: swap on the rest",
        "Re-measure in the field data after seven days, not in the lab",
      ],
    },
  },
  {
    id: "iss-titles",
    severity: "warning",
    title: "34 duplicate title tags across the blog",
    detail:
      "Category pages and their first paginated page share identical titles, and eleven posts inherit the site-wide default because the front-matter field is empty.",
    pages: 34,
    actionLabel: "Preview the fix",
    fix: {
      summary:
        "Give paginated pages a page number in the title and backfill the eleven empty fields.",
      steps: [
        "Append “ · Page N” to titles on paginated category pages",
        "Backfill the eleven missing front-matter titles from the H1",
        "Add a build-time check that fails on an empty or duplicate title",
      ],
    },
  },
  {
    id: "iss-internal-links",
    severity: "warning",
    title: "Highest-authority posts link nowhere useful",
    detail:
      "The four posts holding most of the site's external links have no internal links to any commercial page. Authority is arriving and stopping.",
    pages: 4,
    actionLabel: "Preview the fix",
    fix: {
      summary:
        "Add contextual links from the four authority posts into the comparison and hub pages.",
      steps: [
        "Add two in-body contextual links per post — not a related-posts widget",
        "Point them at /compare and the template hub, not the homepage",
        "Re-crawl and confirm the internal PageRank shift in the link graph",
      ],
    },
  },
  {
    id: "iss-alt-text",
    severity: "notice",
    title: "Chart images across the blog have no alt text",
    detail:
      "62 images, most of them original data charts, ship without alt attributes. These are the assets most likely to be cited, and they are unreadable to crawlers and screen readers alike.",
    pages: 62,
    actionLabel: "Preview the fix",
    fix: {
      summary:
        "Write descriptive alt text stating what each chart shows, not what it is called.",
      steps: [
        "Generate draft alt text from each chart's caption and axis labels",
        "Rewrite drafts so each states the finding, not the file name",
        "Add a lint rule blocking image commits without alt text",
      ],
    },
  },
  {
    id: "iss-orphans",
    severity: "notice",
    title: "17 orphaned pages with no inbound internal links",
    detail:
      "Mostly old campaign landing pages. Two of them still convert; the rest dilute crawl budget and should be redirected.",
    pages: 17,
    actionLabel: "Preview the fix",
    fix: {
      summary:
        "Keep the two that convert, link them properly, and 301 the remaining fifteen.",
      steps: [
        "Confirm conversion data per page over the last 180 days",
        "Link the two keepers from the resources index",
        "301 the other fifteen to the closest live equivalent",
      ],
    },
  },
];

export const KEYWORD_GAPS: KeywordGap[] = [
  {
    id: "kw-template",
    keyword: "marketing report template",
    volume: 4400,
    difficulty: 22,
    ourRank: null,
    bestRival: { name: "Northsound", rank: 3 },
    intent: "informational",
  },
  {
    id: "kw-alternative",
    keyword: "{{brand}} alternative",
    volume: 1300,
    difficulty: 18,
    ourRank: 9,
    bestRival: { name: "Cadence", rank: 4 },
    intent: "commercial",
  },
  {
    id: "kw-weekly",
    keyword: "weekly marketing report",
    volume: 1900,
    difficulty: 27,
    ourRank: 6,
    bestRival: { name: "Cadence", rank: 2 },
    intent: "informational",
  },
  {
    id: "kw-automated",
    keyword: "automated marketing reporting software",
    volume: 880,
    difficulty: 41,
    ourRank: null,
    bestRival: { name: "Ravelin", rank: 1 },
    intent: "transactional",
  },
  {
    id: "kw-vs",
    keyword: "cadence vs ravelin",
    volume: 720,
    difficulty: 15,
    ourRank: null,
    bestRival: { name: "Cadence", rank: 1 },
    intent: "commercial",
  },
  {
    id: "kw-attribution",
    keyword: "attribution window reporting",
    volume: 590,
    difficulty: 33,
    ourRank: 14,
    bestRival: { name: "Ravelin", rank: 2 },
    intent: "informational",
  },
  {
    id: "kw-dashboard",
    keyword: "marketing dashboard vs report",
    volume: 480,
    difficulty: 12,
    ourRank: null,
    bestRival: { name: "Northsound", rank: 5 },
    intent: "informational",
  },
  {
    id: "kw-example",
    keyword: "marketing report example",
    volume: 1600,
    difficulty: 25,
    ourRank: 18,
    bestRival: { name: "Tally Reports", rank: 6 },
    intent: "informational",
  },
];

export const SEO_SCORES = {
  overall: 68,
  technical: 54,
  content: 76,
  authority: 71,
  crawledPages: 4180,
  lastCrawl: "Nightly crawl finished 04:12",
  trend: "+6 since last week",
};

export const INTEGRATIONS: Integration[] = [
  {
    id: "int-ga4",
    name: "Google Analytics 4",
    category: "Analytics",
    blurb: "Sessions, conversions and landing-page performance",
    detail:
      "Feeds the impact estimates on every SEO and longform dispatch, and the referral numbers on published community filings.",
    icon: "line-chart",
    connected: true,
  },
  {
    id: "int-gsc",
    name: "Google Search Console",
    category: "Search",
    blurb: "Impressions, positions and indexation coverage",
    detail:
      "The search desk files rank-movement dispatches straight off this feed. Without it, ranking claims fall back to third-party estimates.",
    icon: "search",
    connected: true,
  },
  {
    id: "int-wordpress",
    name: "WordPress",
    category: "Publishing",
    blurb: "Push approved articles straight to draft",
    detail:
      "Approved longform dispatches arrive as drafts with title, body and meta description filled in. Nothing publishes without a human hitting publish.",
    icon: "newspaper",
    connected: false,
  },
  {
    id: "int-linkedin",
    name: "LinkedIn Pages",
    category: "Social",
    blurb: "Schedule founder and company posts",
    detail:
      "Approved LinkedIn dispatches queue against the Monday and Thursday slots in the editorial calendar.",
    icon: "briefcase",
    connected: true,
  },
  {
    id: "int-x",
    name: "X",
    category: "Social",
    blurb: "Post, thread and reply from the founder account",
    detail:
      "Required for reply dispatches — the X desk can spot the moment without it, but cannot file the reply.",
    icon: "hash",
    connected: false,
  },
  {
    id: "int-reddit",
    name: "Reddit",
    category: "Community",
    blurb: "Watch subreddits and file replies with disclosure",
    detail:
      "Monitors eleven subreddits for buying-intent questions. Replies always carry the affiliation line from the style sheet.",
    icon: "messages",
    connected: false,
  },
  {
    id: "int-slack",
    name: "Slack",
    category: "Notifications",
    blurb: "Urgent dispatches to your channel as they file",
    detail:
      "Only URGENT-stamped dispatches are pushed, so the channel stays readable. Everything else waits for the daily edition.",
    icon: "bell",
    connected: true,
  },
  {
    id: "int-ahrefs",
    name: "Ahrefs",
    category: "Search",
    blurb: "Backlinks, keyword gaps and competitor movement",
    detail:
      "Powers the competitor landscape table and the keyword-gap list on the audit desk.",
    icon: "link",
    connected: false,
  },
  {
    id: "int-hubspot",
    name: "HubSpot",
    category: "CRM",
    blurb: "Close the loop from dispatch to pipeline",
    detail:
      "Attributes trial starts and pipeline back to the dispatch that produced them, which is how the wire scores its own desks.",
    icon: "target",
    connected: false,
  },
  {
    id: "int-notion",
    name: "Notion",
    category: "Publishing",
    blurb: "Mirror strategy documents into your workspace",
    detail:
      "Keeps the positioning brief, ICP dossier and style sheet in sync so the whole team writes against the same page.",
    icon: "file-text",
    connected: false,
  },
];

export const VERTICALS = [
  "B2B SaaS · Marketing analytics",
  "B2B SaaS · Developer tools",
  "B2B SaaS · Fintech",
  "E-commerce · DTC brand",
  "Marketplace",
  "Professional services",
];

export const GOALS = [
  "Qualified trial starts from organic and community channels",
  "Demo requests from the enterprise segment",
  "Newsletter subscribers",
  "Share of voice against named competitors",
  "Answer-engine citation share",
];

export const VOICE_SUGGESTIONS = [
  "Plain-spoken",
  "Specific",
  "Operator-to-operator",
  "No hype",
  "Wry",
  "Technical",
  "Warm",
  "Direct",
  "Evidence-first",
];
