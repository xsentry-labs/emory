import express from "express";
import cors from "cors";
import pinoHttpPkg from "pino-http";
// Same NodeNext/CJS interop gap as robots-parser: it's callable at runtime.
const pinoHttp = pinoHttpPkg as unknown as (opts?: unknown) => express.RequestHandler;
import { config } from "./config.js";
import { auditsRouter } from "./routes/audits.js";
import { approvalsRouter } from "./routes/approvals.js";
import { applyRouter } from "./routes/apply.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(pinoHttp());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/audits", auditsRouter);
app.use("/approvals", approvalsRouter);
app.use("/audits", applyRouter);

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`emory-audit-backend listening on :${config.port}`);
});
