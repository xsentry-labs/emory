import Link from "next/link";
import { notFound } from "next/navigation";
import { saveReportAction } from "@/app/report-actions";
import { AutoRefresh } from "@/components/report/auto-refresh";
import { SubmitButton } from "@/components/start/form-bits";
import { getAccountsDb } from "@/lib/accounts";
import { MIN_PAGES, REPORT_STEPS, getReport, type PublicReport } from "@/lib/report";
import { currentUser } from "@/lib/request-db";
import { CATEGORIES, issueFix, rankIssues } from "@/lib/seo/categories";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const bare = (site: string) => site.replace(/^https?:\/\//, "");

function Header({ report, right }: { report: PublicReport; right?: React.ReactNode }) {
  return (
    <header className="flex min-h-14 flex-wrap items-center gap-4 border-b border-dashed border-line px-6">
      <Link href="/start" className="font-mono text-[15px] tracking-[0.26em] text-ink">
        emory
      </Link>
      <span className="font-mono text-sm text-ink">/ report · {bare(report.site)}</span>
      {right}
    </header>
  );
}

function Scanning({ report }: { report: PublicReport }) {
  const { step, pagesRead, pagesTarget } = report.progress;
  const at = REPORT_STEPS.indexOf(step);
  const pct = pagesTarget > 0 ? Math.round((pagesRead / pagesTarget) * 100) : 0;
  return (
    <main aria-live="polite" className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-6 py-16">
      <AutoRefresh />
      <span className="flex items-center gap-2 font-mono text-xs tracking-[0.1em]">
        <span className="size-[9px] bg-accent" aria-hidden />
        scanning {bare(report.site)}
      </span>
      <div className="flex items-baseline justify-between">
        <span className="tnum font-mono text-[30px] font-semibold text-ink">
          {pagesRead} / {pagesTarget}
        </span>
        <span className="font-mono text-[13px]">pages read</span>
      </div>
      <span className="block h-1 bg-line">
        <span className="block h-1 bg-accent transition-[width]" style={{ width: `${pct}%` }} />
      </span>
      <ol>
        {REPORT_STEPS.map((s, i) => (
          <li key={s} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-baseline gap-2.5 border-t border-dashed border-line-soft py-2 text-sm last:border-b">
            <span aria-hidden className={i === at ? "text-accent" : "text-ink"}>
              {i < at ? "✓" : i === at ? "◼" : "·"}
            </span>
            <span className={i === at ? "text-ink" : undefined}>{s}</span>
            <span className="font-mono text-xs">{i < at ? "done" : i === at ? "running" : "next"}</span>
          </li>
        ))}
      </ol>
      <p className="text-[13px]">about two minutes. you can keep this tab open; the report appears here when it&apos;s ready.</p>
    </main>
  );
}

function Failed({ report }: { report: PublicReport }) {
  return (
    <main className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-6 py-16">
      <span className="tag text-accent">blocked · couldn&apos;t read the site</span>
      <h1 className="text-xl font-semibold">emory couldn&apos;t scan {bare(report.site)}</h1>
      <p>{report.error}</p>
      <p className="text-[13px]">check the address is public and loads in a browser without signing in.</p>
      <Link href={`/start?website=${encodeURIComponent(bare(report.site))}`} className="btn btn-primary self-start">
        try again
      </Link>
    </main>
  );
}

function Done({ report }: { report: PublicReport }) {
  const r = report.report!;
  const top = rankIssues(r.issues).slice(0, 5);
  const codeFixes = r.issues.filter((i) => issueFix(i) === "code fix").length;
  const weakest = CATEGORIES.reduce((a, b) => (r.categories[b] < r.categories[a] ? b : a));
  const signedIn = Boolean(currentUser());
  const guess = report.guess;

  return (
    <div className="flex flex-1 flex-wrap">
      <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-[30px] px-6 py-9 md:px-12">
        {r.pagesCrawled < MIN_PAGES ? (
          <div className="flex flex-col gap-2 border border-accent p-5">
            <span className="tag text-accent">thin · only {r.pagesCrawled} page{r.pagesCrawled === 1 ? "" : "s"} readable</span>
            <p>
              most of the site may need a login or render only with javascript, so this report covers very little. results below are for the
              pages emory could read.
            </p>
          </div>
        ) : null}

        <section aria-labelledby="health" className="flex flex-wrap items-start gap-9">
          <div className="flex min-w-[180px] flex-col gap-1">
            <span className="font-mono text-sm tracking-[0.12em]">001 · site health</span>
            <span id="health" className="tnum font-mono text-[64px] font-semibold leading-none text-ink">
              {r.score}
              <span className="text-[22px] text-mute"> / 100</span>
            </span>
            <span className="text-[13px]">
              {r.issues.length} issues · {codeFixes} fixable in code
            </span>
          </div>
          <div className="flex flex-[1_1_320px] flex-col gap-2.5 pt-[30px]">
            {CATEGORIES.map((c) => (
              <div key={c} className="grid grid-cols-[120px_minmax(0,1fr)_40px] items-center gap-2.5 text-[13px]">
                <span className={cn("font-mono", c === weakest && "text-accent")}>{c}</span>
                <span className="block h-1.5 bg-line">
                  <span className={cn("block h-1.5", c === weakest ? "bg-accent" : "bg-mute")} style={{ width: `${r.categories[c]}%` }} />
                </span>
                <span className={cn("tnum font-mono", c === weakest && "text-accent")}>{r.categories[c]}</span>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="first" className="flex flex-col gap-1.5">
          <h2 id="first" className="text-lg font-semibold">
            fix these first
          </h2>
          {top.length === 0 ? <p>no issues found on the pages emory read.</p> : null}
          <ul>
            {top.map((i) => (
              <li key={i.id} className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-baseline gap-3.5 border-t border-dashed border-line-soft py-3 text-sm last:border-b">
                <span
                  className={cn(
                    "border px-1.5 text-center font-mono text-[11px] tracking-[0.06em]",
                    i.severity === "high" ? "border-accent bg-accent text-accent-ink" : i.severity === "medium" ? "border-line text-ink" : "border-line",
                  )}
                >
                  {i.severity === "medium" ? "med" : i.severity}
                </span>
                <span>
                  <span className="text-ink">{i.title.toLowerCase()}</span>
                  {i.count > 1 ? ` · ${i.count} pages` : i.pages[0] ? ` · ${i.pages[0].replace(report.site, "") || "/"}` : ""}
                </span>
                <span className="font-mono text-xs">{issueFix(i)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="who" className="flex flex-col gap-2.5">
          <h2 id="who" className="text-lg font-semibold">
            what emory thinks you sell, and to whom
          </h2>
          {guess ? (
            <>
              <p className="text-[15px] text-ink">{guess.sells}</p>
              <div className="flex flex-wrap gap-1.5">
                {guess.facets.map((f) => (
                  <span key={f} className="border border-line px-2 font-mono text-xs leading-5 text-ink">
                    {f}
                  </span>
                ))}
              </div>
              <span className="font-mono text-xs">from your own pages · edit any time in memory once saved</span>
            </>
          ) : (
            <p>emory couldn&apos;t work this out from the pages it read. you can describe it after saving.</p>
          )}
        </section>
      </main>

      <aside aria-labelledby="tracks" className="flex flex-[1_1_360px] flex-col gap-3.5 border-t border-dashed border-line px-6 py-9 md:max-w-[460px] md:border-l md:border-t-0 md:px-7">
        <span className="font-mono text-sm tracking-[0.12em]">002</span>
        <h2 id="tracks" className="text-[22px] font-semibold">
          {report.claimed ? "this report is saved" : "pick what emory works on"}
        </h2>
        {report.claimed ? (
          <>
            <p>it&apos;s in a workspace already. sign in to keep going.</p>
            <Link href={signedIn ? "/today" : "/login"} className="btn btn-primary self-start">
              {signedIn ? "go to today" : "sign in"}
            </Link>
          </>
        ) : (
          <form action={saveReportAction} className="flex flex-1 flex-col gap-3.5">
            <input type="hidden" name="report" value={report.id} />
            {[
              { id: "site", head: "fix my site", body: `${codeFixes} code fixes, the rest as written steps`, on: true },
              { id: "leads", head: "find and reach leads", body: "find companies that match, score them, draft outreach for approval", on: true },
              { id: "social", head: "grow on x and reddit", body: "post drafts and threads worth joining, for you to approve", on: false },
            ].map((t) => (
              <label
                key={t.id}
                className="grid cursor-pointer grid-cols-[22px_minmax(0,1fr)] items-start gap-2.5 border border-dashed border-line p-4 has-[:checked]:border-solid has-[:checked]:border-accent has-[:checked]:bg-accent-wash"
              >
                <input type="checkbox" name="track" value={t.id} defaultChecked={t.on} className="mt-[3px] size-4 accent-accent" />
                <span className="flex flex-col gap-0.5">
                  <span className="font-mono text-ink">{t.head}</span>
                  <span className="text-[13px]">{t.body}</span>
                </span>
              </label>
            ))}
            <div className="flex-1" />
            {signedIn ? null : (
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[13px] text-ink">work email, to save this</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="h-10 border border-line bg-field px-3 font-mono text-sm text-ink"
                />
              </label>
            )}
            <SubmitButton pendingLabel="saving...">{signedIn ? "save to my workspace" : "save and connect"}</SubmitButton>
            <span className="text-xs">nothing is changed on your site or sent anywhere yet.</span>
          </form>
        )}
      </aside>
    </div>
  );
}

export default function ReportPage({ params }: { params: { id: string } }) {
  const report = getReport(getAccountsDb(), params.id);
  if (!report) notFound();
  const right =
    report.status === "done" && report.report ? (
      <span className="font-mono text-xs">
        {report.report.pagesCrawled} pages · scanned {new Date(report.finishedAt ?? report.createdAt).toISOString().slice(0, 16).replace("T", " ")} utc
      </span>
    ) : null;
  return (
    <div className="flex min-h-screen flex-col">
      <Header report={report} right={right} />
      {report.status === "running" ? <Scanning report={report} /> : report.status === "error" || !report.report ? <Failed report={report} /> : <Done report={report} />}
    </div>
  );
}
