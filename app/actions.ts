"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  createDraft,
  createProspect,
  decideDraft,
  logReply,
  saveProfile,
  saveQualification,
  setProspectStatus,
} from "@/lib/repo";
import { PROSPECT_STATUSES } from "@/lib/types";
import { draftMessage } from "@/lib/draft";
import { researchLead } from "@/lib/research";
import { isLlmConfigured, openRouterLlm } from "@/lib/llm";

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
    await researchLead(getDb(), openRouterLlm, input.prospectId);
  } catch (err) {
    error = err instanceof Error ? err.message : "Research failed.";
  }
  revalidatePath("/prospects", "layout");
  if (error) redirect(`/prospects/${input.prospectId}?error=${encodeURIComponent(error)}`);
}
