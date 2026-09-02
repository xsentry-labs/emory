import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import pinoHttpPkg from "pino-http";
// Same NodeNext/CJS interop gap as robots-parser: it's callable at runtime.
const pinoHttp = pinoHttpPkg as unknown as (opts?: unknown) => express.RequestHandler;
import { config } from "./config.js";
import { auditsRouter } from "./routes/audits.js";
import { approvalsRouter } from "./routes/approvals.js";
import { applyRouter } from "./routes/apply.js";

const app = express();

// Open by default (this is a small internal API meant to be called from a
// frontend the operator controls); set CORS_ORIGIN to a comma-separated
// allowlist to lock it down before exposing this publicly.
const corsOrigin = process.env.CORS_ORIGIN;
app.use(cors(corsOrigin ? { origin: corsOrigin.split(",").map((o) => o.trim()) } : undefined));

app.use(express.json({ limit: "10mb" }));
app.use(pinoHttp());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/audits", auditsRouter);
app.use("/approvals", approvalsRouter);
app.use("/audits", applyRouter);

app.use((req, res) => {
  res.status(404).json({ error: `No route ${req.method} ${req.path}` });
});

// Last-resort net: any error passed to next(err) (via asyncHandler, or a
// synchronous throw, or a malformed-JSON body from express.json) lands here
// instead of crashing the process or hanging the request.
const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  req.log?.error({ err }, "unhandled request error");
  if (res.headersSent) return;
  const message = err instanceof Error ? err.message : String(err);
  const isBadJson = err instanceof SyntaxError && "body" in (err as object);
  res.status(isBadJson ? 400 : 500).json({ error: isBadJson ? "Malformed JSON body" : message });
};
app.use(errorHandler);

// Defense in depth: asyncHandler covers every route, but log rather than
// silently lose (or, on Node 15+, crash on) anything that still slips
// through — a bug in a dependency's own callback, for instance.
process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  // eslint-disable-next-line no-console
  console.error("Uncaught exception:", err);
});

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`emory-audit-backend listening on :${config.port}`);
});
