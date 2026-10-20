"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MEMORY_KINDS, addMemory, deleteMemory, updateMemory } from "@/lib/memory";
import { deletePerson } from "@/lib/privacy";
import { actorEmail, getDb } from "@/lib/request-db";
import { suppress, unsuppress } from "@/lib/suppress";

const id = z.coerce.number().int().positive();

export async function addMemoryAction(formData: FormData) {
  const input = z.object({ kind: z.enum(MEMORY_KINDS), text: z.string().trim().min(1).max(500) }).parse(Object.fromEntries(formData));
  addMemory(getDb(), input.kind, input.text, "added by you", actorEmail());
  revalidatePath("/memory");
}

export async function editMemoryAction(formData: FormData) {
  const input = z.object({ id, text: z.string().max(500) }).parse(Object.fromEntries(formData));
  updateMemory(getDb(), input.id, input.text, actorEmail());
  revalidatePath("/memory");
}

export async function deleteMemoryAction(formData: FormData) {
  deleteMemory(getDb(), id.parse(formData.get("id")), actorEmail());
  revalidatePath("/memory");
}

export async function suppressAction(formData: FormData) {
  const value = z.string().trim().min(3).max(320).parse(String(formData.get("value") ?? ""));
  const kind = value.includes("@") ? "email" : "domain";
  const reason = z.string().trim().max(200).parse(String(formData.get("reason") ?? "")) || "added by hand";
  suppress(getDb(), kind, value.replace(/^https?:\/\//, "").split("/")[0], reason, actorEmail());
  revalidatePath("/memory");
}

export async function unsuppressAction(formData: FormData) {
  unsuppress(getDb(), id.parse(formData.get("id")), actorEmail());
  revalidatePath("/memory");
}

export async function deletePersonAction(formData: FormData) {
  const input = z.object({ id, confirm: z.literal("delete") }).safeParse(Object.fromEntries(formData));
  if (!input.success) redirect(`/prospects/${formData.get("id")}?error=${encodeURIComponent('Type "delete" to confirm.')}`);
  deletePerson(getDb(), input.data.id, actorEmail());
  revalidatePath("/", "layout");
  redirect("/leads/people?deleted=1");
}
