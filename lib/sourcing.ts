import { z } from "zod";
import type { DB } from "./db";
import { createProspect, getProfile } from "./repo";
import { normalizeUrl } from "./safeFetch";

/** Runs a web-search-backed LLM call and returns its text plus the domains it cited. */
export type Searcher = (req: { system: string; user: string }) => Promise<{ text: string; citedDomains: string[] }>;

const CandidatesSchema = z.object({
  leads: z.array(
    z.object({
      name: z.string(),
      company: z.string(),
      website: z.string(),
      email: z.string().default(""),
      notes: z.string().default(""),
    }),
  ),
});

const SYSTEM = `You find real prospective customers for someone who sells a service, using web search.
Return businesses (and, when a public page names them, a relevant decision maker) that match the ideal customer.

Rules:
- Only include businesses you actually found in search results. Never invent companies, people or emails.
- "website" must be the company's own site, taken from the search results.
- "email" only if it is shown publicly on a page you found; otherwise an empty string.
- "name" is a named contact if a source shows one, otherwise use the company name.
- "notes": one or two factual sentences from the sources on why they fit (what they do, a recent change). No guesses.
- Reply with ONLY a JSON object: {"leads":[{"name":"","company":"","website":"","email":"","notes":""}]}. No prose, no code fences.`;

const hostOf = (url: string): string | null => {
  const u = normalizeUrl(url);
  return u ? u.hostname.toLowerCase().replace(/^www\./, "") : null;
};

/** True when `host` is one of the cited domains or a subdomain of one. */
const isCited = (host: string, cited: Set<string>) =>
  [...cited].some((d) => host === d || host.endsWith(`.${d}`) || d.endsWith(`.${host}`));

export function parseCandidates(text: string): z.infer<typeof CandidatesSchema> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("no JSON object in reply");
  return CandidatesSchema.parse(JSON.parse(text.slice(start, end + 1)));
}

export interface SourcingResult {
  added: number;
  skipped: { duplicate: number; unverified: number };
}

/**
 * Find new leads matching the saved ICP and add them. A candidate is kept only
 * if its website is one of the pages the search actually cited, which blocks
 * invented companies; leads already in the database (same site or email) are
 * skipped. New leads are unscored: run research to score them.
 */
export async function sourceLeads(
  db: DB,
  search: Searcher,
  opts: { count?: number; focus?: string } = {},
): Promise<SourcingResult> {
  const profile = getProfile(db);
  if (!profile.offer.trim() || !profile.icp.trim()) {
    throw new Error("Fill in your offer and ideal customer on the Offer & ICP page first.");
  }
  const count = Math.min(Math.max(Math.floor(opts.count ?? 5), 1), 10);
  const focus = (opts.focus ?? "").trim().slice(0, 300);

  const user = [
    `<our_offer>\n${profile.offer}\n</our_offer>`,
    `<ideal_customer>\n${profile.icp}\n</ideal_customer>`,
    focus ? `<focus>\n${focus}\n</focus>` : "",
    `Find up to ${count} prospects.`,
  ]
    .filter(Boolean)
    .join("\n");

  let candidates: z.infer<typeof CandidatesSchema> | undefined;
  let cited = new Set<string>();
  let lastError = "";
  for (let attempt = 0; attempt < 2 && !candidates; attempt++) {
    const res = await search({
      system: SYSTEM,
      user: attempt === 0 ? user : `${user}\n\nYour previous reply could not be parsed (${lastError}). Reply with the JSON object only.`,
    });
    try {
      candidates = parseCandidates(res.text);
      cited = new Set(res.citedDomains.map((d) => d.toLowerCase().replace(/^www\./, "")));
    } catch (err) {
      lastError = err instanceof Error ? err.message.slice(0, 150) : "parse error";
    }
  }
  if (!candidates) throw new Error(`The search reply was not usable (${lastError}).`);

  const known = db.prepare(`SELECT website, email FROM prospects`).all() as { website: string; email: string }[];
  const seenHosts = new Set(known.map((k) => hostOf(k.website)).filter(Boolean) as string[]);
  const seenEmails = new Set(known.map((k) => k.email.trim().toLowerCase()).filter(Boolean));

  const result: SourcingResult = { added: 0, skipped: { duplicate: 0, unverified: 0 } };
  for (const c of candidates.leads.slice(0, count)) {
    const host = hostOf(c.website);
    if (!host || !isCited(host, cited)) {
      result.skipped.unverified++;
      continue;
    }
    const email = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(c.email.trim()) ? c.email.trim().toLowerCase() : "";
    if (seenHosts.has(host) || (email && seenEmails.has(email))) {
      result.skipped.duplicate++;
      continue;
    }
    createProspect(db, {
      name: (c.name || c.company).trim().slice(0, 200),
      company: c.company.trim().slice(0, 200),
      email,
      website: normalizeUrl(c.website)!.origin,
      notes: c.notes.trim().slice(0, 2000),
      source: `AI search${focus ? `: ${focus}` : ""}`.slice(0, 200),
    });
    seenHosts.add(host);
    if (email) seenEmails.add(email);
    result.added++;
  }
  return result;
}
