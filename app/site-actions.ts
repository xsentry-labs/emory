"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { githubAppConfig, installationToken, listInstallationRepos } from "@/lib/integrations/github";
import { getConnection, removeConnection, updateConnection } from "@/lib/integrations/store";
import { isLlmConfigured, openRouterLlm } from "@/lib/llm";
import { charge } from "@/lib/quota";
import { logEvent } from "@/lib/audit";
import { actorEmail, getDb } from "@/lib/request-db";
import { startAudit } from "@/lib/seo/audit";
import { createFixPr, githubRepoAccess, writeSteps, type GithubConnection } from "@/lib/site/fixes";
import { getIssue, setIssueStatus } from "@/lib/site/issues";
import { auditDeps } from "@/lib/site/tick";
import { consume } from "@/lib/usage";

const id = z.coerce.number().int().positive();
const fail = (path: string, err: unknown, fallback: string): never =>
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(err instanceof Error ? err.message : fallback)}`);

export async function recrawl(formData: FormData) {
  const site = z.string().trim().max(300).parse(String(formData.get("site") ?? ""));
  try {
    const db = getDb();
    consume(db, "seo");
    if (isLlmConfigured()) consume(db, "ai");
    startAudit(db, auditDeps(), site);
  } catch (err) {
    fail("/site", err, "Could not start the crawl.");
  }
  redirect("/site");
}

/** Draft code edits for the chosen issues and open one pull request. */
export async function openFixPr(formData: FormData) {
  const ids = formData.getAll("issue").map((v) => id.parse(v));
  let prId = 0;
  let skipped: string[] = [];
  try {
    if (!isLlmConfigured()) throw new Error("OPENROUTER_API_KEY is not set.");
    if (ids.length === 0) throw new Error("Tick at least one issue to fix.");
    const db = getDb();
    const repo = await githubRepoAccess(db);
    consume(db, "ai");
    charge(db, "ai");
    logEvent(db, { actor: actorEmail(), track: "site", action: "asked for a fix PR", target: `${ids.length} issue${ids.length === 1 ? "" : "s"}` });
    ({ prId, skipped } = await createFixPr(db, openRouterLlm, repo, ids));
  } catch (err) {
    fail("/site", err, "Couldn't open the pull request.");
  }
  revalidatePath("/site", "layout");
  redirect(`/site/fixes?pr=${prId}${skipped.length ? `&skipped=${skipped.length}` : ""}`);
}

export async function writeIssueSteps(formData: FormData) {
  const issueId = id.parse(formData.get("issue"));
  try {
    if (!isLlmConfigured()) throw new Error("OPENROUTER_API_KEY is not set.");
    const db = getDb();
    consume(db, "ai");
    charge(db, "ai");
    await writeSteps(db, openRouterLlm, issueId);
  } catch (err) {
    fail(`/site/fixes?issue=${issueId}`, err, "Couldn't write the steps.");
  }
  redirect(`/site/fixes?issue=${issueId}`);
}

/** Dismiss an open issue, or reopen a dismissed one. */
export async function changeIssue(formData: FormData) {
  // Named "toggle" so it isn't confused with the PR checkboxes in the same form.
  const issueId = id.parse(formData.get("toggle"));
  const db = getDb();
  const issue = getIssue(db, issueId);
  if (issue) setIssueStatus(db, issueId, issue.status === "dismissed" ? "open" : "dismissed");
  revalidatePath("/site", "layout");
}

export async function chooseRepo(formData: FormData) {
  const repo = z.string().regex(/^[\w.-]+\/[\w.-]+$/).parse(String(formData.get("repo") ?? ""));
  try {
    const db = getDb();
    const conn = getConnection<GithubConnection>(db, "github");
    const cfg = githubAppConfig();
    if (!conn || !cfg) throw new Error("Connect GitHub first.");
    // Only repos this installation was granted can be chosen.
    const repos = await listInstallationRepos(await installationToken(cfg, conn.config.installationId));
    const match = repos.find((r) => r.fullName === repo);
    if (!match) throw new Error("Emory can't see that repository. Grant it access in GitHub first.");
    updateConnection<GithubConnection>(db, "github", { repo: match.fullName, base: match.defaultBranch });
  } catch (err) {
    fail("/site/settings", err, "Couldn't save the repository.");
  }
  redirect("/site/settings?connected=repo");
}

export async function disconnect(formData: FormData) {
  const provider = z.enum(["github", "google"]).parse(formData.get("provider"));
  removeConnection(getDb(), provider);
  logEvent(getDb(), { actor: actorEmail(), track: "account", action: `disconnected ${provider}` });
  redirect("/site/settings");
}
