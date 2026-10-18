export const PROSPECT_STATUSES = ["new", "researching", "qualified", "contacted", "replied", "meeting", "won", "lost"] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

export type MessageStatus = "draft" | "approved" | "rejected" | "sent" | "received";
export type MessageKind = "outreach" | "followup" | "reply";

export interface Prospect {
  id: number;
  name: string;
  company: string;
  email: string;
  website: string;
  notes: string;
  status: ProspectStatus;
  source: string;
  source_url: string;
  linkedin_url: string;
  icp_fit: number | null;
  bant_budget: number | null;
  bant_authority: number | null;
  bant_need: number | null;
  bant_timing: number | null;
  score: number | null;
  research_summary: string;
  score_rationale: string;
  researched_at: number | null;
  account_id: number | null;
  title: string;
  seniority: string;
  apollo_id: string;
  email_status: "" | "verified" | "guessed" | "unavailable" | "manual";
  email_source: string;
  reports_to: number | null;
  reports_verified: number;
  buying_role: string;
  role_reason: string;
  next_followup_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface Message {
  id: number;
  prospect_id: number;
  direction: "outbound" | "inbound";
  kind: MessageKind;
  subject: string;
  body: string;
  status: MessageStatus;
  created_at: number;
  decided_at: number | null;
  sent_at: number | null;
  message_id: string;
  send_attempts: number;
  send_error: string;
}

export interface Profile {
  offer: string;
  icp: string;
}
