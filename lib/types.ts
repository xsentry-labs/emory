export type DeskId =
  | "seo"
  | "geo"
  | "reddit"
  | "x"
  | "linkedin"
  | "articles"
  | "hn"
  | "technical";

export type Desk = {
  id: DeskId;
  /** Short tag printed on the dispatch byline, e.g. "SEO DESK". */
  tag: string;
  /** Longer name used in nav, filters and the desk roster. */
  name: string;
  /** What this desk watches, in the wire's voice. */
  beat: string;
  /** Tailwind class fragments bound to the desk accent token. */
  dot: string;
  text: string;
  chip: string;
  rule: string;
  icon: string;
};

export type DispatchStatus = "pending" | "approved" | "live" | "spiked";
export type Priority = "urgent" | "standard" | "wire";

export type Dispatch = {
  id: string;
  deskId: DeskId;
  /** Small overline above the headline — the story slug. */
  kicker: string;
  headline: string;
  /** The draft the desk filed. Editable in the newsroom drawer. */
  body: string;
  /** Where the desk picked the story up. */
  source: string;
  impact: { label: string; value: string; note: string };
  priority: Priority;
  status: DispatchStatus;
  filedAt: string;
  tags: string[];
  /** Set when a human edits the draft. */
  editedAt?: string;
};

export type StrategyDoc = {
  id: string;
  title: string;
  kind: string;
  summary: string;
  updated: string;
  pages: number;
  sections: { heading: string; paragraphs: string[]; bullets?: string[] }[];
};

export type Competitor = {
  id: string;
  name: string;
  domain: string;
  positioning: string;
  shareOfVoice: number;
  monthlyTraffic: string;
  strength: string;
  softSpot: string;
};

export type SeoSeverity = "critical" | "warning" | "notice";

export type SeoIssue = {
  id: string;
  severity: SeoSeverity;
  title: string;
  detail: string;
  pages: number;
  actionLabel: string;
  /** When present, the issue's action deep-links to that dispatch in the feed. */
  dispatchId?: string;
  /** When there is no filed dispatch yet, the desk shows this fix preview. */
  fix: { summary: string; steps: string[]; snippet?: string };
};

export type KeywordGap = {
  id: string;
  keyword: string;
  volume: number;
  difficulty: number;
  ourRank: number | null;
  bestRival: { name: string; rank: number };
  intent: "informational" | "commercial" | "transactional";
};

export type Integration = {
  id: string;
  name: string;
  category: string;
  blurb: string;
  detail: string;
  icon: string;
  connected: boolean;
};

export type CompanyProfile = {
  domain: string;
  brand: string;
  vertical: string;
  audience: string;
  voice: string[];
  goal: string;
  positioning: string;
};

export type BrandVoiceRule = { do: string; dont: string };
