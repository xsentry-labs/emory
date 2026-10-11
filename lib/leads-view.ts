import type { DB } from "./db";
import { getPipeline, type PipelineState } from "./pipeline";
import { tierFor, type Tier } from "./qualify";
import { listLeadsWithDrafts } from "./repo";

export interface LeadView {
  id: number;
  name: string;
  company: string;
  website: string;
  email: string;
  status: string;
  score: number | null;
  tier: Tier | null;
  /** ICP fit, Need, Budget, Authority, Timing ratings (0-3), when scored. */
  ratings: { icpFit: number; need: number; budget: number; authority: number; timing: number } | null;
  why: string;
  summary: string;
  draft: { id: number; subject: string; body: string; status: string } | null;
}

export interface LeadsPayload {
  pipeline: PipelineState;
  leads: LeadView[];
}

export function leadsPayload(db: DB): LeadsPayload {
  const leads = listLeadsWithDrafts(db).map((r): LeadView => ({
    id: r.id,
    name: r.name,
    company: r.company,
    website: r.website,
    email: r.email,
    status: r.status,
    score: r.score,
    tier: r.score === null ? null : tierFor(r.score),
    ratings:
      r.score === null
        ? null
        : {
            icpFit: r.icp_fit ?? 0,
            need: r.bant_need ?? 0,
            budget: r.bant_budget ?? 0,
            authority: r.bant_authority ?? 0,
            timing: r.bant_timing ?? 0,
          },
    why: r.score_rationale,
    summary: r.research_summary,
    draft:
      r.draft_id === null
        ? null
        : { id: r.draft_id, subject: r.draft_subject ?? "", body: r.draft_body ?? "", status: r.draft_status ?? "" },
  }));
  return { pipeline: getPipeline(db), leads };
}
