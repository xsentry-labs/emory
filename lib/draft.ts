import { z } from "zod";
import type { DB } from "./db";
import type { StructuredLlm } from "./llm";
import { createDraft, getProfile, getProspect, listMessages } from "./repo";

const DraftSchema = z.object({
  subject: z.string().describe("Short, specific subject line, under 60 characters."),
  body: z.string().describe("Plain-text email body."),
});

const SYSTEM = `You write cold outreach and follow-up emails for a person who sells a service.
A human reviews and edits every draft before anything is sent.

Rules:
- Use only facts given in the context. Never invent results, clients, numbers, mutual connections, or details about the recipient. If you lack a specific detail, keep the line general rather than guessing.
- Short: under 120 words. One clear, low-pressure ask (a reply or a short call).
- Plain text, no markdown, no emojis. Lead with something relevant to the recipient, not with the sender.
- A follow-up must add something new or a different angle, not just "checking in", and should not repeat the earlier message.
- Do not write a signature name; end with a sign-off line such as "Best" so the sender can add their name.`;

export async function draftMessage(
  db: DB,
  llm: StructuredLlm,
  prospectId: number,
  kind: "outreach" | "followup",
  /** Extra direction from an approach plan: the angle and what this touch should do. */
  brief = "",
): Promise<number> {
  const prospect = getProspect(db, prospectId);
  if (!prospect) throw new Error(`Lead ${prospectId} not found`);
  const profile = getProfile(db);
  if (!profile.offer.trim()) {
    throw new Error("Describe what you offer on the Offer & ICP page first.");
  }
  const history = listMessages(db, prospectId)
    .filter((m) => m.status !== "rejected")
    .map((m) => `${m.direction === "inbound" ? "THEM" : "US"} (${m.kind}): ${m.subject ? m.subject + " - " : ""}${m.body}`)
    .join("\n\n");

  const user = [
    `Write a ${kind === "followup" ? "follow-up" : "first outreach"} email.`,
    `<our_offer>\n${profile.offer}\n</our_offer>`,
    `<ideal_customer>\n${profile.icp || "(not specified)"}\n</ideal_customer>`,
    `<recipient>`,
    `Name: ${prospect.name}`,
    prospect.title ? `Title: ${prospect.title}` : "",
    `Company: ${prospect.company || "(unknown)"}`,
    `Website: ${prospect.website || "(unknown)"}`,
    `Research notes: ${prospect.notes || "(none)"}`,
    `</recipient>`,
    brief ? `<plan_for_this_email>\n${brief}\n</plan_for_this_email>` : "",
    history ? `<conversation_so_far>\n${history}\n</conversation_so_far>` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { subject, body } = await llm({ system: SYSTEM, user, schema: DraftSchema });
  return createDraft(db, { prospectId, kind, subject: subject.trim(), body: body.trim() });
}
