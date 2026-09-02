import { Router } from "express";
import { z } from "zod";
import { loadRun, saveRun } from "../approval/store.js";
import { renderMarkdown } from "../synth/report.js";

export const approvalsRouter = Router();

const decisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  edits: z.object({ recommendedChange: z.string().optional(), note: z.string().optional() }).optional(),
});

/** Human-in-the-loop gate: the only way a suggestion's status can leave "pending". */
approvalsRouter.post("/:runId/suggestions/:suggestionId", async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const run = await loadRun(req.params.runId);
  if (!run) return res.status(404).json({ error: "run not found" });

  const suggestion = run.suggestions.find((s) => s.id === req.params.suggestionId);
  if (!suggestion) return res.status(404).json({ error: "suggestion not found" });
  if (suggestion.status === "applied") {
    return res.status(409).json({ error: "suggestion already applied, decision can no longer change" });
  }

  suggestion.status = parsed.data.decision === "approve" ? "approved" : "rejected";
  suggestion.edits = parsed.data.edits;
  suggestion.decidedAt = new Date().toISOString();

  run.reportMarkdown = renderMarkdown(run);
  await saveRun(run);
  res.json(suggestion);
});

approvalsRouter.get("/:runId", async (req, res) => {
  const run = await loadRun(req.params.runId);
  if (!run) return res.status(404).json({ error: "run not found" });
  res.json(run.suggestions);
});
