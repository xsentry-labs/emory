import Link from "next/link";
import { getDb } from "@/lib/request-db";
import { latestAudit } from "@/lib/seo/audit";
import { resultsView } from "@/lib/site/results";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const pos = (p: number | null) => (p === null ? "—" : p.toFixed(1));
const shortDate = (t: number) => new Date(t).toISOString().slice(5, 10);

function Tile({ label, value, sub, hot }: { label: string; value: string; sub: string; hot?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1 border px-4 py-3.5", hot ? "border-accent bg-accent-wash" : "border-dashed border-line")}>
      <span className={cn("font-mono text-xs", hot && "text-accent")}>{label}</span>
      <span className="tnum font-mono text-[26px] font-semibold leading-tight text-ink">{value}</span>
      <span className="text-xs">{sub}</span>
    </div>
  );
}

export default function ResultsPage() {
  const db = getDb();
  const r = resultsView(db);
  const audit = latestAudit(db);
  const startScore = r.startScore;
  const max = Math.max(1, ...r.weeks.map((w) => w.clicks));
  const hasData = r.weeks.some((w) => w.clicks > 0);

  return (
    <div className="flex flex-col gap-[22px]">
      {r.error ? (
        <p role="alert" className="border border-dashed border-danger/60 px-4 py-3 text-sm text-danger">
          Search Console: {r.error} <Link href="/site/settings" className="underline">settings</Link>
        </p>
      ) : null}

      <section aria-label="Headline numbers" className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-3">
        <Tile label="site health" value={audit?.report ? String(audit.report.score) : "—"} sub={startScore !== null ? `was ${startScore} at start` : "not audited yet"} />
        <Tile
          hot
          label="organic clicks · last 7 days"
          value={r.clicksThisWeek === null ? "—" : r.clicksThisWeek.toLocaleString("en-US")}
          sub={r.clicksBefore !== null ? `was ${r.clicksBefore.toLocaleString("en-US")} the week before the first fix` : r.connected ? "waiting for data" : "connect search console"}
        />
        <Tile label="issues fixed" value={String(r.fixedCount)} sub="confirmed by a later crawl" />
        <Tile
          label="avg position"
          value={pos(r.avgPosition)}
          sub={r.avgPositionBefore !== null ? `was ${pos(r.avgPositionBefore)} · lower is better` : "lower is better"}
        />
      </section>

      {!r.connected ? (
        <div className="flex flex-col gap-2 border border-dashed border-line p-6">
          <h2 className="text-lg font-semibold">connect google search console to see clicks</h2>
          <p>emory reads clicks and positions per page (read-only) and compares two weeks either side of each fix.</p>
          <Link href="/site/settings" className="btn btn-primary self-start">
            connect search console
          </Link>
        </div>
      ) : (
        <>
          <section aria-labelledby="ch" className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-1.5">
              <h2 id="ch" className="text-base font-semibold">
                organic clicks per week
              </h2>
              <span className="inline-flex items-center gap-2 font-mono text-xs">
                <span className="size-2.5 bg-accent" aria-hidden />a fix confirmed that week
              </span>
            </div>
            {hasData ? (
              <>
                <div
                  role="img"
                  aria-label={`Weekly organic clicks over ${r.weeks.length} weeks: ${r.weeks.map((w) => w.clicks).join(", ")}`}
                  className="flex h-[220px] items-stretch gap-2.5 border-b border-line px-1"
                >
                  {r.weeks.map((w, k) => (
                    <div key={w.week} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                      <span className={cn("tnum font-mono text-[11px]", k === r.weeks.length - 1 && "text-ink")}>{w.clicks}</span>
                      <span
                        className={cn("w-full max-w-11", w.fixed ? "bg-accent" : k === r.weeks.length - 1 ? "bg-ink" : "bg-mute/60")}
                        style={{ height: `${Math.max(2, (w.clicks / max) * 175)}px` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2.5 px-1 font-mono text-[11px]">
                  {r.weeks.map((w, k) => (
                    <span key={w.week} className="flex-1 text-center">
                      {k === r.weeks.length - 1 ? "latest" : w.week.slice(5)}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p>no search data yet. the first sync pulls 16 weeks; it can take a few minutes after connecting.</p>
            )}
          </section>

          <section aria-labelledby="fx" className="flex flex-col gap-2">
            <h2 id="fx" className="text-base font-semibold">
              fixed pages · before and after
            </h2>
            {r.pages.length === 0 ? (
              <p>no confirmed fixes yet. they appear here once a crawl after a merge shows the issue is gone.</p>
            ) : (
              <div className="overflow-x-auto border border-dashed border-line">
                <table className="w-full min-w-[640px] border-collapse font-mono text-xs">
                  <thead>
                    <tr className="border-b border-dashed border-line text-left">
                      {["page", "fix", "fixed", "clicks / wk", "position"].map((h) => (
                        <th key={h} scope="col" className="px-3 py-2.5 font-normal">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {r.pages.map((p) => (
                      <tr key={`${p.page}-${p.fixedAt}`} className="border-b border-dashed border-line-soft">
                        <td className="px-3 py-2.5 text-ink">{p.page.replace(/^https?:\/\/[^/]+/, "") || "/"}</td>
                        <td className="px-3 py-2.5">{p.fix.toLowerCase()}</td>
                        <td className="px-3 py-2.5">{shortDate(p.fixedAt)}</td>
                        <td className="tnum px-3 py-2.5">{p.after ? `${p.before.clicks} → ${p.after.clicks}` : `${p.before.clicks} → too early`}</td>
                        <td className="tnum px-3 py-2.5">{p.after ? `${pos(p.before.position)} → ${pos(p.after.position)}` : `${pos(p.before.position)} → …`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <span className="text-xs">search moves slowly; emory compares two weeks either side of each fix and says when it&apos;s too early to tell.</span>
          </section>
        </>
      )}
    </div>
  );
}
