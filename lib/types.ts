export type AgentId =
  | "audit"
  | "scout"
  | "beacon"
  | "write"
  | "studio"
  | "media"
  | "envoy"
  | "forge"
  | "hunt"
  | "ledge"
  | "guard";

export type Agent = {
  id: AgentId;
  /** "Emory Beacon" */
  name: string;
  /** "Beacon" — used in chips and navigation. */
  short: string;
  /** Fixed wording from the messaging bible. Never varied. */
  line: string;
  hex: string;
  /** Beacon and Studio carry black text; the other nine carry white. */
  onColor: "light" | "dark";
  wave: 1 | 2 | 3 | 4;
  status: "live" | "activating";
  activating?: string;
  capabilities: string[];
  tiers: { name: string; price: string; includes: string }[];
  metered: string;
};

export type RiskClass = "low" | "medium" | "high";
export type ActionStatus = "queued" | "approved" | "executed" | "declined";

export type EmoryAction = {
  id: string;
  agentId: AgentId;
  /** What Emory wants to do, in business language. */
  title: string;
  /** Why it is being proposed. */
  why: string;
  target: string;
  current: string | null;
  proposed: string;
  impact: { metric: string; estimate: string };
  risk: RiskClass;
  reversible: boolean;
  status: ActionStatus;
  createdAt: string;
  /** Set once approved or auto-run. */
  ranAt?: string;
  /** Guard's note, when Guard rewrote or gated this. */
  guard?: string;
  /** Action type, used for per-type autonomy promotion. */
  kind: string;
  kindLabel: string;
  edited?: boolean;
};

export type BrainSource = "inferred" | "confirmed" | "learned" | "observed";

export type BrainField = {
  id: string;
  group: string;
  label: string;
  value: string;
  confidence: number;
  source: BrainSource;
  /** Where it came from, in one phrase. */
  origin: string;
  multiline?: boolean;
};

export type BrainChange = {
  id: string;
  at: string;
  agentId: AgentId;
  field: string;
  before: string;
  after: string;
  why: string;
  source: BrainSource;
};

export type PersonStatus = "new" | "qualified" | "customer" | "stalled";

export type Person = {
  id: string;
  name: string;
  company: string;
  role: string;
  status: PersonStatus;
  value: number;
  score: number;
  firstSeen: string;
  lastTouch: string;
  /** One line an owner can read without opening the record. */
  summary: string;
  arrivedFrom: string;
};

export type TimelineEvent = {
  id: string;
  personId: string;
  at: string;
  agentId: AgentId;
  channel: string;
  title: string;
  detail: string;
  value?: string;
};

export type AuditFinding = {
  id: string;
  /** Business language, never "schema" or "canonical". */
  title: string;
  detail: string;
  costing: string;
  severity: "critical" | "warning" | "notice";
  pages: number;
  /** The agent that owns the fix. Audit never fixes anything. */
  ownerId: AgentId;
  /** The action this becomes once the customer starts. */
  actionId?: string;
};

export type Connector = {
  id: string;
  name: string;
  category: string;
  direction: "read" | "write" | "both";
  /** Which agents go quiet without it. */
  feeds: AgentId[];
  detail: string;
  connected: boolean;
  health: "ok" | "expiring" | "unavailable";
  healthNote: string;
};

export type ProofLine = {
  label: string;
  did: string;
  produced: string;
  separately: string;
};

export type Experiment = {
  id: string;
  name: string;
  method: string;
  reading: string;
  confidence: string;
  agentId: AgentId;
};

export type RevenueSource = {
  id: string;
  label: string;
  revenue: number;
  leads: number;
  note: string;
  reclassified?: boolean;
};

export type OnboardingQuestion = {
  id: string;
  question: string;
  /** Emory's own inference. Never a blank field. */
  answer: string;
  confidence: number;
  origin: string;
  multiline?: boolean;
};

export type Workspace = {
  domain: string;
  company: string;
  /** "Building" or "Running" — the product sorts them, not the marketing. */
  state: "building" | "running";
  platform: string;
  plan: string;
};
