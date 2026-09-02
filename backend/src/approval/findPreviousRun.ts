import type { AuditRun } from "../types.js";
import { listRuns, loadRun } from "./store.js";

/**
 * The most recent prior *completed* run for the same URL as `current`, or
 * null if this is the first run for that URL. Shared by the diff route and
 * the re-audit scheduler so "what counts as a comparable prior run" (same
 * URL, not itself, older, not failed) can't drift between the two.
 */
export async function findPreviousRun(current: AuditRun): Promise<AuditRun | null> {
  const allRuns = await listRuns();
  const previousSummary = allRuns
    .filter((r) => r.url === current.url && r.id !== current.id && r.createdAt < current.createdAt && r.status !== "failed")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (!previousSummary) return null;
  return loadRun(previousSummary.id);
}
