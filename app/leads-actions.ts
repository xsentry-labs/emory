"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { apolloKey } from "@/lib/integrations/apollo";
import { setAccountStatus } from "@/lib/leads/accounts";
import { approveApproach, finishStep, proposeApproach, setApproachStatus } from "@/lib/leads/approach";
import { findCompanies, getFindState } from "@/lib/leads/find";
import { BUYING_ROLES, enrichPeople, inferOrgChart, mapPeople, setBuyingRole, setReportsTo } from "@/lib/leads/people";
import { isLlmConfigured, openRouterLlm, openRouterSearch } from "@/lib/llm";
import { startPipeline } from "@/lib/pipeline";
import { getDb } from "@/lib/request-db";
import { consume } from "@/lib/usage";

const id = z.coerce.number().int().positive();
const ids = (fd: FormData, name: string) => fd.getAll(name).map((v) => id.parse(v));
const msg = (err: unknown, fallback: string) => encodeURIComponent(err instanceof Error ? err.message : fallback);

function needs() {
  if (!isLlmConfigured()) throw new Error("OPENROUTER_API_KEY is not set.");
}

/** Find companies from a plain-English description: Apollo when configured, else the AI web search. */
export async function findAction(formData: FormData) {
  const text = z.string().trim().min(1).max(2000).parse(String(formData.get("text") ?? ""));
  let target = "/leads";
  try {
    needs();
    const db = getDb();
    const key = apolloKey();
    consume(db, "hunt");
    if (key) {
      const r = await findCompanies(db, openRouterLlm, key, text);
      target = `/leads?added=${r.added}&dropped=${r.dropped}&dupes=${r.duplicates}`;
    } else {
      startPipeline(db, { search: openRouterSearch, llm: openRouterLlm }, { count: 10, focus: text.slice(0, 300) });
      target = "/leads/people?searching=1";
    }
  } catch (err) {
    target = `/leads?error=${msg(err, "Search failed.")}`;
  }
  revalidatePath("/leads", "layout");
  redirect(target);
}

/** Find people at the ticked accounts and sketch each org chart. */
export async function mapAction(formData: FormData) {
  const accountIds = ids(formData, "account");
  let target = "/leads/people";
  try {
    needs();
    const key = apolloKey();
    if (!key) throw new Error("Set APOLLO_API_KEY to find people at these companies.");
    if (accountIds.length === 0) throw new Error("Tick at least one company.");
    const db = getDb();
    consume(db, "ai");
    const r = await mapPeople(db, key, accountIds, getFindState(db).parsed?.titles ?? []);
    for (const a of accountIds) await inferOrgChart(db, openRouterLlm, a);
    target = accountIds.length === 1 ? `/accounts/${accountIds[0]}` : `/leads/people?mapped=${r.added}`;
  } catch (err) {
    target = `/leads?error=${msg(err, "Couldn't find people.")}`;
  }
  revalidatePath("/leads", "layout");
  redirect(target);
}

export async function enrichAction(formData: FormData) {
  const people = ids(formData, "person");
  const back = String(formData.get("back") ?? "/leads/people").startsWith("/") ? String(formData.get("back") ?? "/leads/people") : "/leads/people";
  let target = back;
  try {
    const key = apolloKey();
    if (!key) throw new Error("Set APOLLO_API_KEY to look up emails.");
    if (people.length === 0) throw new Error("Tick at least one person.");
    const r = await enrichPeople(getDb(), key, people);
    target = `${back}${back.includes("?") ? "&" : "?"}verified=${r.verified}&guessed=${r.guessed}&missing=${r.unavailable}`;
  } catch (err) {
    target = `${back}${back.includes("?") ? "&" : "?"}error=${msg(err, "Lookup failed.")}`;
  }
  revalidatePath("/leads", "layout");
  redirect(target);
}

export async function remapAction(formData: FormData) {
  const accountId = id.parse(formData.get("account"));
  try {
    needs();
    consume(getDb(), "ai");
    await inferOrgChart(getDb(), openRouterLlm, accountId);
  } catch (err) {
    redirect(`/accounts/${accountId}?error=${msg(err, "Couldn't redraw the chart.")}`);
  }
  revalidatePath(`/accounts/${accountId}`);
}

export async function setManagerAction(formData: FormData) {
  const input = z.object({ person: id, manager: z.union([z.literal(""), id]), account: id }).parse(Object.fromEntries(formData));
  try {
    setReportsTo(getDb(), input.person, input.manager === "" ? null : input.manager);
  } catch (err) {
    redirect(`/accounts/${input.account}?person=${input.person}&error=${msg(err, "Couldn't save that.")}`);
  }
  revalidatePath(`/accounts/${input.account}`);
}

export async function setRoleAction(formData: FormData) {
  const input = z.object({ person: id, role: z.enum(["", ...BUYING_ROLES]), account: id }).parse(Object.fromEntries(formData));
  setBuyingRole(getDb(), input.person, input.role);
  revalidatePath(`/accounts/${input.account}`);
}

export async function proposeAction(formData: FormData) {
  const accountId = id.parse(formData.get("account"));
  try {
    needs();
    const db = getDb();
    consume(db, "ai");
    await proposeApproach(db, openRouterLlm, accountId, ids(formData, "person"));
  } catch (err) {
    redirect(`/accounts/${accountId}?error=${msg(err, "Couldn't plan the approach.")}`);
  }
  revalidatePath("/leads", "layout");
  redirect(`/accounts/${accountId}/approach`);
}

export async function approveApproachAction(formData: FormData) {
  const input = z.object({ approach: id, account: id }).parse(Object.fromEntries(formData));
  approveApproach(getDb(), input.approach);
  revalidatePath("/", "layout");
  redirect(`/accounts/${input.account}/approach?approved=1`);
}

export async function approachStatusAction(formData: FormData) {
  const input = z.object({ approach: id, account: id, status: z.enum(["approved", "paused"]) }).parse(Object.fromEntries(formData));
  setApproachStatus(getDb(), input.approach, input.status);
  revalidatePath("/", "layout");
}

export async function stepAction(formData: FormData) {
  const input = z.object({ step: id, status: z.enum(["done", "skipped"]) }).parse(Object.fromEntries(formData));
  finishStep(getDb(), input.step, input.status);
  revalidatePath("/", "layout");
}

/** The button's value is "<account id>:<new status>", so it can share a form with the selection checkboxes. */
export async function dropAccountAction(formData: FormData) {
  const [account, status] = String(formData.get("drop") ?? "").split(":");
  setAccountStatus(getDb(), id.parse(account), z.enum(["dropped", "new"]).parse(status));
  revalidatePath("/leads", "layout");
}
