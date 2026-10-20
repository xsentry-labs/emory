import type { Fetch } from "./github";

/**
 * Apollo.io: company search, people search and email reveal. Env: APOLLO_API_KEY
 * (a master key: people search and enrichment need it). Searching is free;
 * revealing an email costs Apollo credits, so it only happens when a person
 * asks for it and is counted against the plan's "emails found" allowance.
 */

export const apolloKey = (env: Record<string, string | undefined> = process.env) => env.APOLLO_API_KEY?.trim() || null;

export class ApolloError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function post<T>(f: Fetch, key: string, path: string, body: unknown): Promise<T> {
  const res = await f(`https://api.apollo.io/api/v1${path}`, {
    method: "POST",
    headers: { "x-api-key": key, "content-type": "application/json", "cache-control": "no-cache", accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const text = (await res.text().catch(() => "")).slice(0, 200);
    const hint = res.status === 401 || res.status === 403 ? " (check APOLLO_API_KEY is a master key)" : res.status === 429 ? " (rate limited, try again shortly)" : "";
    throw new ApolloError(`Apollo ${path}: ${res.status}${hint} ${text}`.trim(), res.status);
  }
  return (await res.json()) as T;
}

export interface CompanyFilters {
  /** Industry or product keywords, e.g. ["warehousing", "3pl"]. */
  keywords: string[];
  /** Places as Apollo understands them, e.g. ["united kingdom"], ["leeds, united kingdom"]. */
  locations: string[];
  /** Headcount ranges as "min,max", e.g. ["101,1000"]. */
  employeeRanges: string[];
}

export interface ApolloCompany {
  apolloId: string;
  name: string;
  domain: string;
  website: string;
  linkedinUrl: string;
  industry: string;
  employees: number | null;
  location: string;
  description: string;
}

interface RawOrg {
  id: string;
  name?: string;
  primary_domain?: string | null;
  website_url?: string | null;
  linkedin_url?: string | null;
  industry?: string | null;
  estimated_num_employees?: number | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  short_description?: string | null;
  keywords?: string[] | null;
}

const company = (o: RawOrg): ApolloCompany => ({
  apolloId: o.id,
  name: o.name ?? "",
  domain: (o.primary_domain ?? "").toLowerCase(),
  website: o.website_url ?? (o.primary_domain ? `https://${o.primary_domain}` : ""),
  linkedinUrl: o.linkedin_url ?? "",
  industry: o.industry ?? "",
  employees: o.estimated_num_employees ?? null,
  location: [o.city, o.country].filter(Boolean).join(", "),
  description: [o.short_description, o.keywords?.slice(0, 12).join(", ")].filter(Boolean).join(" · ").slice(0, 1200),
});

export async function searchCompanies(key: string, filters: CompanyFilters, page = 1, perPage = 25, f: Fetch = fetch): Promise<{ companies: ApolloCompany[]; total: number }> {
  const body: Record<string, unknown> = { page, per_page: perPage };
  if (filters.keywords.length) body.q_organization_keyword_tags = filters.keywords;
  if (filters.locations.length) body.organization_locations = filters.locations;
  if (filters.employeeRanges.length) body.organization_num_employees_ranges = filters.employeeRanges;
  const r = await post<{ organizations?: RawOrg[]; accounts?: RawOrg[]; pagination?: { total_entries?: number } }>(f, key, "/mixed_companies/search", body);
  const orgs = [...(r.organizations ?? []), ...(r.accounts ?? [])].filter((o) => o.id && o.name);
  return { companies: orgs.map(company), total: r.pagination?.total_entries ?? orgs.length };
}

export interface ApolloPerson {
  apolloId: string;
  name: string;
  title: string;
  seniority: string;
  linkedinUrl: string;
  organizationId: string;
}

interface RawPerson {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  title?: string | null;
  seniority?: string | null;
  linkedin_url?: string | null;
  organization_id?: string | null;
  email?: string | null;
  email_status?: string | null;
}

const person = (p: RawPerson): ApolloPerson => ({
  apolloId: p.id,
  name: (p.name || [p.first_name, p.last_name].filter(Boolean).join(" ")).trim(),
  title: p.title ?? "",
  seniority: p.seniority ?? "",
  linkedinUrl: p.linkedin_url ?? "",
  organizationId: p.organization_id ?? "",
});

/** People at the given companies, optionally narrowed to titles. No emails: those are revealed separately. */
export async function searchPeople(key: string, input: { organizationIds: string[]; titles: string[] }, perPage = 25, f: Fetch = fetch): Promise<ApolloPerson[]> {
  const body: Record<string, unknown> = { organization_ids: input.organizationIds, page: 1, per_page: perPage };
  if (input.titles.length) body.person_titles = input.titles;
  const r = await post<{ people?: RawPerson[]; contacts?: RawPerson[] }>(f, key, "/mixed_people/search", body);
  return [...(r.people ?? []), ...(r.contacts ?? [])].filter((p) => p.id).map(person).filter((p) => p.name);
}

export type EmailStatus = "verified" | "guessed" | "unavailable";

/** Reveal a person's work email (costs an Apollo credit). Personal emails are never requested. */
export async function revealEmail(key: string, apolloId: string, f: Fetch = fetch): Promise<{ email: string; status: EmailStatus }> {
  const r = await post<{ person?: RawPerson | null }>(f, key, "/people/match", { id: apolloId, reveal_personal_emails: false, reveal_phone_number: false });
  const email = (r.person?.email ?? "").trim().toLowerCase();
  // Apollo's own placeholder for locked emails.
  if (!email || email.startsWith("email_not_unlocked")) return { email: "", status: "unavailable" };
  return { email, status: r.person?.email_status === "verified" ? "verified" : "guessed" };
}
