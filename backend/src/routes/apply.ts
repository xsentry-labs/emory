import { Router } from "express";
import { z } from "zod";
import { loadRun, saveRun } from "../approval/store.js";
import { withRunLock } from "../approval/runLock.js";
import { generateFixFiles } from "../coding/agent.js";
import { openFixPr } from "../coding/github.js";
import { writeLocalPatch } from "../coding/localPatch.js";
import { asyncHandler } from "../util/asyncHandler.js";

export const applyRouter = Router();

const applySchema = z.object({
  owner: z.string().optional(),
  repo: z.string().optional(),
  baseBranch: z.string().optional(),
});

/**
 * Implements only the suggestions with status "approved" — anything still
 * "pending" or "rejected" is left untouched. This is the one endpoint that
 * actually writes/publishes anything, and it can only act on decisions
 * already recorded through the approvals endpoint.
 */
applyRouter.post(
  "/:runId/apply",
  asyncHandler(async (req, res) => {
    const parsed = applySchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    // Claim the run for "applying" under the lock so two concurrent /apply
    // calls (or a retry racing the original) can't both start generating
    // fixes and opening two PRs for the same approved set.
    const claim = await withRunLock(req.params.runId, async () => {
      const run = await loadRun(req.params.runId);
      if (!run) return { ok: false as const, status: 404, body: { error: "run not found" } };
      if (run.status === "applying") {
        return { ok: false as const, status: 409, body: { error: "this run is already being applied" } };
      }
      if (run.status === "applied") {
        return { ok: false as const, status: 409, body: { error: "this run has already been applied", run } };
      }
      const approvedCount = run.suggestions.filter((s) => s.status === "approved").length;
      if (approvedCount === 0) {
        return { ok: false as const, status: 400, body: { error: "no approved suggestions to apply — approve at least one first" } };
      }
      run.status = "applying";
      await saveRun(run);
      return { ok: true as const, run };
    });

    if (!claim.ok) {
      return res.status(claim.status).json(claim.body);
    }

    const run = claim.run;
    try {
      const files = await generateFixFiles(run);

      try {
        run.prUrl = await openFixPr(run, files, parsed.data);
      } catch (prErr) {
        // No GitHub configured, or the PR call failed — fall back to a local
        // patch directory so approved work is never silently lost.
        run.patchDir = await writeLocalPatch(run.id, files);
        run.error = `GitHub PR not created (${prErr instanceof Error ? prErr.message : String(prErr)}); wrote local patch instead.`;
      }

      for (const s of run.suggestions) {
        if (s.status === "approved") {
          s.status = "applied";
          s.appliedAt = new Date().toISOString();
        }
      }
      run.status = "applied";
      await saveRun(run);
      res.json(run);
    } catch (err) {
      run.status = "failed";
      run.error = err instanceof Error ? err.message : String(err);
      await saveRun(run);
      res.status(500).json({ error: run.error });
    }
  }),
);
