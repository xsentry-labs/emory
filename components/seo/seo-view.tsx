"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useHydrated } from "@/hooks/use-hydrated";
import { KEYWORD_GAPS, SEO_ISSUES, SEO_SCORES, hydrate } from "@/lib/mock-data";
import { useWire } from "@/lib/store";
import type { SeoIssue, SeoSeverity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FixDialog } from "./fix-dialog";
import { SEVERITY } from "./severity";

const ORDER: SeoSeverity[] = ["critical", "warning", "notice"];

export function SeoView() {
  const hydrated = useHydrated();
  const profile = useWire((state) => state.profile);
  const [openIssue, setOpenIssue] = useState<SeoIssue | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeoSeverity | "all">("all");

  const keywords = useMemo(
    () => hydrate(KEYWORD_GAPS, profile.brand, profile.domain),
    [profile.brand, profile.domain],
  );

  const issues =
    severityFilter === "all"
      ? SEO_ISSUES
      : SEO_ISSUES.filter((issue) => issue.severity === severityFilter);

  const counts = {
    all: SEO_ISSUES.length,
    critical: SEO_ISSUES.filter((i) => i.severity === "critical").length,
    warning: SEO_ISSUES.filter((i) => i.severity === "warning").length,
    notice: SEO_ISSUES.filter((i) => i.severity === "notice").length,
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        kicker={`Audit desk · ${SEO_SCORES.lastCrawl}`}
        title="SEO Audit"
        standfirst={`What the nightly crawl of ${hydrated ? profile.domain : "your site"} turned up: ${SEO_SCORES.crawledPages.toLocaleString()} URLs read, ${counts.critical} faults serious enough to cap everything else the desks are doing.`}
        actions={
          <Button
            variant="outline"
            onClick={() =>
              toast({
                title: "Crawl queued",
                description:
                  "The tech desk will re-read the site and file any changes to the feed.",
              })
            }
          >
            <RefreshCw className="h-4 w-4" />
            Re-run the crawl
          </Button>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="sheet flex items-center gap-6 p-6">
          <ScoreDial score={SEO_SCORES.overall} />
          <div className="min-w-0">
            <p className="wire-label">Overall score</p>
            <p className="mt-1 font-display text-2xl font-semibold leading-tight tracking-tight text-ink">
              Held back by the crawl
            </p>
            <p className="mt-2 text-sm leading-snug text-ink-soft">
              Content and authority are doing their job. The technical floor is
              what is costing you.
            </p>
            <p className="mt-3 font-mono text-2xs uppercase tracking-wire text-teletype-green">
              {SEO_SCORES.trend}
            </p>
          </div>
        </div>

        <div className="sheet grid grid-cols-1 divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            {
              label: "Technical",
              score: SEO_SCORES.technical,
              note: "Indexation and rendering faults",
            },
            {
              label: "Content",
              score: SEO_SCORES.content,
              note: "Depth, coverage and freshness",
            },
            {
              label: "Authority",
              score: SEO_SCORES.authority,
              note: "Referring domains and mentions",
            },
          ].map((sub, index) => (
            <div key={sub.label} className="p-6">
              <p className="wire-label">{sub.label}</p>
              <p className="mt-1 font-mono text-4xl font-medium leading-none tabular-nums text-ink">
                {sub.score}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line/70">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    sub.score < 60
                      ? "bg-wire-red"
                      : sub.score < 75
                        ? "bg-desk-gold"
                        : "bg-teletype-green",
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${sub.score}%` }}
                  transition={{ duration: 0.7, delay: 0.1 * index, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <p className="mt-2 text-xs leading-snug text-slate">{sub.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-2xs uppercase tracking-stamp text-wire-red">
              Fault log
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
              What the crawl turned up
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(["all", ...ORDER] as const).map((key) => {
              const active = severityFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSeverityFilter(key)}
                  className={cn(
                    "rounded-sm border px-2.5 py-1 font-mono text-2xs uppercase tracking-wire transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
                    active
                      ? "border-ink bg-ink text-paper"
                      : "border-line bg-card text-slate hover:border-ink/30 hover:text-ink",
                  )}
                >
                  {key === "all" ? "All faults" : SEVERITY[key].label}
                  <span className="ml-1.5 tabular-nums opacity-70">{counts[key]}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="rule mt-4" />

        <ul className="mt-4 space-y-3">
          {issues.map((issue, index) => {
            const severity = SEVERITY[issue.severity];
            return (
              <motion.li
                key={issue.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.24) }}
                className={cn(
                  "flex flex-col gap-4 rounded-lg border border-l-[3px] border-line/80 bg-card p-5 shadow-sheet transition-shadow hover:shadow-sheet-raised md:flex-row md:items-center",
                  severity.rule,
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-sm border px-2 py-0.5 font-mono text-2xs uppercase tracking-wire",
                        severity.chip,
                      )}
                    >
                      {severity.label}
                    </span>
                    <span className="font-mono text-2xs uppercase tracking-wire text-slate">
                      {issue.pages} page{issue.pages === 1 ? "" : "s"}
                    </span>
                  </div>
                  <h3 className="mt-2 font-display text-xl font-semibold leading-snug tracking-tight text-ink">
                    {issue.title}
                  </h3>
                  <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-soft">
                    {issue.detail}
                  </p>
                </div>

                <div className="shrink-0">
                  {issue.dispatchId ? (
                    <Button variant="outline" asChild>
                      <Link href={`/feed?filter=all&dispatch=${issue.dispatchId}`}>
                        {issue.actionLabel}
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setOpenIssue(issue)}>
                      {issue.actionLabel}
                    </Button>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ul>
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-2xs uppercase tracking-stamp text-wire-red">
              Keyword gaps
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
              Queries our rivals answer and we do not
            </h2>
          </div>
          <p className="hidden max-w-xs text-xs leading-snug text-slate md:block">
            Sorted by the search desk on volume against difficulty. Each row is a
            page brief waiting to be filed.
          </p>
        </div>
        <div className="rule mt-4" />

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {["Query", "Volume", "Difficulty", "Our rank", "Best rival", "Intent"].map(
                  (head) => (
                    <th
                      key={head}
                      scope="col"
                      className="px-3 py-2 font-mono text-2xs uppercase tracking-wire text-slate first:pl-0 last:pr-0"
                    >
                      {head}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {keywords.map((row, index) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: Math.min(index * 0.04, 0.28) }}
                  className="border-b border-line/70 transition-colors hover:bg-card"
                >
                  <th scope="row" className="py-3 pr-3 text-left">
                    <span className="font-display text-lg font-medium tracking-tight text-ink">
                      {row.keyword}
                    </span>
                  </th>
                  <td className="px-3 py-3 font-mono text-sm tabular-nums text-ink-soft">
                    {row.volume.toLocaleString()}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-line/70">
                        <motion.span
                          className={cn(
                            "block h-full rounded-full",
                            row.difficulty < 25
                              ? "bg-teletype-green"
                              : row.difficulty < 40
                                ? "bg-desk-gold"
                                : "bg-wire-red",
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: `${row.difficulty}%` }}
                          transition={{ duration: 0.6, delay: 0.1 }}
                        />
                      </span>
                      <span className="font-mono text-sm tabular-nums text-ink-soft">
                        {row.difficulty}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {row.ourRank ? (
                      <span className="font-mono text-sm tabular-nums text-ink">
                        #{row.ourRank}
                      </span>
                    ) : (
                      <span className="font-mono text-2xs uppercase tracking-wire text-wire-red">
                        Unranked
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-sm text-ink-soft">
                    {row.bestRival.name}{" "}
                    <span className="font-mono tabular-nums text-slate">
                      #{row.bestRival.rank}
                    </span>
                  </td>
                  <td className="py-3 pl-3">
                    <span className="rounded-sm border border-line bg-paper/60 px-2 py-0.5 font-mono text-2xs uppercase tracking-wire text-slate">
                      {row.intent}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-card p-5 shadow-sheet">
          <p className="max-w-xl font-display text-lg leading-relaxed text-ink-soft">
            The search desk has already filed briefs for the two lowest-difficulty
            rows. They are sitting in the feed waiting on your approval.
          </p>
          <Button asChild>
            <Link href="/feed?desk=seo">
              Read the search desk filings
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <FixDialog
        issue={openIssue}
        open={Boolean(openIssue)}
        onOpenChange={(open) => {
          if (!open) setOpenIssue(null);
        }}
      />
    </div>
  );
}

function ScoreDial({ score }: { score: number }) {
  const reduced = useReducedMotion();
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;

  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="hsl(var(--line))"
          strokeWidth="6"
        />
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="hsl(var(--ink))"
          strokeWidth="6"
          strokeLinecap="butt"
          strokeDasharray={`${dash} ${circumference}`}
          initial={reduced ? false : { strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${dash} ${circumference}` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-4xl font-medium leading-none tabular-nums text-ink">
          {score}
        </span>
        <span className="mt-1 font-mono text-2xs uppercase tracking-wire text-slate">
          / 100
        </span>
      </div>
    </div>
  );
}
