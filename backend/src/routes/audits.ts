import { Router } from "express";
import { z } from "zod";
import { runAuditPipeline } from "../pipeline.js";
import { loadRun, listRuns } from "../approval/store.js";

export const auditsRouter = Router();

const startSchema = z.object({
  url: z.string().min(3),
  constraints: z.string().nullish(),
  docs: z.array(z.object({ name: z.string(), text: z.string() })).optional(),
  maxPages: z.number().int().positive().max(500).optional(),
});

/**
 * Starts an audit and responds once it reaches "awaiting_approval" (or
 * "failed"). A real crawl + multi-agent audit can take a while on a large
 * site — for the MVP this is a synchronous request; swap for a queued job +
 * polling if audits start timing out on the hosting platform.
 */
auditsRouter.post("/", async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const run = await runAuditPipeline(parsed.data);
    res.status(run.status === "failed" ? 500 : 201).json(run);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

auditsRouter.get("/", async (_req, res) => {
  const runs = await listRuns();
  res.json(
    runs.map((r) => ({
      id: r.id,
      url: r.url,
      status: r.status,
      score: r.score,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      suggestionCount: r.suggestions.length,
    })),
  );
});

auditsRouter.get("/:id", async (req, res) => {
  const run = await loadRun(req.params.id);
  if (!run) return res.status(404).json({ error: "run not found" });
  res.json(run);
});

auditsRouter.get("/:id/report.md", async (req, res) => {
  const run = await loadRun(req.params.id);
  if (!run) return res.status(404).json({ error: "run not found" });
  res.type("text/markdown").send(run.reportMarkdown ?? "# Report not ready yet");
});
