import { Router } from "express";
import { z } from "zod";
import { loadRun, saveRun } from "../approval/store.js";
import { generateFixFiles } from "../coding/agent.js";
import { openFixPr } from "../coding/github.js";
import { writeLocalPatch } from "../coding/localPatch.js";

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
applyRouter.post("/:runId/apply", async (req, res) => {
  const parsed = applySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const run = await loadRun(req.params.runId);
  if (!run) return res.status(404).json({ error: "run not found" });

  const approvedCount = run.suggestions.filter((s) => s.status === "approved").length;
  if (approvedCount === 0) {
    return res.status(400).json({ error: "no approved suggestions to apply — approve at least one first" });
  }

  run.status = "applying";
  await saveRun(run);

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
});
