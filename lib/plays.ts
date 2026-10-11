/**
 * Plays: named, repeatable lead hunts built around a buying signal. Each play is
 * a focus handed to the lead finder, so the leads it returns come with the
 * evidence of why now (an RFP, a job post, a funding round...).
 */
export interface Play {
  id: string;
  title: string;
  blurb: string;
  /** What the play looks for, shown on the card. */
  signal: string;
  /** Appended to the lead-finder prompt. Keep under 300 characters. */
  focus: string;
  /** Leads requested per run. */
  leads: number;
  locked?: boolean;
}

export const PLAYS: Play[] = [
  {
    id: "best-fit",
    title: "Best-fit companies",
    blurb: "The strongest matches for your ideal customer, from any signal.",
    signal: "Fit with your ICP",
    focus: "",
    leads: 10,
  },
  {
    id: "open-rfps",
    title: "Public tenders and RFPs",
    blurb: "Organisations that have published a request for work you can do.",
    signal: "A published RFP, RFQ or tender",
    focus:
      "Organisations that recently published an RFP, RFQ or tender for work matching the offer. Include the contact named in the notice and link the notice itself as source_url.",
    leads: 10,
  },
  {
    id: "hiring-signals",
    title: "Hiring for the problem you solve",
    blurb: "Companies posting jobs that show they need what you sell.",
    signal: "Open roles or contractor posts that imply the need",
    focus:
      "Companies currently hiring (job posts, contractor or freelance requests) for roles that show they have the problem the offer solves. Link the job post as source_url.",
    leads: 10,
  },
  {
    id: "recently-funded",
    title: "Recently funded companies",
    blurb: "Teams that just raised money and are likely to invest in your area.",
    signal: "A funding round in the last 6 months",
    focus:
      "Companies that announced a funding round in the last 6 months and plausibly need the offer. State the round size and date in the notes and link the announcement as source_url.",
    leads: 10,
  },
  {
    id: "new-leaders",
    title: "New decision-makers",
    blurb: "A new leader's first 90 days is when budgets and vendors change.",
    signal: "A new relevant leader appointed recently",
    focus:
      "Companies that recently appointed a new leader in the function that would buy the offer (for example a new head of engineering, marketing or operations). Name the person and link the announcement as source_url.",
    leads: 10,
  },
  {
    id: "launches-and-moves",
    title: "Launches and expansions",
    blurb: "Product launches, new markets and migrations create sudden needs.",
    signal: "A launch, expansion or migration announcement",
    focus:
      "Companies that recently announced a product launch, new market, rebrand, migration or major initiative that creates a need for the offer. Link the announcement as source_url.",
    leads: 10,
  },
  {
    id: "reddit-asks",
    title: "People asking for help on Reddit",
    blurb: "Threads where someone asks for exactly what you provide.",
    signal: "Reddit and X posts requesting your kind of help",
    focus: "",
    leads: 0,
    locked: true,
  },
];

export const playById = (id: string): Play | undefined => PLAYS.find((p) => p.id === id);

/** Rough cost shown on the card: one search plus two model calls per lead. */
export const estimateCalls = (play: Play): number => 1 + play.leads * 2;
