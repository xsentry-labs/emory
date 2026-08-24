import type {
  AuditFinding,
  BrainChange,
  BrainField,
  Connector,
  EmoryAction,
  Experiment,
  OnboardingQuestion,
  Person,
  ProofLine,
  RevenueSource,
  TimelineEvent,
  Workspace,
} from "./types";

/**
 * Copy carries {{brand}} / {{domain}} slots, resolved once when the workspace
 * is created from the URL someone typed. Emory speaks in all of it; agents are
 * named only where an agent owns the thing being shown.
 */
const TOKEN = /\{\{(brand|domain)\}\}/g;

export function hydrate<T>(value: T, brand: string, domain: string): T {
  if (typeof value === "string") {
    return value.replace(TOKEN, (_m, key) =>
      key === "brand" ? brand : domain,
    ) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => hydrate(item, brand, domain)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = hydrate(item, brand, domain);
    return out as T;
  }
  return value;
}

export function companyFromDomain(domain: string) {
  const root = domain.split(".")[0]?.replace(/[-_]/g, " ") ?? "your company";
  return root
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const SEED_WORKSPACE: Workspace = {
  domain: "{{domain}}",
  company: "{{brand}}",
  state: "running",
  platform: "Next.js on Vercel · content in WordPress",
  plan: "Emory Complete · Launch · $229 a month",
};

/* ---------------- Audit: diagnoses, never fixes ---------------- */

export const AUDIT_SCORE = {
  score: 61,
  pagesRead: 418,
  seconds: 58,
  verdict:
    "People searching for what you sell are not finding you, and AI assistants describe you using a page you deleted last year.",
};

export const AUDIT_FINDINGS: AuditFinding[] = [
  {
    id: "af-descriptions",
    title: "14 pages have nothing to show in search results",
    detail:
      "Including your pricing page. Search engines are inventing a description from whatever text they find first, which on your pricing page is a table header.",
    costing: "These 14 pages get about 3,100 views a month and almost no clicks.",
    severity: "critical",
    pages: 14,
    ownerId: "beacon",
    actionId: "act-descriptions",
  },
  {
    id: "af-pricing-invisible",
    title: "Your prices are invisible to AI assistants",
    detail:
      "The pricing table is drawn by the browser after the page loads, so assistants read an empty page and fall back to a cached version from last year with the old numbers.",
    costing:
      "9 of the 12 pricing questions we asked assistants returned a price you no longer charge.",
    severity: "critical",
    pages: 1,
    ownerId: "beacon",
    actionId: "act-pricing",
  },
  {
    id: "af-ai-absent",
    title: "Assistants recommend three competitors and not you",
    detail:
      "We asked ChatGPT, Claude, Perplexity and Google's AI answers what to use for what you do, forty times. {{brand}} came up four times. The same three round-up articles are behind almost every answer, and none of them list you.",
    costing:
      "This is the question buyers ask first now. You are absent from it.",
    severity: "critical",
    pages: 0,
    ownerId: "beacon",
    actionId: "act-comparison",
  },
  {
    id: "af-blog-hidden",
    title: "190 of your articles cannot be found from your own site",
    detail:
      "Past page two, your article index tells search engines to ignore everything. 41 of those articles still get found anyway, through links from elsewhere.",
    costing: "190 pieces of work currently returning nothing.",
    severity: "critical",
    pages: 190,
    ownerId: "beacon",
    actionId: "act-pagination",
  },
  {
    id: "af-slow",
    title: "Your three busiest pages take over four seconds to appear on a phone",
    detail:
      "A 1.4MB image is being sent to phones at full desktop size, and the fonts block the first paint.",
    costing:
      "Roughly a fifth of phone visitors leave before your page finishes loading.",
    severity: "warning",
    pages: 3,
    ownerId: "beacon",
  },
  {
    id: "af-authority",
    title: "The four articles other sites link to lead nowhere",
    detail:
      "They are your most trusted pages and none of them link to anything you sell.",
    costing: "Reputation arrives at your site and stops there.",
    severity: "warning",
    pages: 4,
    ownerId: "beacon",
  },
  {
    id: "af-catalogue",
    title: "AI shopping and research tools cannot read your product list",
    detail:
      "There is no machine-readable description of what you sell, and no file telling AI tools how to use your site.",
    costing:
      "Tools that recommend products to buyers skip you entirely, which is a growing share of how people choose.",
    severity: "warning",
    pages: 0,
    ownerId: "beacon",
  },
  {
    id: "af-no-measure",
    title: "You cannot tell where a third of your customers came from",
    detail:
      "Traffic arriving from AI assistants has no trail, so your analytics files it as Direct. On your numbers that is 34% of everything in that bucket.",
    costing:
      "Every budget decision you make is being made on a third of the picture.",
    severity: "notice",
    pages: 0,
    ownerId: "ledge",
  },
];

/* ---------------- Onboarding: AI proposes, the human corrects ---------------- */

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: "q-sell",
    question: "What do you sell?",
    answer:
      "Software that writes a company's weekly marketing report — pulling spend, pipeline and results into one brief a team actually reads.",
    confidence: 92,
    origin: "Read from your home page and pricing page",
    multiline: true,
  },
  {
    id: "q-who",
    question: "Who buys it?",
    answer:
      "Heads of marketing and founders at 20–200 person B2B companies who own the weekly report and have no analyst.",
    confidence: 78,
    origin: "Inferred from your case studies and the language on your pricing page",
    multiline: true,
  },
  {
    id: "q-price",
    question: "What does it cost?",
    answer: "$79 per seat a month, billed annually. 14-day trial, no card.",
    confidence: 54,
    origin: "Found two different numbers on your site. The older one is still live.",
  },
  {
    id: "q-competitors",
    question: "Who do you come up against?",
    answer: "Cadence, Ravelin, Northsound",
    confidence: 71,
    origin: "Found by looking at who ranks and gets recommended for the same questions",
  },
  {
    id: "q-voice",
    question: "How should you sound?",
    answer:
      "Plain-spoken and specific. Operator to operator. Numbers instead of adjectives, and willing to say what did not work.",
    confidence: 66,
    origin: "Learned from your last twelve articles",
    multiline: true,
  },
  {
    id: "q-goal",
    question: "What matters most right now?",
    answer: "Qualified trial starts",
    confidence: 48,
    origin: "Guessed from your calls to action. Worth correcting if this is wrong.",
  },
  {
    id: "q-avoid",
    question: "Anything Emory should never say?",
    answer:
      "No guarantees about results. Never claim we replace an analyst. Never use the word seamless.",
    confidence: 35,
    origin: "Emory's default caution. Add anything specific to your market.",
    multiline: true,
  },
];

/* ---------------- The approval queue ---------------- */

export const SEED_ACTIONS: EmoryAction[] = [
  {
    id: "act-descriptions",
    agentId: "beacon",
    title: "Write search descriptions for 14 pages that have none",
    why: "These pages get about 3,100 views a month in search and almost no clicks, because there is nothing telling anyone what is on them. Your pricing page is one of them.",
    target: "{{domain}} · 14 pages including /pricing",
    current: null,
    proposed:
      "Pricing for {{brand}} — per-seat plans, what each includes, and the point at which teams usually move up. No card needed for the trial.",
    impact: { metric: "Search clicks", estimate: "+8–14% on these pages" },
    risk: "low",
    reversible: true,
    status: "queued",
    createdAt: ago(38),
    kind: "page-description",
    kindLabel: "Page descriptions",
  },
  {
    id: "act-pricing",
    agentId: "beacon",
    title: "Publish your prices as text an assistant can read",
    why: "Assistants read an empty page where your pricing table should be, so they quote the number you charged last year. Nine of the twelve pricing questions we tested came back wrong.",
    target: "{{domain}}/pricing",
    current: "Prices drawn by the browser after the page loads",
    proposed:
      "Same page, prices written into the page itself, with the date they were last changed. Nothing visible changes for a visitor.",
    impact: { metric: "Correct answers about your pricing", estimate: "3 of 12 → 12 of 12" },
    risk: "medium",
    reversible: true,
    status: "queued",
    createdAt: ago(52),
    kind: "page-content",
    kindLabel: "Page content",
  },
  {
    id: "act-comparison",
    agentId: "beacon",
    title: "Answer the comparison page Cadence wrote about you",
    why: "Cadence published a page comparing themselves to you eleven days ago. It now sits fourth for eight searches that carry your own name, and you have no page of your own answering it.",
    target: "{{domain}}/compare/cadence · new page",
    current: null,
    proposed:
      "A comparison that concedes the two things Cadence genuinely does better, then makes the case on the three that decide it: setup time, cost at twenty seats and up, and the audit trail. Honest comparisons outrank defensive ones.",
    impact: { metric: "Searches carrying your name", estimate: "Recover about 1,240 visits a month" },
    risk: "medium",
    reversible: true,
    status: "queued",
    createdAt: ago(96),
    guard: "Checked. No claim about a competitor that cannot be evidenced.",
    kind: "new-page",
    kindLabel: "New pages",
  },
  {
    id: "act-pagination",
    agentId: "beacon",
    title: "Make your 190 hidden articles findable again",
    why: "One line in your article index tells search engines to ignore everything past page two. It was meant for tag pages only.",
    target: "{{domain}}/blog · article index template",
    current: "Everything past page two is marked do-not-index",
    proposed:
      "Restrict that instruction to tag pages, then resubmit the 190 recovered articles.",
    impact: { metric: "Pages that can be found", estimate: "+190, of which 41 already rank" },
    risk: "medium",
    reversible: true,
    status: "queued",
    createdAt: ago(140),
    kind: "site-structure",
    kindLabel: "Site structure",
  },
  {
    id: "act-stalled",
    agentId: "forge",
    title: "Chase 34 trials that went quiet with real usage behind them",
    why: "Each of these people used the product properly and then stopped hearing from anyone. Median silence is twelve days. This is the largest recoverable number on your account this week.",
    target: "34 contacts in HubSpot",
    current: "No contact since their trial lapsed",
    proposed:
      "Hi Dana — you built three reports in your first week and then things went quiet, which usually means the Monday deadline got there first. If it is useful I can turn your last report into a scheduled one so it writes itself. If the timing is wrong, say so and I will stop chasing.",
    impact: { metric: "Pipeline in reach", estimate: "$41,200 across the 34" },
    risk: "medium",
    reversible: true,
    status: "queued",
    createdAt: ago(64),
    guard: "Checked. All 34 have permission on file. Three were removed as opted out.",
    kind: "outbound-message",
    kindLabel: "Follow-up messages",
  },
  {
    id: "act-review",
    agentId: "beacon",
    title: "Reply to a three-star review about setup",
    why: "It is four days old, it is the first review anyone reads, and the complaint is specific enough to answer properly.",
    target: "G2 · review from a 40-person team",
    current: null,
    proposed:
      "Thanks for writing this. The connection step you hit is genuinely slower than it should be when a workspace has more than one ad account, and we are changing it. If you tell me which platform, I will get your setup finished this week rather than waiting for the fix.",
    impact: { metric: "Rating shown to buyers", estimate: "Replies lift conversion on this page" },
    risk: "low",
    reversible: true,
    status: "queued",
    createdAt: ago(150),
    kind: "review-reply",
    kindLabel: "Review replies",
  },
  {
    id: "act-afterhours",
    agentId: "envoy",
    title: "Answer the questions arriving after you have gone home",
    why: "41% of your chat conversations start after 7pm or at the weekend. They currently wait until the next working morning, by which time a third of the people have gone.",
    target: "Website chat · outside working hours",
    current: "Out of hours, visitors get a form",
    proposed:
      "Answer from what Emory already knows about your product and pricing, book a call when someone is evaluating, and hand anything unclear to you with the whole conversation attached.",
    impact: { metric: "Conversations answered within a minute", estimate: "59% → 100%" },
    risk: "medium",
    reversible: true,
    status: "queued",
    createdAt: ago(210),
    kind: "conversation-policy",
    kindLabel: "Conversation handling",
  },
  {
    id: "act-alt",
    agentId: "beacon",
    title: "Describe 62 charts that are currently unreadable",
    why: "These are your own data charts — the images other sites are most likely to cite — and neither a search engine nor a screen reader can tell what any of them show.",
    target: "{{domain}}/blog · 62 images",
    current: null,
    proposed:
      "Each description states what the chart shows rather than what the file is called. Example: “Share of weekly reports that open with a chart rather than a sentence, 2023 to 2026.”",
    impact: { metric: "Citable assets", estimate: "62 charts become readable" },
    risk: "low",
    reversible: true,
    status: "queued",
    createdAt: ago(280),
    kind: "image-description",
    kindLabel: "Image descriptions",
  },
  {
    id: "act-questions",
    agentId: "beacon",
    title: "Answer the six questions buyers keep asking, on the page they ask them",
    why: "Envoy has seen the same six questions in chat 74 times this quarter. Four of them are not answered anywhere on your site.",
    target: "{{domain}}/pricing and /product",
    current: null,
    proposed:
      "A short answer to each, in your words, structured so assistants can quote them. The most asked one is whether the numbers match what people see in their ad platforms.",
    impact: { metric: "Questions answered before they are asked", estimate: "74 chats a quarter" },
    risk: "low",
    reversible: true,
    status: "queued",
    createdAt: ago(300),
    kind: "page-content",
    kindLabel: "Page content",
  },
  {
    id: "act-holdout",
    agentId: "ledge",
    title: "Run a four-week holdout so your numbers stop being a guess",
    why: "A third of what your analytics calls Direct is people arriving from AI assistants with no trail. Clicks cannot tell you what worked any more, so the only honest way to know is to hold something back and measure the difference.",
    target: "Two matched regions, four weeks",
    current: "Last-click reporting only",
    proposed:
      "Pause one channel in one region while keeping it in a matched one, and read the difference in signups. You get one number with a confidence range instead of five dashboards that disagree.",
    impact: { metric: "Revenue you can attribute honestly", estimate: "First defensible reading in 4 weeks" },
    risk: "medium",
    reversible: true,
    status: "queued",
    createdAt: ago(330),
    kind: "measurement",
    kindLabel: "Measurement",
  },
  {
    id: "act-redirect",
    agentId: "beacon",
    title: "Retire 15 old campaign pages and point them somewhere useful",
    why: "Seventeen pages have no route in from anywhere. Two still bring in signups and should stay; the other fifteen are spending your crawl budget and confusing your own reporting.",
    target: "{{domain}} · 15 URLs",
    current: "Live, unlinked, no traffic",
    proposed:
      "Send each to its closest live equivalent. Link the two that still convert from the resources page.",
    impact: { metric: "Wasted crawl", estimate: "15 URLs removed from circulation" },
    risk: "high",
    reversible: true,
    status: "queued",
    createdAt: ago(420),
    kind: "redirect",
    kindLabel: "Address changes",
  },
  {
    id: "act-budget",
    agentId: "ledge",
    title: "Move $2,000 a month out of paid search",
    why: "Your branded search ads are mostly buying clicks from people who already know you and would have arrived anyway. The holdout in March showed 84% of that spend produced signups that came regardless.",
    target: "Google Ads · brand campaign",
    current: "$3,100 a month on brand terms",
    proposed:
      "Cut brand spend to $1,100 and hold the rest for four weeks before deciding where it goes. If signups drop, it goes straight back.",
    impact: { metric: "Spend with no measurable return", estimate: "$2,000 a month" },
    risk: "high",
    reversible: true,
    status: "queued",
    createdAt: ago(500),
    kind: "budget",
    kindLabel: "Budget changes",
  },
  {
    id: "act-profile-post",
    agentId: "beacon",
    title: "Post this month's update to your business profile",
    why: "Profiles that post monthly hold their position in local results. Yours has not been updated since February.",
    target: "Google Business Profile",
    current: "Last post 6 months ago",
    proposed:
      "A short note on the reporting integrations added this quarter, with the link to the changelog.",
    impact: { metric: "Profile views", estimate: "Typically +6% in the month after a post" },
    risk: "low",
    reversible: true,
    status: "approved",
    createdAt: ago(1_500),
    ranAt: ago(1_400),
    kind: "profile-post",
    kindLabel: "Profile posts",
  },
  {
    id: "act-integration-page",
    agentId: "beacon",
    title: "Publish the integration page fourteen people asked for",
    why: "Fourteen trial signups this month asked in chat whether you work with one specific tool. Nobody requested this page; Emory noticed the question repeating.",
    target: "{{domain}}/integrations/looker",
    current: null,
    proposed:
      "A page answering exactly what those fourteen asked: what syncs, how often, what happens when a field is missing, and the two limits worth knowing before they start.",
    impact: { metric: "Repeat question", estimate: "14 chats this month" },
    risk: "medium",
    reversible: true,
    status: "executed",
    createdAt: ago(4_300),
    ranAt: ago(4_100),
    kind: "new-page",
    kindLabel: "New pages",
  },
];

/** Guard produces nothing. It stops things, and it says what it stopped. */
export const GUARD_BLOCKS = [
  {
    id: "gb-claim",
    at: ago(120),
    stopped: "“Cut your reporting time by 90%.”",
    reason:
      "A performance claim with no evidence behind it. Two of your markets require substantiation on file before it can be published.",
    replacement:
      "“Most teams send their first report in under twenty minutes.” — measured across 200 accounts, evidence attached.",
    where: "A draft for {{domain}}/pricing",
  },
  {
    id: "gb-consent",
    at: ago(64),
    stopped: "3 contacts removed from a 37-person follow-up",
    reason: "They had opted out. Opt-out is honoured on every channel at once.",
    replacement: "The remaining 34 all have permission on file, with the reason recorded.",
    where: "Follow-up to stalled trials",
  },
];

/* ---------------- The Brain ---------------- */

export const BRAIN_GROUPS = [
  { id: "identity", label: "What you sell", note: "The base every agent writes from." },
  { id: "positioning", label: "How you win", note: "Value, differences, objections, proof." },
  { id: "icp", label: "Who buys", note: "Segments, triggers, budgets, decision makers." },
  { id: "voice", label: "How you sound", note: "Tone, vocabulary, banned phrases." },
  { id: "competitors", label: "Who you are up against", note: "Set, positioning, gaps." },
  { id: "assets", label: "What you own", note: "Site, pages, platform, profiles, handles." },
  { id: "conversations", label: "What customers say", note: "Objections, questions, language." },
  { id: "consent", label: "Permission", note: "Who Emory may contact, and how." },
];

export const BRAIN_FIELDS: BrainField[] = [
  {
    id: "bf-what",
    group: "identity",
    label: "What you sell",
    value:
      "Software that writes a company's weekly marketing report — spend, pipeline and results, with a paragraph explaining why each number moved.",
    confidence: 94,
    source: "confirmed",
    origin: "You corrected this during setup",
    multiline: true,
  },
  {
    id: "bf-price",
    group: "identity",
    label: "What it costs",
    value: "$79 per seat a month, billed annually. 14-day trial, no card.",
    confidence: 61,
    source: "inferred",
    origin: "Two different prices are live on your site. Confirm which is current.",
  },
  {
    id: "bf-markets",
    group: "identity",
    label: "Where you sell",
    value: "United States, United Kingdom, Canada, Australia. English only.",
    confidence: 88,
    source: "observed",
    origin: "From where your signups actually come from",
  },
  {
    id: "bf-position",
    group: "positioning",
    label: "The one-line position",
    value:
      "{{brand}} writes the weekly marketing report your team actually reads — the numbers, and the reason each one moved, before the Monday meeting.",
    confidence: 90,
    source: "confirmed",
    origin: "You wrote this during setup",
    multiline: true,
  },
  {
    id: "bf-different",
    group: "positioning",
    label: "What only you can say",
    value:
      "The written commentary. Competitors ship charts and leave the explaining to whoever opens the dashboard.",
    confidence: 82,
    source: "learned",
    origin: "Learned from how your own customers describe you in calls",
    multiline: true,
  },
  {
    id: "bf-objections",
    group: "positioning",
    label: "What stops a deal",
    value:
      "1. Will the numbers match my ad platforms. 2. We already pay for a dashboard. 3. It will sound like a robot wrote it. 4. What happens when our stack changes.",
    confidence: 86,
    source: "learned",
    origin: "Mined from 60 recorded calls and 74 chat conversations",
    multiline: true,
  },
  {
    id: "bf-proof",
    group: "positioning",
    label: "Proof you can use freely",
    value:
      "Median edit time before sending: 6 minutes across 200 accounts. Setup to first report: under 20 minutes.",
    confidence: 79,
    source: "confirmed",
    origin: "Supplied by you. Guard allows these in published copy.",
    multiline: true,
  },
  {
    id: "bf-buyer",
    group: "icp",
    label: "Who signs off",
    value:
      "Head of marketing at a 20–200 person B2B company. Owns the weekly report, has no analyst, reports to a founder who reads the first paragraph.",
    confidence: 84,
    source: "confirmed",
    origin: "Confirmed at setup, refined from your closed-won records",
    multiline: true,
  },
  {
    id: "bf-trigger",
    group: "icp",
    label: "What makes them start looking",
    value:
      "A board meeting they could not answer a question in, or a marketing hire leaving.",
    confidence: 58,
    source: "learned",
    origin: "Appears in 19 of 60 call transcripts",
  },
  {
    id: "bf-notfor",
    group: "icp",
    label: "Who you should not sell to",
    value:
      "Teams with an in-house analyst, agencies reselling reporting, and single-channel startups. They convert at a fifth of the rate.",
    confidence: 72,
    source: "observed",
    origin: "From your own trial-to-paid data",
    multiline: true,
  },
  {
    id: "bf-tone",
    group: "voice",
    label: "How you sound",
    value:
      "Plain-spoken and specific. Operator to operator. Numbers instead of adjectives, and willing to say what did not work.",
    confidence: 81,
    source: "learned",
    origin: "Learned from your last twelve articles",
    multiline: true,
  },
  {
    id: "bf-banned",
    group: "voice",
    label: "Never say",
    value:
      "Seamless. Unlock. Best-in-class. Any guarantee about results. Any claim that you replace an analyst.",
    confidence: 95,
    source: "confirmed",
    origin: "Set by you. Guard blocks these before anything is written.",
    multiline: true,
  },
  {
    id: "bf-competitors",
    group: "competitors",
    label: "Who you are actually up against",
    value: "Cadence, Ravelin, Northsound, Tally Reports",
    confidence: 87,
    source: "observed",
    origin: "Found by who ranks and gets recommended for the same questions",
  },
  {
    id: "bf-comp-gap",
    group: "competitors",
    label: "What they cover that you do not",
    value:
      "Cadence answers comparison questions about you and you have no page of your own. Ravelin is named first in most assistant answers because it appears in three round-ups you are missing from.",
    confidence: 76,
    source: "observed",
    origin: "From this week's competitor sweep",
    multiline: true,
  },
  {
    id: "bf-platform",
    group: "assets",
    label: "How your site is built",
    value: "Next.js on Vercel, with articles in WordPress",
    confidence: 97,
    source: "observed",
    origin: "Detected during the first crawl. Decides how changes are made.",
  },
  {
    id: "bf-pages",
    group: "assets",
    label: "Pages Emory looks after",
    value: "418 pages, of which 190 are currently unfindable from your own site",
    confidence: 99,
    source: "observed",
    origin: "Last read this morning at 04:12",
  },
  {
    id: "bf-questions",
    group: "conversations",
    label: "What people ask before they buy",
    value:
      "Whether the numbers match their ad platforms (31 times), whether it works with Looker (14), whether they can edit before it sends (12), how long setup takes (9).",
    confidence: 91,
    source: "learned",
    origin: "From 74 chat conversations this quarter",
    multiline: true,
  },
  {
    id: "bf-words",
    group: "conversations",
    label: "The words they use",
    value:
      "They say “the Monday report”, not “weekly reporting”. They say “the numbers disagree”, not “data discrepancy”.",
    confidence: 74,
    source: "learned",
    origin: "From chat and call transcripts. Now used in published copy.",
    multiline: true,
  },
  {
    id: "bf-consent",
    group: "consent",
    label: "Who Emory may contact",
    value:
      "1,847 contacts with permission on file. 63 opted out and suppressed everywhere. Consent is recorded per person, per channel.",
    confidence: 100,
    source: "observed",
    origin: "Maintained by Guard, with a full audit trail",
    multiline: true,
  },
  {
    id: "bf-jurisdiction",
    group: "consent",
    label: "Rules that apply to you",
    value:
      "US, UK, Canada, Australia. Performance claims need evidence on file in two of them before publication.",
    confidence: 93,
    source: "inferred",
    origin: "From where your customers are. Guard enforces this before writing.",
    multiline: true,
  },
];

/** Emory updated your positioning. Here's what changed and why. */
export const BRAIN_CHANGES: BrainChange[] = [
  {
    id: "bc-1",
    at: ago(180),
    agentId: "envoy",
    field: "What people ask before they buy",
    before: "Whether the numbers match their ad platforms (24 times)",
    after: "Whether the numbers match their ad platforms (31 times)",
    why: "Seven more people asked it this week. It is now the most common question before a purchase, and it is not answered anywhere on your site.",
    source: "learned",
  },
  {
    id: "bc-2",
    at: ago(1_100),
    agentId: "ledge",
    field: "What stops a deal",
    before: "3. Price against an existing dashboard",
    after: "3. It will sound like a robot wrote it",
    why: "Objection order changed after listening to eleven calls. Price fell to fifth; the fear of automated writing rose to third. Your pricing page argues against the wrong objection.",
    source: "learned",
  },
  {
    id: "bc-3",
    at: ago(2_800),
    agentId: "scout",
    field: "What they cover that you do not",
    before: "No gaps recorded",
    after: "Cadence answers comparison questions about you and you have no page of your own",
    why: "Cadence published a comparison page eleven days ago. It now ranks fourth for eight searches carrying your name.",
    source: "observed",
  },
  {
    id: "bc-4",
    at: ago(4_400),
    agentId: "beacon",
    field: "How your site is built",
    before: "WordPress",
    after: "Next.js on Vercel, with articles in WordPress",
    why: "Your marketing site moved. Changes to product pages now go through your repository as a pull request instead of the WordPress editor.",
    source: "observed",
  },
  {
    id: "bc-5",
    at: ago(7_200),
    agentId: "envoy",
    field: "The words they use",
    before: "Not recorded",
    after: "They say “the Monday report”, not “weekly reporting”",
    why: "Your customers use a different phrase to your website. Published copy now follows theirs.",
    source: "learned",
  },
  {
    id: "bc-6",
    at: ago(11_000),
    agentId: "forge",
    field: "Who you should not sell to",
    before: "Not recorded",
    after: "Teams with an in-house analyst convert at a fifth of the rate",
    why: "Read from your own closed-lost records. Emory now scores these leads lower rather than chasing them.",
    source: "observed",
  },
];

/* ---------------- Customers: one person, one scroll ---------------- */

export const PEOPLE: Person[] = [
  {
    id: "p-dana",
    name: "Dana Okonjo",
    company: "Halden Systems",
    role: "Head of Marketing",
    status: "customer",
    value: 4800,
    score: 92,
    firstSeen: ago(14_400),
    lastTouch: ago(120),
    summary:
      "Found you through an AI assistant, read two pages, asked one integration question at 9pm, booked a call the same night.",
    arrivedFrom: "AI assistant answer",
  },
  {
    id: "p-marcus",
    name: "Marcus Feld",
    company: "Trellis Data",
    role: "Founder",
    status: "qualified",
    value: 3200,
    score: 78,
    firstSeen: ago(4_300),
    lastTouch: ago(300),
    summary:
      "Arrived from the comparison page, asked whether the numbers match his ad platforms, has not replied since Thursday.",
    arrivedFrom: "Search · comparison page",
  },
  {
    id: "p-sofia",
    name: "Sofia Rehnquist",
    company: "Northgate Labs",
    role: "VP Growth",
    status: "stalled",
    value: 5600,
    score: 64,
    firstSeen: ago(21_000),
    lastTouch: ago(17_280),
    summary:
      "Built three reports in her first trial week, then went quiet. Twelve days of silence with real usage behind it.",
    arrivedFrom: "Referral · customer introduction",
  },
  {
    id: "p-arun",
    name: "Arun Mehta",
    company: "Fieldnote",
    role: "Co-founder",
    status: "new",
    value: 1800,
    score: 41,
    firstSeen: ago(180),
    lastTouch: ago(170),
    summary:
      "Read the pricing page twice this morning and asked about the seat minimum in chat. Emory answered; no call booked yet.",
    arrivedFrom: "Direct — reclassified as AI assistant",
  },
  {
    id: "p-lena",
    name: "Lena Brandt",
    company: "Corva",
    role: "Marketing Lead",
    status: "customer",
    value: 7200,
    score: 88,
    firstSeen: ago(43_000),
    lastTouch: ago(2_800),
    summary:
      "Nine months in, usage flat for three weeks and nobody has spoken to her. Emory has a check-in prepared.",
    arrivedFrom: "Paid search",
  },
  {
    id: "p-tomas",
    name: "Tomas Klein",
    company: "Rivet HQ",
    role: "Head of Demand",
    status: "qualified",
    value: 2400,
    score: 71,
    firstSeen: ago(9_100),
    lastTouch: ago(1_500),
    summary:
      "Downloaded the report template, came back twice, and asked what happens when their stack changes.",
    arrivedFrom: "Article · organic search",
  },
];

/** The sequence the whole product exists to render. */
export const TIMELINE: TimelineEvent[] = [
  {
    id: "t-1",
    personId: "p-dana",
    at: ago(14_400),
    agentId: "beacon",
    channel: "AI assistant",
    title: "Asked an assistant what to use for weekly marketing reporting",
    detail:
      "{{brand}} was named, because the pages Emory restructured six weeks earlier are now what assistants read. No click was recorded anywhere — this arrival would have shown as Direct in any analytics tool.",
  },
  {
    id: "t-2",
    personId: "p-dana",
    at: ago(14_398),
    agentId: "ledge",
    channel: "Website",
    title: "Landed on the comparison page and read for four minutes",
    detail: "Read the comparison block and the section on matching ad platform numbers.",
  },
  {
    id: "t-3",
    personId: "p-dana",
    at: ago(14_395),
    agentId: "envoy",
    channel: "Website chat",
    title: "Asked whether it works with Looker, at 9:17pm",
    detail:
      "Emory answered from your documentation, confirmed the integration, and offered a call. You were not online.",
  },
  {
    id: "t-4",
    personId: "p-dana",
    at: ago(14_395),
    agentId: "guard",
    channel: "Consent",
    title: "Permission checked before the first message went out",
    detail: "Passed. Consent recorded for email and chat, with the lawful basis stored.",
  },
  {
    id: "t-5",
    personId: "p-dana",
    at: ago(14_391),
    agentId: "forge",
    channel: "CRM",
    title: "Scored hot at $4,800 a year and created in HubSpot",
    detail:
      "Thursday 11am booked. You were notified with the conversation attached, not just an email address.",
    value: "$4,800 potential",
  },
  {
    id: "t-6",
    personId: "p-dana",
    at: ago(13_000),
    agentId: "envoy",
    channel: "Email",
    title: "Reminder sent with the two pages she had read",
    detail: "She confirmed the call the same hour.",
  },
  {
    id: "t-7",
    personId: "p-dana",
    at: ago(11_600),
    agentId: "forge",
    channel: "Call",
    title: "Call happened, trial started, payment link sent on conversion",
    detail: "Objection raised on the call: whether the numbers match ad platforms. Written back into the Brain.",
    value: "$4,800 booked",
  },
  {
    id: "t-8",
    personId: "p-dana",
    at: ago(8_600),
    agentId: "beacon",
    channel: "Review",
    title: "Asked for a review once she had sent three reports",
    detail: "She left one. Emory replied the same day.",
  },
  {
    id: "t-9",
    personId: "p-dana",
    at: ago(4_320),
    agentId: "write",
    channel: "Website",
    title: "Her question became a page, because thirteen others asked it too",
    detail:
      "Nobody requested this. Emory noticed the question repeating in chat and published the integration page.",
  },
  {
    id: "t-10",
    personId: "p-dana",
    at: ago(120),
    agentId: "ledge",
    channel: "Revenue",
    title: "$4,800 attributed to an AI assistant answer",
    detail:
      "A channel that shows as Direct in every analytics tool you could have bought instead.",
    value: "$4,800 attributed",
  },
  {
    id: "t-11",
    personId: "p-marcus",
    at: ago(4_300),
    agentId: "beacon",
    channel: "Search",
    title: "Found the comparison page from a search carrying your name",
    detail: "The page Emory published in answer to Cadence.",
  },
  {
    id: "t-12",
    personId: "p-marcus",
    at: ago(4_290),
    agentId: "envoy",
    channel: "Website chat",
    title: "Asked whether the numbers match his ad platforms",
    detail:
      "Emory answered with the frozen-window explanation. The question was written back into the Brain — it is now the most asked question before a purchase.",
  },
  {
    id: "t-13",
    personId: "p-marcus",
    at: ago(4_280),
    agentId: "forge",
    channel: "CRM",
    title: "Scored 78 and created in HubSpot with the conversation attached",
    detail: "Marked as evaluating, with a follow-up due if he goes quiet for five days.",
    value: "$3,200 potential",
  },
  {
    id: "t-14",
    personId: "p-marcus",
    at: ago(300),
    agentId: "forge",
    channel: "Email",
    title: "Five days quiet. A follow-up is waiting for your approval",
    detail: "Drafted against what he actually asked, not a template.",
  },
  {
    id: "t-15",
    personId: "p-sofia",
    at: ago(21_000),
    agentId: "forge",
    channel: "Referral",
    title: "Introduced by an existing customer",
    detail: "Referral is your cheapest channel and, until now, entirely unmanaged.",
  },
  {
    id: "t-16",
    personId: "p-sofia",
    at: ago(19_000),
    agentId: "envoy",
    channel: "Product",
    title: "Built three reports in the first trial week",
    detail: "Real usage, then nothing.",
  },
  {
    id: "t-17",
    personId: "p-sofia",
    at: ago(17_280),
    agentId: "forge",
    channel: "Email",
    title: "Twelve days quiet — included in the batch of 34 awaiting approval",
    detail: "The largest recoverable number on your account this week.",
    value: "$5,600 in reach",
  },
  {
    id: "t-18",
    personId: "p-arun",
    at: ago(180),
    agentId: "ledge",
    channel: "Website",
    title: "Arrived with no referrer — reclassified as an AI assistant",
    detail:
      "Analytics filed this as Direct. Emory's own measurement identified the assistant.",
  },
  {
    id: "t-19",
    personId: "p-arun",
    at: ago(170),
    agentId: "envoy",
    channel: "Website chat",
    title: "Asked about the seat minimum",
    detail: "Emory answered from your pricing. No call booked yet; a follow-up is scheduled for tomorrow.",
  },
  {
    id: "t-20",
    personId: "p-lena",
    at: ago(2_800),
    agentId: "forge",
    channel: "Product",
    title: "Usage flat for three weeks and nobody has spoken to her",
    detail: "Emory has a check-in prepared, held until you approve the batch.",
    value: "$7,200 at risk",
  },
  {
    id: "t-21",
    personId: "p-tomas",
    at: ago(9_100),
    agentId: "beacon",
    channel: "Search",
    title: "Found an article, downloaded the report template",
    detail: "Came back twice in the following week.",
  },
  {
    id: "t-22",
    personId: "p-tomas",
    at: ago(1_500),
    agentId: "envoy",
    channel: "Website chat",
    title: "Asked what happens when their stack changes",
    detail: "The fourth most common objection. Answered, and logged against the objection list.",
  },
];

/* ---------------- Revenue: one number, and how it was arrived at ---------------- */

export const OWNER_METRICS = [
  { id: "leads", label: "Leads", value: "63", direction: "up" as const, note: "Last 30 days · 48 the month before" },
  { id: "cpl", label: "Cost per lead", value: "$41", direction: "down" as const, note: "Down from $58 after the budget move" },
  { id: "conversations", label: "Conversations", value: "212", direction: "up" as const, note: "59% of them outside working hours" },
  { id: "revenue", label: "Revenue", value: "$38,400", direction: "up" as const, note: "Booked in the last 30 days" },
];

export const REVENUE_SOURCES: RevenueSource[] = [
  {
    id: "rs-ai",
    label: "AI assistant answers",
    revenue: 12800,
    leads: 19,
    note: "Would have shown as Direct in any analytics tool. Identified by Emory's own measurement.",
    reclassified: true,
  },
  { id: "rs-organic", label: "Search", revenue: 11400, leads: 21, note: "Mostly the comparison and integration pages." },
  { id: "rs-referral", label: "Referral", revenue: 6800, leads: 7, note: "Your cheapest channel, and until now unmanaged." },
  { id: "rs-paid", label: "Paid search", revenue: 4900, leads: 11, note: "84% of brand spend produced signups that would have arrived anyway." },
  { id: "rs-direct", label: "Direct", revenue: 2500, leads: 5, note: "What is left of Direct once assistant traffic is taken out." },
];

export const EXPERIMENTS: Experiment[] = [
  {
    id: "ex-brand",
    name: "Brand search holdout",
    method: "Paused brand ads in two matched regions for four weeks",
    reading: "84% of brand spend produced signups that arrived anyway",
    confidence: "High · 4 weeks, 2 regions",
    agentId: "ledge",
  },
  {
    id: "ex-comparison",
    name: "Comparison page lift",
    method: "Region holdout on the page published in answer to Cadence",
    reading: "+14 signups a month attributable to the page",
    confidence: "Medium · 3 weeks, still running",
    agentId: "ledge",
  },
  {
    id: "ex-afterhours",
    name: "Out-of-hours answering",
    method: "Alternating weeks with and without instant answers after 7pm",
    reading: "Waiting on approval before it can start",
    confidence: "Not started",
    agentId: "envoy",
  },
];

export const PROOF_LINES: ProofLine[] = [
  {
    label: "Getting found",
    did: "Fixed 14 missing page descriptions, published one comparison page, recovered 190 hidden articles",
    produced: "21 leads from search, up from 12",
    separately: "Search tooling $130 + freelance time",
  },
  {
    label: "Getting recommended by AI",
    did: "Restructured the pages assistants read, corrected two stale sources",
    produced: "19 leads and $12,800, from a channel you could not previously see",
    separately: "No tool on the market does this",
  },
  {
    label: "Answering customers",
    did: "212 conversations handled, 74 buying questions answered, 9 calls booked",
    produced: "Median first reply under a minute",
    separately: "Chat tool $99 + the person answering",
  },
  {
    label: "Chasing what stalled",
    did: "Prepared 34 follow-ups on lapsed trials with real usage behind them",
    produced: "$41,200 back in reach",
    separately: "Nobody was doing this",
  },
  {
    label: "Knowing what worked",
    did: "Ran a brand holdout and a page lift test, reclassified a third of Direct",
    produced: "$2,000 a month of spend identified as producing nothing",
    separately: "Usually absent",
  },
  {
    label: "Staying out of trouble",
    did: "Stopped one performance claim before it was written, removed 3 opted-out contacts",
    produced: "Nothing published that needs evidence you do not have",
    separately: "Usually absent",
  },
];

/* ---------------- Connections ---------------- */

export const CONNECTORS: Connector[] = [
  {
    id: "cn-analytics",
    name: "Google Analytics",
    category: "Measurement",
    direction: "read",
    feeds: ["ledge", "beacon"],
    detail: "Where visitors come from and what they do. Emory's own measurement corrects what this cannot see.",
    connected: true,
    health: "ok",
    healthNote: "Reading normally · last sync 11 minutes ago",
  },
  {
    id: "cn-search",
    name: "Google Search Console",
    category: "Measurement",
    direction: "read",
    feeds: ["beacon", "scout"],
    detail: "What people search before they reach you, and where you appear.",
    connected: true,
    health: "ok",
    healthNote: "Reading normally · last sync 34 minutes ago",
  },
  {
    id: "cn-site",
    name: "Your website",
    category: "Publishing",
    direction: "both",
    feeds: ["beacon", "write", "studio"],
    detail: "Changes to product pages arrive in your repository as a pull request. Nothing merges without a human.",
    connected: true,
    health: "ok",
    healthNote: "Next.js on Vercel · 3 changes merged this month",
  },
  {
    id: "cn-wordpress",
    name: "WordPress",
    category: "Publishing",
    direction: "both",
    feeds: ["write", "beacon"],
    detail: "Articles arrive as drafts with everything filled in. You press publish.",
    connected: true,
    health: "expiring",
    healthNote: "Access expires in 6 days. Reconnect before it goes quiet.",
  },
  {
    id: "cn-hubspot",
    name: "HubSpot",
    category: "Pipeline",
    direction: "both",
    feeds: ["forge", "ledge"],
    detail: "Emory reads your contacts and writes back scores, conversations and stage changes. Keep the CRM you have.",
    connected: true,
    health: "ok",
    healthNote: "1,847 contacts in sync",
  },
  {
    id: "cn-chat",
    name: "Website chat",
    category: "Conversations",
    direction: "both",
    feeds: ["envoy"],
    detail: "The first place a visitor can ask something. Emory answers from what it knows about your product.",
    connected: true,
    health: "ok",
    healthNote: "212 conversations in the last 30 days",
  },
  {
    id: "cn-whatsapp",
    name: "WhatsApp",
    category: "Conversations",
    direction: "both",
    feeds: ["envoy", "forge"],
    detail: "Through an existing provider. Message fees pass through at cost; Emory takes no margin on them.",
    connected: false,
    health: "unavailable",
    healthNote: "Not connected",
  },
  {
    id: "cn-google-ads",
    name: "Google Ads",
    category: "Paid",
    direction: "both",
    feeds: ["media", "ledge"],
    detail: "Emory reads performance now and will run campaigns when Media activates in April.",
    connected: true,
    health: "ok",
    healthNote: "Reading only until Media activates",
  },
  {
    id: "cn-meta",
    name: "Meta Ads",
    category: "Paid",
    direction: "both",
    feeds: ["media", "ledge"],
    detail: "Approval from Meta takes several weeks, so this is started long before Media needs it.",
    connected: false,
    health: "unavailable",
    healthNote: "Not connected · review takes 2–4 weeks",
  },
  {
    id: "cn-profile",
    name: "Google Business Profile",
    category: "Presence",
    direction: "both",
    feeds: ["beacon"],
    detail: "Categories, hours, photos, posts and questions. The highest-intent surface most businesses ignore.",
    connected: true,
    health: "ok",
    healthNote: "1 post published this month",
  },
  {
    id: "cn-linkedin",
    name: "LinkedIn",
    category: "Presence",
    direction: "both",
    feeds: ["write"],
    detail: "Posts and replies, written by Write and delivered here. Reading works today; posting activates with Write.",
    connected: false,
    health: "unavailable",
    healthNote: "Not connected",
  },
  {
    id: "cn-stripe",
    name: "Stripe",
    category: "Revenue",
    direction: "read",
    feeds: ["ledge", "forge"],
    detail: "What actually got paid. Without it, Emory can show you leads but not revenue.",
    connected: true,
    health: "ok",
    healthNote: "Reading normally",
  },
];

/* ---------------- Today ---------------- */

export const SHIPPED_THIS_WEEK = [
  {
    id: "sh-1",
    agentId: "beacon" as const,
    title: "Published the integration page fourteen people asked for",
    result: "Live since Tuesday · 41 views, 3 trials started",
  },
  {
    id: "sh-2",
    agentId: "beacon" as const,
    title: "Posted this month's update to your business profile",
    result: "Profile views up 6% week on week",
  },
  {
    id: "sh-3",
    agentId: "envoy" as const,
    title: "Answered 212 conversations, 9 of them booked a call",
    result: "Median first reply: 40 seconds",
  },
  {
    id: "sh-4",
    agentId: "ledge" as const,
    title: "Reclassified 34% of Direct traffic as AI assistant answers",
    result: "$12,800 of revenue moved to a channel you could not previously see",
  },
];

export const WAITING_ON = [
  {
    id: "wa-1",
    agentId: "write" as const,
    title: "Two comparison pages are drafted and waiting for Write to activate",
    note: "Activating March. Nothing appears in your queue until it passes its readiness standard.",
  },
  {
    id: "wa-2",
    agentId: "media" as const,
    title: "Budget recommendations are ready but Media cannot execute yet",
    note: "Activating April. Ledge can still tell you where the money is going nowhere.",
  },
];
