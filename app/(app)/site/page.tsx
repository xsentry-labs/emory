import Link from "next/link";
import { changeIssue, openFixPr } from "@/app/site-actions";
import { AutoRefresh } from "@/components/report/auto-refresh";
import { githubAppConfig } from "@/lib/integrations/github";
import { getDb } from "@/lib/request-db";
import { latestAudit } from "@/lib/seo/audit";
import { githubTarget, listPrs } from "@/lib/site/fixes";
import { listIssues, type SiteIssue } from "@/lib/site/issues";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FILTERS = [
  { id: "all", label: "all", match: () => true },
  { id: "code", label: "code", match: (i: SiteIssue) => i.fixType === "code fix" },
  { id: "content", label: "content", match: (i: SiteIssue) => i.fixType === "content" },
  { id: "other", label: "server · redirects", match: (i: SiteIssue) => i.fixType === "server" || i.fixType === "redirects" },
] as const;

function Status({ i, prNumber }: { i: SiteIssue; prNumber: number | null }) {
  if (i.status === "in_pr")
    return (
      <Link href={`/site/fixes?pr=${i.prId}`} className="inline-flex items-center gap-1.5 font-mono text-xs text-accent">
        <span className="size-2 bg-accent" aria-hidden />
        in PR{prNumber ? ` #${prNumber}` : ""} · needs you
      </Link>
    );
  if (i.status === "fixed") return <span className="font-mono text-xs">✓ fixed · confirmed by crawl</span>;
  if (i.status === "dismissed") return <span className="font-mono text-xs">dismissed</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
      <span className="size-2 border border-mute" aria-hidden />
      open
    </span>
  );
}

export default function IssuesPage({ searchParams }: { searchParams: { fix?: string; error?: string } }) {
  const db = getDb();
  const audit = latestAudit(db);
  const issues = listIssues(db);
  const prs = new Map(listPrs(db).map((p) => [p.id, p.number]));
  const filter = FILTERS.find((f) => f.id === searchParams.fix) ?? FILTERS[0];
  const shown = issues.filter(filter.match);
  const target = githubTarget(db);
  const canPr = Boolean(target && githubAppConfig());
  const codeOpen = issues.filter((i) => i.status === "open" && i.fixType === "code fix");
  const plan = audit?.report?.plan;

  return (
    <div className="flex flex-col gap-8 xl:flex-row">
      {audit?.status === "running" ? <AutoRefresh everyMs={3000} /> : null}
      <form id="pr" action={openFixPr} className="flex min-w-0 flex-1 flex-col gap-4">
        {searchParams.error ? (
          <p role="alert" className="border border-dashed border-danger/60 px-4 py-3 text-sm text-danger">
            {searchParams.error}
          </p>
        ) : null}
        {audit?.status === "error" ? (
          <p role="alert" className="border border-dashed border-danger/60 px-4 py-3 text-sm text-danger">
            The last crawl failed: {audit.error}
          </p>
        ) : null}
        <nav aria-label="Filter by fix type" className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => {
            const n = issues.filter((i) => (i.status === "open" || i.status === "in_pr") && f.match(i)).length;
            const active = f.id === filter.id;
            return (
              <Link
                key={f.id}
                href={f.id === "all" ? "/site" : `/site?fix=${f.id}`}
                aria-current={active ? "page" : undefined}
                className={cn("chip", active && "border-accent bg-accent text-accent-ink")}
              >
                {f.label} {n}
              </Link>
            );
          })}
          <div className="flex-1" />
          <span className="font-mono text-xs">most damaging first</span>
        </nav>

        {issues.length === 0 ? (
          <div className="flex flex-col gap-2 border border-dashed border-line p-6">
            <h2 className="text-lg font-semibold">{audit?.status === "running" ? "reading your site…" : "no issues yet"}</h2>
            <p>{audit ? "issues appear here when the crawl finishes." : "crawl your site to find what's hurting search."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-dashed border-line text-left font-mono text-xs">
                  <th scope="col" className="w-8 px-3 py-2.5 font-normal">
                    <span className="sr-only">Include in pull request</span>
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-normal">issue</th>
                  <th scope="col" className="px-3 py-2.5 font-normal">pages</th>
                  <th scope="col" className="px-3 py-2.5 font-normal">severity</th>
                  <th scope="col" className="px-3 py-2.5 font-normal">fix</th>
                  <th scope="col" className="px-3 py-2.5 font-normal">status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => {
                  const done = i.status === "fixed" || i.status === "dismissed";
                  return (
                    <tr key={i.id} className="border-b border-dashed border-line-soft align-top hover:bg-wash">
                      <td className="px-3 py-3">
                        {canPr && i.status === "open" && i.fixType === "code fix" ? (
                          <input type="checkbox" name="issue" value={i.id} defaultChecked={i.severity !== "low"} aria-label={`Fix: ${i.title}`} className="size-4 accent-accent" />
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/site/fixes?issue=${i.id}`} className={cn("font-mono text-ink hover:underline", done && "text-mute line-through")}>
                          {i.title.toLowerCase()}
                        </Link>
                        <p className="mt-0.5 max-w-xl">{i.detail}</p>
                      </td>
                      <td className="tnum px-3 py-3 font-mono">{i.count}</td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-block border px-1.5 font-mono text-[11px] tracking-[0.06em]",
                            i.severity === "high" ? "border-accent bg-accent text-accent-ink" : i.severity === "medium" ? "border-line text-ink" : "border-line",
                          )}
                        >
                          {i.severity === "medium" ? "med" : i.severity}
                        </span>
                      </td>
                      <td className="px-3 py-3">{i.fixType}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <Status i={i} prNumber={i.prId ? (prs.get(i.prId) ?? null) : null} />
                          {i.status === "open" || i.status === "dismissed" ? (
                            <button
                              type="submit"
                              formAction={changeIssue}
                              name="toggle"
                              value={i.id}
                              className="font-mono text-xs underline-offset-4 hover:text-ink hover:underline"
                            >
                              {i.status === "open" ? "dismiss" : "reopen"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </form>

      <aside aria-label="How fixes ship" className="flex flex-col gap-3.5 xl:w-80 xl:shrink-0 xl:border-l xl:border-dashed xl:border-line xl:pl-6">
        <span className="font-mono text-[13px] text-ink">how fixes ship</span>
        <div className="flex flex-col gap-1 border border-dashed border-line p-3">
          <span className="inline-flex items-center gap-2 font-mono text-[13px] text-ink">
            {target ? <span className="size-2 bg-accent" aria-hidden /> : null}
            {target ? `github · ${target.repo}` : "github · not connected"}
          </span>
          <span className="text-[13px]">
            {target ? "code fixes go in one pull request per batch. emory never merges." : "connect a repository and code fixes arrive as pull requests."}
          </span>
          {target ? null : (
            <Link href="/site/settings" className="font-mono text-xs text-ink underline underline-offset-4">
              connect github
            </Link>
          )}
        </div>
        <div className="flex flex-col gap-1 border border-dashed border-line p-3">
          <span className="font-mono text-[13px] text-ink">content · written steps</span>
          <span className="text-[13px]">open any issue for steps and ready-to-paste copy. cms drafts are coming next.</span>
        </div>
        {canPr ? (
          <SubmitButtonFor form="pr" disabled={codeOpen.length === 0} label={`open a PR with the ticked fixes`} />
        ) : null}
        {plan?.summary ? (
          <div className="flex flex-col gap-1 border border-dashed border-line p-3">
            <span className="font-mono text-xs text-ink">emory&apos;s read</span>
            <span className="text-[13px]">{plan.summary}</span>
          </div>
        ) : null}
        <span className="text-xs">an issue only closes when the next crawl confirms the fix.</span>
      </aside>
    </div>
  );
}

function SubmitButtonFor({ form, disabled, label }: { form: string; disabled: boolean; label: string }) {
  return (
    <button type="submit" form={form} disabled={disabled} className="btn btn-primary self-start">
      {label}
    </button>
  );
}
