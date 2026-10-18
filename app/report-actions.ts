"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAccountsDb } from "@/lib/accounts";
import { getWorkspaceDb } from "@/lib/db";
import { pageSpeed } from "@/lib/integrations/pagespeed";
import { kickoffTracks } from "@/lib/kickoff";
import { isLlmConfigured, openRouterLlm } from "@/lib/llm";
import { allow } from "@/lib/ratelimit";
import { claimReport, parseTracks, runningReports, startReport } from "@/lib/report";
import { currentUser } from "@/lib/request-db";

const MAX_RUNNING = 4;
const clientKey = () => headers().get("x-forwarded-for")?.split(",")[0].trim() || "local";
const back = (error: string, website = ""): never =>
  redirect(`/start?error=${encodeURIComponent(error)}${website ? `&website=${encodeURIComponent(website)}` : ""}`);

/** Public: start a site report. No account needed. */
export async function startReportAction(formData: FormData) {
  const website = String(formData.get("website") ?? "").trim().slice(0, 300);
  if (!website) back("Enter your website address.");
  if (!allow(`report:${clientKey()}`, 5, 60 * 60_000)) back("You've run a few reports already. Try again in an hour.", website);
  if (runningReports() >= MAX_RUNNING) back("Emory is busy reading other sites. Try again in a minute.", website);
  let id = "";
  try {
    id = startReport(getAccountsDb(), website, clientKey(), { llm: isLlmConfigured() ? openRouterLlm : null, speed: (url) => pageSpeed(url) });
  } catch (err) {
    back(err instanceof Error ? err.message : "Couldn't start the scan.", website);
  }
  redirect(`/report/${id}`);
}

/**
 * Save a report. Signed in: claim it into this workspace now. Signed out:
 * carry the report, email and chosen tracks to sign-up, which claims it.
 */
export async function saveReportAction(formData: FormData) {
  const id = String(formData.get("report") ?? "");
  const tracks = parseTracks(formData.getAll("track").map(String));
  const user = currentUser();
  if (!user) {
    const q = new URLSearchParams({ report: id, email: String(formData.get("email") ?? "").trim().slice(0, 320) });
    for (const t of tracks) q.append("track", t);
    redirect(`/signup?${q}`);
  }
  const db = getWorkspaceDb(user!.workspaceId);
  if (claimReport(getAccountsDb(), id, user!.workspaceId, db, tracks)) kickoffTracks(db);
  redirect("/setup/connect");
}
