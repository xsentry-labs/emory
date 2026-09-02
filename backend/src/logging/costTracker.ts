import type { AuditRun, ModelCallLog } from "../types.js";
import { config } from "../config.js";

/**
 * Binds a run's cost ledger so LLM call sites don't need to know about the
 * run object — pass the returned `onUsage` into `complete()`/`completeJson()`.
 */
export function bindCostTracker(run: AuditRun) {
  return {
    onUsage(log: ModelCallLog) {
      run.modelCalls.push(log);
      run.costUsd = round(run.costUsd + log.estUsd);
    },
    /** Strong-tier calls are refused once the run is over its cost ceiling; cheap/mid never are. */
    ceilingExceeded(): boolean {
      if (config.costCeilingUsd <= 0) return false;
      return run.costUsd >= config.costCeilingUsd;
    },
  };
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
