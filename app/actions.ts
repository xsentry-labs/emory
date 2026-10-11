"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/request-db";
import {
  createDraft,
  createProspect,
  decideDraft,
  markSent,
  updateContact,
  logReply,
  saveProfile,
  saveQualification,
  setProspectStatus,
} from "@/lib/repo";
import { PROSPECT_STATUSES } from "@/lib/types";
import { draftMessage } from "@/lib/draft";
import { researchLead } from "@/lib/research";
import { readUploads, countWords, MAX_DESCRIPTION_WORDS } from "@/lib/documents";
import { consume } from "@/lib/usage";
import { runOnboarding } from "@/lib/onboarding";
import { getPipeline, startPipeline } from "@/lib/pipeline";
import { playById } from "@/lib/plays";
import { startAudit } from "@/lib/seo/audit";
import { sourceLeads } from "@/lib/sourcing";
import { isLlmConfigured, openRouterLlm, openRouterSearch } from "@/lib/llm";

const text = (max: number) => z.string().trim().max(max);
const id = z.coerce.number().int().positive();

export async function addProspect(formData: FormData) {
  const input = z
    .object({
      name: text(200).min(1),
      company: text(200),
      email: text(320),
      website: text(500),
      notes: text(5000),
      source: text(200),
    })
    .parse(Object.fromEntries(formData));
  const newId = createProspect(getDb(), input);
  revalidatePath("/prospects");
  redirect(`/prospects/${newId}`);
}

export async function addDraft(formData: FormData) {
  const input = z
    .object({
      prospectId: id,
      kind: z.enum(["outreach", "followup"]),
      subject: text(300),
      body: text(10000).min(1),
    })
    .parse(Object.fromEntries(formData));
  createDraft(getDb(), input);
  revalidatePath(`/prospects/${input.prospectId}`);
  revalidatePath("/approvals");
}

export async function decide(formData: FormData) {
  const input = z
    .object({
      id,
      decision: z.enum(["approved", "rejected"]),
      subject: text(300),
      body: text(10000).min(1),
    })
    .parse(Object.fromEntries(formData));
  decideDraft(getDb(), input.id, input.decision, { subject: input.subject, body: input.body });
  revalidatePath("/approvals");
  revalidatePath("/prospects", "layout");
}

export async function addReply(formData: FormData) {
  const input = z.object({ prospectId: id, body: text(10000).min(1) }).parse(Object.fromEntries(formData));
  logReply(getDb(), input.prospectId, input.body);
  revalidatePath(`/prospects/${input.prospectId}`);
}

export async function changeStatus(formData: FormData) {
  const input = z
    .object({ prospectId: id, status: z.enum(PROSPECT_STATUSES) })
    .parse(Object.fromEntries(formData));
  setProspectStatus(getDb(), input.prospectId, input.status);
  revalidatePath("/prospects", "layout");
}

const rating = z.coerce.number().int().min(0).max(3);

export async function qualify(formData: FormData) {
  const input = z
    .object({ prospectId: id, icpFit: rating, budget: rating, authority: rating, need: rating, timing: rating })
    .parse(Object.fromEntries(formData));
  const { prospectId, ...q } = input;
  saveQualification(getDb(), prospectId, q);
  revalidatePath("/prospects", "layout");
}

export async function updateProfile(formData: FormData) {
  const input = z.object({ offer: text(3000), icp: text(3000) }).parse(Object.fromEntries(formData));
  saveProfile(getDb(), input);
  revalidatePath("/profile");
}

export async function generateDraft(formData: FormData) {
  const input = z.object({ prospectId: id, kind: z.enum(["outreach", "followup"]) }).parse(Object.fromEntries(formData));
  let error = "";
  try {
    if (!isLlmConfigured()) throw new Error("OPENROUTER_API_KEY is not set.");
    consume(getDb(), "ai");
    await draftMessage(getDb(), openRouterLlm, input.prospectId, input.kind);
  } catch (err) {
    error = err instanceof Error ? err.message : "Drafting failed.";
  }
  revalidatePath(`/prospects/${input.prospectId}`);
  revalidatePath("/approvals");
  if (error) redirect(`/prospects/${input.prospectId}?error=${encodeURIComponent(error)}`);
}

export async function research(formData: FormData) {
  const input = z.object({ prospectId: id }).parse(Object.fromEntries(formData));
  let error = "";
  try {
    if (!isLlmConfigured()) throw new Error("OPENROUTER_API_KEY is not set.");
    consume(getDb(), "ai");
    await researchLead(getDb(), openRouterLlm, input.prospectId);
  } catch (err) {
    error = err instanceof Error ? err.message : "Research failed.";
  }
  revalidatePath("/prospects", "layout");
  if (error) redirect(`/prospects/${input.prospectId}?error=${encodeURIComponent(error)}`);
}

export async function findLeads(formData: FormData) {
  const input = z
    .object({ count: z.coerce.number().int().min(1).max(10), focus: text(300) })
    .parse(Object.fromEntries(formData));
  let target = "";
  try {
    if (!isLlmConfigured()) throw new Error("OPENROUTER_API_KEY is not set.");
    consume(getDb(), "hunt");
    const r = await sourceLeads(getDb(), openRouterSearch, input);
    const skipped = r.skipped.duplicate + r.skipped.unverified;
    target = `/prospects?found=${r.added}&skipped=${skipped}`;
  } catch (err) {
    target = `/prospects?error=${encodeURIComponent(err instanceof Error ? err.message : "Lead search failed.")}`;
  }
  revalidatePath("/prospects", "layout");
  redirect(target);
}

/** Step 1: read the website and pre-fill what we think the business does. */
export async function submitWebsite(formData: FormData) {
  const website = String(formData.get("website") ?? "").trim();
  redirect(`/start?step=2&website=${encodeURIComponent(website)}`);
}

/** Step 2: build the profile from website + description + docs, then start finding leads. */
export async function submitBusiness(formData: FormData) {
  const website = String(formData.get("website") ?? "").trim();
  const description = String(formData.get("description") ?? "");
  let error = "";
  try {
    if (!isLlmConfigured()) throw new Error("OPENROUTER_API_KEY is not set.");
    if (countWords(description) > MAX_DESCRIPTION_WORDS) {
      throw new Error(`Please keep the description under ${MAX_DESCRIPTION_WORDS} words.`);
    }
    const files = formData.getAll("docs").filter((f): f is File => f instanceof File);
    const docs = await readUploads(files);
    consume(getDb(), "onboarding");
    await runOnboarding(getDb(), openRouterLlm, { website, description, docs });
    consume(getDb(), "hunt");
    startPipeline(getDb(), { search: openRouterSearch, llm: openRouterLlm }, { count: 10 });
  } catch (err) {
    error = err instanceof Error ? err.message : "Something went wrong.";
  }
  if (error) {
    redirect(`/start?step=2&website=${encodeURIComponent(website)}&error=${encodeURIComponent(error)}`);
  }
  redirect("/leads");
}

/** Run the finder + research + drafting pipeline again for more leads. */
const getPipelineRunning = () => getPipeline(getDb()).status === "running";

export async function findMoreLeads(formData: FormData) {
  const focus = z.string().trim().max(300).parse(String(formData.get("focus") ?? ""));
  let error = "";
  try {
    if (isLlmConfigured() && !getPipelineRunning()) {
      consume(getDb(), "hunt");
      startPipeline(getDb(), { search: openRouterSearch, llm: openRouterLlm }, { count: 10, focus });
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not start the search.";
  }
  redirect(error ? `/leads?error=${encodeURIComponent(error)}` : "/leads");
}

/** Approve a lead's pending outreach as written. */
export async function approveDraft(formData: FormData) {
  const input = z.object({ id }).parse(Object.fromEntries(formData));
  decideDraft(getDb(), input.id, "approved");
  revalidatePath("/leads");
  revalidatePath("/approvals");
}

/** Launch a play: a lead hunt focused on one buying signal. */
export async function runPlay(formData: FormData) {
  const { play: playId } = z.object({ play: z.string().min(1).max(60) }).parse(Object.fromEntries(formData));
  let error = "";
  try {
    const play = playById(playId);
    if (!play || play.locked) throw new Error("That play isn't available yet.");
    if (!isLlmConfigured()) throw new Error("OPENROUTER_API_KEY is not set.");
    if (getPipeline(getDb()).status !== "running") {
      consume(getDb(), "hunt");
      startPipeline(
        getDb(),
        { search: openRouterSearch, llm: openRouterLlm },
        { count: play.leads, focus: play.focus, label: play.title },
      );
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not start the play.";
  }
  redirect(error ? `/plays?error=${encodeURIComponent(error)}` : "/leads");
}

/** The user sent this approved message from their own mail app. */
export async function markMessageSent(formData: FormData) {
  const input = z.object({ id }).parse(Object.fromEntries(formData));
  markSent(getDb(), input.id);
  revalidatePath("/approvals");
  revalidatePath("/prospects", "layout");
  revalidatePath("/leads");
}

export async function saveContact(formData: FormData) {
  const input = z
    .object({ prospectId: id, email: text(320), linkedin_url: text(300) })
    .parse(Object.fromEntries(formData));
  let error = "";
  try {
    updateContact(getDb(), input.prospectId, input);
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not save.";
  }
  revalidatePath("/prospects", "layout");
  revalidatePath("/leads");
  if (error) redirect(`/prospects/${input.prospectId}?error=${encodeURIComponent(error)}`);
}

/** Crawl the site, run the checks and write a fix plan, in the background. */
export async function runSeoAudit(formData: FormData) {
  const site = z.string().trim().max(300).parse(String(formData.get("site") ?? ""));
  let error = "";
  try {
    const db = getDb();
    consume(db, "seo");
    if (isLlmConfigured()) consume(db, "ai");
    startAudit(db, { llm: isLlmConfigured() ? openRouterLlm : null }, site);
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not start the audit.";
  }
  redirect(error ? `/seo?error=${encodeURIComponent(error)}` : "/seo");
}
