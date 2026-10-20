import Link from "next/link";
import { auditTotals, listEvents, type AuditTrack } from "@/lib/audit";
import { getDb } from "@/lib/request-db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TRACKS: AuditTrack[] = ["site", "leads", "social", "account"];
const DAY = 86_400_000;

const time = (t: number, now: number) => {
  const d = new Date(t);
  return now - t < DAY ? d.toISOString().slice(11, 16) : d.toISOString().slice(5, 16).replace("T", " ");
};

/** Only guardrails the code actually enforces are listed. */
const GUARDRAILS = [
  "never merges, publishes or deploys",
  "nothing is sent or posted without a person's approval",
  "never emails a risky or unverified address",
  "do-not-contact applies across every track",
  "replies asking to stop are added to do-not-contact",
  "one person per company emailed per day in a plan",
];

export default function AuditPage({ searchParams }: { searchParams: { track?: string; actor?: string } }) {
  const db = getDb();
  const now = Date.now();
  const track = TRACKS.includes(searchParams.track as AuditTrack) ? (searchParams.track as AuditTrack) : undefined;
  const actor = searchParams.actor === "people" || searchParams.actor === "emory" ? searchParams.actor : undefined;
  const events = listEvents(db, { track, actor, limit: 300 });
  const t = auditTotals(db, now - 30 * DAY);
  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams(Object.entries({ track, actor, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/audit${q.size ? `?${q}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4 border-b border-dashed border-line pb-3">
        <span className="font-mono text-sm text-ink">/ audit</span>
        <div className="flex-1" />
        <a href="/api/audit" className="btn btn-quiet h-9">
          export csv
        </a>
      </header>
      <div className="flex flex-col gap-8 xl:flex-row">
        <main className="flex min-w-0 flex-1 flex-col gap-[22px]">
          <h1 className="text-[26px] font-semibold">everything emory did, and who approved it</h1>
          <section aria-label="Last 30 days" className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-3">
            {[
              { label: "site changes", big: `${t.prs} PR${t.prs === 1 ? "" : "s"}`, sub: `${t.prsMerged} merged by you · 0 by emory` },
              { label: "emails sent", big: String(t.sent), sub: t.sendFailed ? `${t.sendFailed} not sent · see inbox` : "every one approved by a person" },
              { label: "approvals", big: String(t.approvals), sub: "decisions by people, last 30 days" },
              { label: "contact records", big: String(t.contacts), sub: `${t.deletions} deletion request${t.deletions === 1 ? "" : "s"} done`, hot: true },
            ].map((x) => (
              <div key={x.label} className={cn("flex flex-col gap-1 border px-4 py-3.5", x.hot ? "border-accent bg-accent-wash" : "border-dashed border-line")}>
                <span className={cn("font-mono text-xs", x.hot && "text-accent")}>{x.label}</span>
                <span className="tnum font-mono text-2xl font-semibold leading-tight text-ink">{x.big}</span>
                <span className="text-xs">{x.sub}</span>
              </div>
            ))}
          </section>

          <section aria-label="Event log" className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[13px] text-ink">log · append-only</span>
              <div className="flex-1" />
              <nav aria-label="Filter by track" className="flex flex-wrap gap-1.5">
                {[undefined, ...TRACKS].map((x) => (
                  <Link key={x ?? "all"} href={href({ track: x })} className={cn("chip", x === track && "border-accent bg-accent text-accent-ink")}>
                    {x ?? "all tracks"}
                  </Link>
                ))}
              </nav>
              <nav aria-label="Filter by actor" className="flex flex-wrap gap-1.5">
                {([undefined, "people", "emory"] as const).map((x) => (
                  <Link key={x ?? "both"} href={href({ actor: x })} className={cn("chip", x === actor && "border-accent bg-accent text-accent-ink")}>
                    {x ?? "people and emory"}
                  </Link>
                ))}
              </nav>
            </div>
            {events.length === 0 ? (
              <p className="border border-dashed border-line p-6">nothing logged yet{track || actor ? " for this filter" : ""}.</p>
            ) : (
              <div className="overflow-x-auto border border-dashed border-line">
                <table className="w-full min-w-[760px] border-collapse font-mono text-xs">
                  <thead>
                    <tr className="border-b border-dashed border-line text-left">
                      {["time", "actor", "action", "target", "approved by"].map((h) => (
                        <th key={h} scope="col" className="px-3 py-2.5 font-normal">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((e) => (
                      <tr key={e.id} className={cn("border-b border-dashed border-line-soft", e.action === "deleted contact" && "bg-accent-wash")}>
                        <td className="whitespace-nowrap px-3 py-2.5">{time(e.at, now)}</td>
                        <td className="px-3 py-2.5">{e.actor}</td>
                        <td className="px-3 py-2.5 text-ink">{e.action}</td>
                        <td className="px-3 py-2.5">{e.target}</td>
                        <td className="px-3 py-2.5">{e.approved_by || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {events.length === 300 ? <span className="text-xs">showing the latest 300 · export csv for everything</span> : null}
          </section>
        </main>

        <aside aria-label="Guardrails" className="flex flex-col gap-3.5 xl:w-80 xl:shrink-0 xl:border-l xl:border-dashed xl:border-line xl:pl-6">
          <span className="font-mono text-[13px] text-ink">always on</span>
          <ul className="flex flex-col gap-2 font-mono text-xs">
            {GUARDRAILS.map((g) => (
              <li key={g}>✓ {g}</li>
            ))}
          </ul>
          <div className="flex flex-col gap-1.5 border border-dashed border-line p-3.5">
            <span className="font-mono text-xs text-ink">contact data</span>
            <span className="text-[13px]">business details only. each person&apos;s page shows what emory holds, where it came from, and deletes it on request.</span>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="/leads/people" className="btn btn-quiet btn-sm">
                find a person
              </Link>
              <Link href="/memory?s=dnc" className="btn btn-quiet btn-sm">
                do-not-contact list
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
