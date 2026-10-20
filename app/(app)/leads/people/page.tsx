import Link from "next/link";
import { enrichAction } from "@/app/leads-actions";
import { LeadsHeader } from "@/components/leads/leads-header";
import { AutoRefresh } from "@/components/report/auto-refresh";
import { SubmitButton } from "@/components/start/form-bits";
import { apolloKey } from "@/lib/integrations/apollo";
import { getPipeline } from "@/lib/pipeline";
import { remaining } from "@/lib/quota";
import { getDb } from "@/lib/request-db";
import type { Prospect } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Row = Prospect & { account_name: string | null };

function Email({ p }: { p: Row }) {
  const dot = (kind: "solid" | "hollow" | "dashed") => (
    <span aria-hidden className={cn("size-2 shrink-0", kind === "solid" ? "bg-accent" : kind === "hollow" ? "border border-ink" : "border border-dashed border-mute")} />
  );
  const line = (k: Parameters<typeof dot>[0], text: string, note: string, strong = false) => (
    <>
      <span className={cn("inline-flex items-center gap-1.5 font-mono text-xs", strong && "text-ink")}>
        {dot(k)}
        {text}
      </span>
      <br />
      <span className="font-mono text-[11px]">{note}</span>
    </>
  );
  switch (p.email_status) {
    case "verified":
      return line("solid", p.email, "verified · apollo", true);
    case "manual":
      return line("solid", p.email, `entered by ${p.email_source === "you" ? "you" : "hand"}`, true);
    case "guessed":
      return line("hollow", p.email, "risky · not verified · won't be sent to");
    case "unavailable":
      return line("dashed", "not found", "try another person at the company");
    default:
      return line("dashed", p.apollo_id ? "not looked up" : "none", p.apollo_id ? "tick to look up" : "add one on the person's page");
  }
}

export default function PeoplePage({ searchParams }: { searchParams: { error?: string; verified?: string; guessed?: string; missing?: string; mapped?: string } }) {
  const db = getDb();
  const people = db
    .prepare(
      `SELECT p.*, a.name AS account_name FROM prospects p LEFT JOIN accounts a ON a.id = p.account_id
       ORDER BY a.fit IS NULL, a.fit DESC, p.account_id, p.id`,
    )
    .all() as Row[];
  const apollo = Boolean(apolloKey());
  const lookups = people.filter((p) => p.apollo_id && p.email_status === "");
  const pipeline = getPipeline(db);
  const left = remaining(db, "enrich");

  return (
    <>
      <LeadsHeader db={db} />
      {pipeline.status === "running" ? <AutoRefresh everyMs={3000} /> : null}
      <div className="flex flex-col gap-8 xl:flex-row">
        <form action={enrichAction} className="flex min-w-0 flex-1 flex-col gap-3.5">
          <input type="hidden" name="back" value="/leads/people" />
          <div className="flex flex-wrap items-baseline gap-3.5">
            <h1 className="text-[22px] font-semibold">people</h1>
            <span className="text-[13px]">every email shows where it came from and how sure emory is</span>
            <div className="flex-1" />
            {apollo && lookups.length ? <SubmitButton pendingLabel="looking up…">look up ticked emails</SubmitButton> : null}
          </div>
          {pipeline.status === "running" ? (
            <p className="border border-dashed border-line px-4 py-3 text-sm">
              searching the web for leads · {pipeline.done} of {pipeline.total || "?"} researched
            </p>
          ) : null}
          {searchParams.error ? (
            <p role="alert" className="border border-dashed border-danger/60 px-4 py-3 text-sm text-danger">
              {searchParams.error}
            </p>
          ) : null}
          {searchParams.verified !== undefined ? (
            <p className="border border-dashed border-line px-4 py-3 text-sm">
              {searchParams.verified} verified · {searchParams.guessed} risky · {searchParams.missing} not found.
            </p>
          ) : null}
          {searchParams.mapped !== undefined ? <p className="border border-dashed border-line px-4 py-3 text-sm">{searchParams.mapped} people added.</p> : null}

          {people.length === 0 ? (
            <div className="flex flex-col gap-2 border border-dashed border-line p-6">
              <h2 className="text-lg font-semibold">no people yet</h2>
              <p>
                tick companies on <Link href="/leads" className="text-ink underline underline-offset-4">find</Link> and emory looks up the people to talk to.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-dashed border-line">
              <table className="w-full min-w-[860px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-dashed border-line text-left font-mono text-xs">
                    <th scope="col" className="w-8 px-3 py-2.5 font-normal">
                      <span className="sr-only">Look up email</span>
                    </th>
                    {["person", "company", "email", "linkedin", "status"].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2.5 font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.id} className="border-b border-dashed border-line-soft align-top hover:bg-wash">
                      <td className="px-3 py-3">
                        {apollo && p.apollo_id && p.email_status === "" ? (
                          <input type="checkbox" name="person" value={p.id} defaultChecked={Boolean(p.buying_role)} aria-label={`Look up ${p.name}`} className="size-4 accent-accent" />
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/prospects/${p.id}`} className="font-mono text-ink hover:underline">
                          {p.name.toLowerCase()}
                        </Link>
                        <br />
                        {p.title.toLowerCase() || "—"}
                      </td>
                      <td className="px-3 py-3">
                        {p.account_id ? (
                          <Link href={`/accounts/${p.account_id}`} className="hover:text-ink hover:underline">
                            {(p.account_name ?? p.company).toLowerCase()}
                          </Link>
                        ) : (
                          p.company.toLowerCase()
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Email p={p} />
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">
                        {p.linkedin_url ? (
                          <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="hover:text-ink hover:underline">
                            profile
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <span className="text-xs">risky and not-found emails are never sent to. emory suggests another person at the same company instead.</span>
        </form>

        <aside aria-label="How emails are found" className="flex flex-col gap-3 xl:w-80 xl:shrink-0 xl:border-l xl:border-dashed xl:border-line xl:pl-6">
          <span className="font-mono text-[13px] text-ink">how emory looks</span>
          <ol>
            {[
              ["01", "apollo work email", apollo ? "on" : "not set up"],
              ["02", "verified by apollo before use", "required"],
              ["03", "or type one you know", "on the person's page"],
            ].map(([n, what, note]) => (
              <li key={n} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-baseline gap-2 border-t border-dashed border-line-soft py-2 text-[13px] last:border-b">
                <span className="font-mono">{n}</span>
                <span>{what}</span>
                <span className="font-mono text-xs">{note}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-col gap-1 border border-dashed border-line p-3">
            <span className="font-mono text-xs text-ink">this month</span>
            <span className="text-[13px]">
              {left.toLocaleString("en-US")} email lookup{left === 1 ? "" : "s"} left on your plan · {lookups.length} people not looked up yet
            </span>
          </div>
          <div className="flex flex-col gap-1 border border-dashed border-line p-3">
            <span className="font-mono text-xs text-ink">phone numbers · off</span>
            <span className="text-[13px]">emory doesn&apos;t collect phone numbers. calls in an approach plan are tasks for you.</span>
          </div>
          <span className="text-xs">emory only collects business contact details and records where each one came from.</span>
        </aside>
      </div>
    </>
  );
}
