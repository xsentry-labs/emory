import { chosenTracks } from "./connections";
import type { DB } from "./db";
import { isLlmConfigured, openRouterLlm, openRouterSearch } from "./llm";
import { startPipeline } from "./pipeline";
import { getProfile } from "./repo";
import { consume } from "./usage";

/**
 * After a report is saved: if the workspace picked the leads track and the
 * report produced an ideal customer, start the first lead search so leads are
 * arriving by the time the user reaches "today". Best effort; never throws.
 */
export function kickoffTracks(db: DB): void {
  try {
    if (!chosenTracks(db).includes("leads") || !isLlmConfigured() || !getProfile(db).icp) return;
    consume(db, "hunt");
    startPipeline(db, { search: openRouterSearch, llm: openRouterLlm }, { count: 10 });
  } catch (err) {
    console.error("[kickoff] lead search not started:", err instanceof Error ? err.message : err);
  }
}
