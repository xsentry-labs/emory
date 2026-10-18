import Link from "next/link";
import { writeIssueSteps } from "@/app/site-actions";
import { CopyButton } from "@/components/content/copy-button";
import { SubmitButton } from "@/components/start/form-bits";
import { lineDiff } from "@/lib/diff";
import { getDb } from "@/lib/request-db";
import { fixesForPr, getPr, listPrs, stepsFor, type Fix, type SitePr } from "@/lib/site/fixes";
import { getIssue, listIssues } from "@/lib/site/issues";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const num = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null);

function Diff({ fix }: { fix: Fix }) {
  const hunks = lineDiff(fix.before, fix.after);
  return (
    <div role="region" aria-label={`Change to ${fix.path}`} className="overflow-x-auto border border-line bg-field py-2.5 font-mono text-xs leading-[1.75]">
      <div className="px-3.5 text-ink">{fix.path}</div>
      {hunks.map((h, k) => (
        <div key={k} className={k > 0 ? "mt-2 border-t border-dashed border-line-soft pt-2" : undefined}>
          {h.map((l, j) => (
            <div key={j} className={cn("whitespace-pre px-3.5", l.kind === "add" && "bg-accent-wash text-ink", l.kind === "del" && "text-mute line-through")}>
              <span aria-hidden className="mr-3 inline-block w-3 select-none">
                {l.kind === "add" ? "+" : l.kind === "del" ? "−" : " "}
              </span>
              <span className="sr-only">{l.kind === "add" ? "added: " : l.kind === "del" ? "removed: " : ""}</span>
              {l.text || " "}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function PrStatus({ pr }: { pr: SitePr }) {
  const lines =
    pr.status === "open"
      ? [pr.checks ? (pr.checks.includes("failed") ? `✗ ${pr.checks}` : `✓ ${pr.checks}`) : "· no checks reported yet", "· waiting for a person to merge"]
      : pr.status === "merged"
        ? ["✓ merged", "· emory re-crawls after your deploy and closes what it can confirm"]
        : pr.status === "closed"
          ? ["closed without merging · its issues are open again"]
          : pr.status === "failed"
            ? [`✗ ${pr.error}`]
            : ["drafting…"];
  return (
    <aside aria-label="Pull request status" className="flex flex-col gap-3 lg:w-80 lg:shrink-0 lg:border-l lg:border-dashed lg:border-line lg:pl-6">
      <span className="font-mono text-[13px] text-ink">
        {pr.number ? `PR #${pr.number}` : "pull request"} · {pr.repo}
      </span>
      <div className="flex flex-col gap-1.5 font-mono text-xs">
        {lines.map((l) => (
          <span key={l} className={l.startsWith("·") ? "text-ink" : undefined}>
            {l}
          </span>
        ))}
      </div>
      {pr.url ? (
        <a href={pr.url} target="_blank" rel="noreferrer" className="btn btn-primary self-start">
          review on github
        </a>
      ) : null}
      <div className="mt-4 flex flex-col gap-1 border border-dashed border-line p-3">
        <span className="font-mono text-xs text-ink">after you merge</span>
        <span className="text-[13px]">emory re-crawls, closes the issues it confirms, and tracks clicks for those pages in results.</span>
      </div>
    </aside>
  );
}

export default function FixesPage({ searchParams }: { searchParams: { pr?: string; fix?: string; issue?: string; skipped?: string; error?: string } }) {
  const db = getDb();
  const prs = listPrs(db).filter((p) => p.status !== "drafting");
  const issueId = num(searchParams.issue);
  const issue = issueId ? getIssue(db, issueId) : null;
  const pr = issue ? null : (num(searchParams.pr) ? getPr(db, num(searchParams.pr)!) : null) ?? prs.find((p) => p.status === "open") ?? null;
  const fixes = pr ? fixesForPr(db, pr.id) : [];
  const fix = fixes.find((f) => f.id === num(searchParams.fix)) ?? fixes[0] ?? null;
  const steps = issue ? stepsFor(db, issue.id) : null;
  const noSource = listIssues(db).filter((i) => i.status === "open" && i.fixType !== "code fix").slice(0, 12);

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <nav aria-label="Fixes" className="flex flex-col lg:w-72 lg:shrink-0 lg:border-r lg:border-dashed lg:border-line">
        {prs.length === 0 ? <span className="px-1 pb-4 text-[13px]">no pull requests yet. tick code issues on the issues tab to open one.</span> : null}
        {prs.slice(0, 6).map((p) => (
          <div key={p.id} className="flex flex-col">
            <Link
              href={`/site/fixes?pr=${p.id}`}
              className={cn("px-4 pb-2 pt-4 font-mono text-xs tracking-[0.1em]", pr?.id === p.id ? "text-ink" : "hover:text-ink")}
            >
              {p.number ? `PR #${p.number}` : "PR"} · {p.status}
            </Link>
            {pr?.id === p.id
              ? fixes.map((f) => (
                  <Link
                    key={f.id}
                    href={`/site/fixes?pr=${p.id}&fix=${f.id}`}
                    aria-current={fix?.id === f.id ? "true" : undefined}
                    className={cn("flex flex-col gap-0.5 border-b border-dashed border-line px-4 py-3 hover:bg-wash", fix?.id === f.id && "bg-accent-wash shadow-[inset_2px_0_0_var(--accent)]")}
                  >
                    <span className="font-mono text-ink">{f.title}</span>
                    <span className="text-xs">{f.path}</span>
                  </Link>
                ))
              : null}
          </div>
        ))}
        {noSource.length ? (
          <>
            <span className="px-4 pb-2 pt-6 font-mono text-xs tracking-[0.1em]">written steps</span>
            {noSource.map((i) => (
              <Link
                key={i.id}
                href={`/site/fixes?issue=${i.id}`}
                aria-current={issue?.id === i.id ? "true" : undefined}
                className={cn("flex flex-col gap-0.5 border-b border-dashed border-line px-4 py-3 hover:bg-wash", issue?.id === i.id && "bg-accent-wash")}
              >
                <span className="font-mono text-ink">{i.title.toLowerCase()}</span>
                <span className="text-xs">{i.fixType}</span>
              </Link>
            ))}
          </>
        ) : null}
      </nav>

      <main className="flex min-w-0 flex-1 flex-col gap-[18px]">
        {searchParams.error ? (
          <p role="alert" className="border border-dashed border-danger/60 px-4 py-3 text-sm text-danger">
            {searchParams.error}
          </p>
        ) : null}
        {searchParams.skipped ? (
          <p className="border border-dashed border-line px-4 py-3 text-sm">
            {searchParams.skipped} issue{searchParams.skipped === "1" ? "" : "s"} had no safe code change and stayed open. open them for written steps.
          </p>
        ) : null}

        {issue ? (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-2 font-mono text-xs tracking-[0.1em]">
                <span className="size-[9px] bg-accent" aria-hidden />
                {issue.severity} · {issue.count} page{issue.count === 1 ? "" : "s"} · {issue.fixType}
              </span>
              <h1 className="text-2xl font-semibold">{issue.title.toLowerCase()}</h1>
              <p className="max-w-[680px]">{issue.detail}</p>
            </div>
            {issue.pages.length ? (
              <ul className="font-mono text-xs">
                {issue.pages.slice(0, 10).map((p) => (
                  <li key={p} className="border-t border-dashed border-line-soft py-1.5 last:border-b">
                    {p}
                  </li>
                ))}
              </ul>
            ) : null}
            {steps ? (
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-semibold">{steps.title}</h2>
                <p>{steps.why}</p>
                <div className="whitespace-pre-wrap border border-dashed border-line p-4 text-sm">{steps.before}</div>
                {steps.after ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-ink">ready to paste</span>
                      <CopyButton text={steps.after} />
                    </div>
                    <pre className="overflow-x-auto whitespace-pre-wrap border border-line bg-field p-4 font-mono text-xs text-ink">{steps.after}</pre>
                  </div>
                ) : null}
              </div>
            ) : (
              <form action={writeIssueSteps}>
                <input type="hidden" name="issue" value={issue.id} />
                <SubmitButton pendingLabel="writing…">write the steps</SubmitButton>
              </form>
            )}
          </>
        ) : fix ? (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-xs tracking-[0.1em]">branch {pr!.branch}</span>
              <h1 className="text-2xl font-semibold">{fix.title}</h1>
              <p className="max-w-[680px]">{fix.why}</p>
            </div>
            <Diff fix={fix} />
          </>
        ) : (
          <div className="flex flex-col gap-2 border border-dashed border-line p-6">
            <h1 className="text-lg font-semibold">nothing to review</h1>
            <p>
              open a pull request from the <Link href="/site" className="text-ink underline underline-offset-4">issues</Link> tab, or pick an
              issue on the left for written steps.
            </p>
          </div>
        )}
      </main>

      {pr && !issue ? <PrStatus pr={pr} /> : null}
    </div>
  );
}
