import type { DB } from "./db";
import { draftMessage } from "./draft";
import type { StructuredLlm } from "./llm";
import { getKv, setKv } from "./inbound";
import { researchLead } from "./research";
import type { Searcher } from "./sourcing";
import { sourceLeads } from "./sourcing";

export interface PipelineState {
  status: "idle" | "running" | "done" | "error";
  phase: "" | "finding" | "enriching";
  /** Leads queued for research + outreach in this run, and how many are finished. */
  total: number;
  done: number;
  added: number;
  error: string;
  startedAt: number;
  finishedAt: number | null;
}

export interface PipelineDeps {
  search: Searcher;
  llm: StructuredLlm;
  fetchText?: (url: string) => Promise<string>;
}

const KEY = "pipeline";
const CONCURRENCY = 3;
const MAX_ENRICH = 25;
const IDLE: PipelineState = { status: "idle", phase: "", total: 0, done: 0, added: 0, error: "", startedAt: 0, finishedAt: null };

const g = globalThis as unknown as { __emoryPipeline?: boolean };

const rawState = (db: DB): PipelineState => {
  const raw = getKv(db, KEY);
  return raw ? { ...IDLE, ...(JSON.parse(raw) as Partial<PipelineState>) } : IDLE;
};

export function getPipeline(db: DB): PipelineState {
  const state = rawState(db);
  // A "running" state with no live run means the server restarted mid-run.
  if (state.status === "running" && !g.__emoryPipeline) {
    return { ...state, status: "error", error: "Interrupted by a restart. Run it again.", finishedAt: state.startedAt };
  }
  return state;
}

const save = (db: DB, patch: Partial<PipelineState>) =>
  setKv(db, KEY, JSON.stringify({ ...rawState(db), ...patch }));

/**
 * Find leads for the saved ICP, then score each one and draft its first
 * outreach (queued for approval). Runs in the background; progress is read
 * with getPipeline. Returns false if a run is already in progress.
 */
export function startPipeline(db: DB, deps: PipelineDeps, opts: { count?: number; focus?: string } = {}): boolean {
  if (g.__emoryPipeline) return false;
  g.__emoryPipeline = true;
  setKv(db, KEY, JSON.stringify({ ...IDLE, status: "running", phase: "finding", startedAt: Date.now() }));
  void run(db, deps, opts)
    .catch((err) => save(db, { status: "error", phase: "", error: message(err), finishedAt: Date.now() }))
    .finally(() => {
      g.__emoryPipeline = false;
    });
  return true;
}

const message = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong.").slice(0, 300);

/** Exposed for tests: awaits the whole run instead of fire-and-forget. */
export async function run(db: DB, deps: PipelineDeps, opts: { count?: number; focus?: string }): Promise<void> {
  const found = await sourceLeads(db, deps.search, { count: opts.count ?? 10, focus: opts.focus });
  const queue = (
    db
      .prepare(
        `SELECT id FROM prospects WHERE score IS NULL
         AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.prospect_id = prospects.id AND m.direction = 'outbound')
         ORDER BY id DESC LIMIT ?`,
      )
      .all(MAX_ENRICH) as { id: number }[]
  ).map((r) => r.id);
  save(db, { phase: "enriching", added: found.added, total: queue.length, done: 0 });

  let done = 0;
  let lastError = "";
  const next = async (): Promise<void> => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      try {
        await researchLead(db, deps.llm, id, deps.fetchText);
        await draftMessage(db, deps.llm, id, "outreach");
      } catch (err) {
        lastError = message(err);
      }
      save(db, { done: ++done });
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, next));
  save(db, { status: "done", phase: "", error: lastError, finishedAt: Date.now() });
}
