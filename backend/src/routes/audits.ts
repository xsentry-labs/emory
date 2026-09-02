import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { runAuditPipeline } from "../pipeline.js";
import { loadRun, listRuns } from "../approval/store.js";
import { asyncHandler } from "../util/asyncHandler.js";

export const auditsRouter = Router();

const startSchema = z.object({
  url: z.string().min(3),
  constraints: z.string().nullish(),
  docs: z.array(z.object({ name: z.string(), text: z.string() })).optional(),
  maxPages: z.number().int().positive().max(500).optional(),
});

// A full audit crawls a site and makes many LLM calls — the single most
// expensive endpoint in this service. A generous but real ceiling keeps a
// misbehaving client (or a scripted loop) from silently running up spend;
// tune via RATE_LIMIT_AUDITS_PER_HOUR.
const startAuditLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_AUDITS_PER_HOUR ?? 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many audits started from this client in the last hour. Try again later." },
});

function normalizedUrlOrNull(input: string): string | null {
  try {
    const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}

/**
 * Starts an audit and responds once it reaches "awaiting_approval" (or
 * "failed"). A real crawl + multi-agent audit can take a while on a large
 * site — for the MVP this is a synchronous request; swap for a queued job +
 * polling if audits start timing out on the hosting platform.
 */
auditsRouter.post(
  "/",
  startAuditLimiter,
  asyncHandler(async (req, res) => {
    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    if (!normalizedUrlOrNull(parsed.data.url)) {
      return res.status(400).json({ error: `"${parsed.data.url}" is not a usable URL or domain.` });
    }
    const run = await runAuditPipeline(parsed.data);
    res.status(run.status === "failed" ? 500 : 201).json(run);
  }),
);

auditsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
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
  }),
);

auditsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const run = await loadRun(req.params.id);
    if (!run) return res.status(404).json({ error: "run not found" });
    res.json(run);
  }),
);

auditsRouter.get(
  "/:id/report.md",
  asyncHandler(async (req, res) => {
    const run = await loadRun(req.params.id);
    if (!run) return res.status(404).json({ error: "run not found" });
    res.type("text/markdown").send(run.reportMarkdown ?? "# Report not ready yet");
  }),
);
