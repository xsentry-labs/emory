"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Link2, Loader2 } from "lucide-react";
import {
  AuditApiError,
  applyRun,
  decideSuggestion,
  startAudit,
  type AuditFinding,
  type AuditRun,
  type Suggestion,
} from "@/lib/audit-api";
import { companyFromDomain } from "@/lib/mock-data";
import { normalizeDomain } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STEPS = [
  "Reading your site",
  "Running the technical, on-page and GEO/AEO checks",
  "Prioritizing what's worth fixing",
];

const SEVERITY_LABEL = {
  critical: "Costing you now",
  warning: "Worth fixing",
  notice: "Worth knowing",
} as const;

const PRIORITY_LABEL: Record<Suggestion["priority"], string> = {
  P0: "Fix first",
  P1: "High priority",
  P2: "Moderate priority",
  P3: "Low priority",
};

export function AuditView() {
  const params = useSearchParams();
  const site = normalizeDomain(params.get("site") ?? "") || "example.com";
  const company = companyFromDomain(site);

  const [run, setRun] = useState<AuditRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [applying, setApplying] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const cycle = window.setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 3_200);

    startAudit({ url: site })
      .then((result) => {
        window.clearInterval(cycle);
        if (result.status === "failed") {
          setError(result.error ?? "The audit failed for an unknown reason.");
          return;
        }
        setRun(result);
        setSuggestions(result.suggestions);
      })
      .catch((err) => {
        window.clearInterval(cycle);
        setError(err instanceof AuditApiError ? err.message : "Something went wrong reading this site.");
      });

    return () => window.clearInterval(cycle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site]);

  const running = !run && !error;

  const grouped = useMemo(() => {
    const findings = run?.findings ?? [];
    return [
      { key: "critical" as const, items: findings.filter((f: AuditFinding) => f.severity === "critical") },
      { key: "warning" as const, items: findings.filter((f: AuditFinding) => f.severity === "warning") },
      { key: "notice" as const, items: findings.filter((f: AuditFinding) => f.severity === "notice") },
    ];
  }, [run]);

  const approvedCount = suggestions.filter((s) => s.status === "approved").length;

  async function handleDecision(suggestionId: string, decision: "approve" | "reject") {
    if (!run) return;
    setDecidingId(suggestionId);
    try {
      const updated = await decideSuggestion(run.id, suggestionId, decision);
      setSuggestions((prev) => prev.map((s) => (s.id === suggestionId ? updated : s)));
    } catch {
      toast({ title: "Could not save that decision", description: "The audit backend didn't confirm it — try again." });
    } finally {
      setDecidingId(null);
    }
  }

  async function handleApply() {
    if (!run) return;
    setApplying(true);
    try {
      const updated = await applyRun(run.id);
      setRun(updated);
      setSuggestions(updated.suggestions);
      toast({
        title: updated.prUrl ? "Pull request opened" : "Fixes written locally",
        description: updated.prUrl
          ? "The approved fixes are ready for review on GitHub."
          : "No GitHub repo is configured on the backend, so the fixes were written to a local patch directory instead.",
      });
    } catch {
      toast({ title: "Could not apply the approved fixes", description: "Check the backend logs and try again." });
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5">
          <Link href="/" className="font-display text-h3 font-semibold text-ink">
            Emory
          </Link>
          <button
            type="button"
            onClick={() => {
              toast({
                title: "Link copied",
                description: "Anyone you send it to can read this without an account.",
              });
            }}
            className="inline-flex items-center gap-1.5 rounded text-caption text-mute transition-colors hover:text-ink"
          >
            <Link2 className="h-3.5 w-3.5" />
            Share this
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-5 py-12">
        {error ? (
          <div>
            <h1 className="font-display text-section font-medium text-ink">Could not read {site}</h1>
            <p className="mt-3 max-w-measure text-body text-mute">{error}</p>
            <Button className="mt-6" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </div>
        ) : running ? (
          <div>
            <h1 className="font-display text-section font-medium text-ink">Reading {site}</h1>
            <ul className="mt-8 space-y-4">
              {STEPS.map((label, index) => {
                const done = step > index && step !== 0;
                const active = step === index;
                return (
                  <li key={label} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border",
                        active ? "border-ink" : "border-line",
                      )}
                    >
                      {active ? <Loader2 className="h-3 w-3 animate-spin" /> : done ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className={cn("text-body", active ? "text-ink" : "text-mute")}>{label}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-10 text-caption text-mute">
              A real crawl and multi-agent audit — this can take a minute or two depending on site size.
            </p>
          </div>
        ) : run ? (
          <div className="animate-fade-in">
            <p className="text-caption text-mute">
              {site} · {run.crawlSummary?.pagesRead ?? 0} pages read via {run.crawlSummary?.crawler ?? "crawler"}
              {run.crawlSummary?.truncated ? " (sample truncated)" : ""}
            </p>

            <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
              <div className="shrink-0">
                <p className="font-display text-[4rem] font-medium leading-none tabular-nums text-ink">
                  {run.score ?? "—"}
                  <span className="text-h3 text-mute">/100</span>
                </p>
                <p className="mt-2 label">Health score</p>
              </div>
              <h1 className="max-w-measure font-display text-h2 font-medium leading-snug text-ink">
                {buildVerdict(run, company)}
              </h1>
            </div>

            {run.warnings.length > 0 ? (
              <div className="mt-6 rounded-lg border border-agent-guard/40 bg-agent-guard/5 p-4">
                <p className="text-sm font-medium text-ink">This run is incomplete</p>
                <ul className="mt-2 space-y-1 text-caption text-mute">
                  {run.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-10 rule" />

            {grouped.map((group) =>
              group.items.length === 0 ? null : (
                <section key={group.key} className="mt-10">
                  <h2 className="text-sm font-medium text-ink">
                    {SEVERITY_LABEL[group.key]}
                    <span className="ml-2 text-caption font-normal text-mute">{group.items.length}</span>
                  </h2>
                  <ul className="mt-4 space-y-3">
                    {group.items.map((finding) => (
                      <li key={finding.id} className="flex gap-4 rounded-lg border border-line bg-paper p-5">
                        <span aria-hidden className="w-[3px] shrink-0 self-stretch rounded-full bg-agent-beacon" />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-body font-medium text-ink">{finding.title}</h3>
                          <p className="mt-1.5 max-w-measure text-sm text-mute">{finding.detail}</p>
                          {finding.evidence[0] ? (
                            <p className="mt-2 max-w-measure text-sm text-ink">
                              <span className="text-mute">{finding.evidence[0].url}</span> —{" "}
                              <code className="text-xs">{truncate(finding.evidence[0].currentValue, 140)}</code>
                            </p>
                          ) : null}
                          <p className="mt-3 text-caption text-mute">{finding.expectedImpact}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ),
            )}

            <section className="mt-12 rounded-lg border border-line bg-wash p-6">
              <h2 className="font-display text-h2 font-medium text-ink">
                Emory found {run.findings.length} thing{run.findings.length === 1 ? "" : "s"} and turned {suggestions.length} of
                them into fixes you can approve.
              </h2>
              <p className="mt-2 max-w-measure text-body text-mute">
                Nothing gets published until you approve it below. Approved fixes are handed to the coding agent, which
                opens a pull request with exactly what changed.
              </p>
            </section>

            {suggestions.length > 0 ? (
              <section className="mt-8">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-h2 font-medium text-ink">Suggested fixes</h2>
                  <Button onClick={handleApply} disabled={approvedCount === 0 || applying}>
                    {applying ? "Applying…" : `Apply ${approvedCount} approved fix${approvedCount === 1 ? "" : "es"}`}
                  </Button>
                </div>

                {run.prUrl ? (
                  <p className="mt-3 text-sm text-ink">
                    Pull request opened:{" "}
                    <a href={run.prUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                      {run.prUrl}
                    </a>
                  </p>
                ) : run.patchDir ? (
                  <p className="mt-3 text-sm text-mute">
                    No GitHub repo configured on the backend — fixes were written to <code>{run.patchDir}</code> instead.
                  </p>
                ) : null}

                <ul className="mt-4 space-y-3">
                  {suggestions.map((s) => (
                    <li key={s.id} className="rounded-lg border border-line bg-paper p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="label">{PRIORITY_LABEL[s.priority]}</span>
                          <h3 className="mt-1 text-body font-medium text-ink">{s.title}</h3>
                          <p className="mt-1.5 max-w-measure text-sm text-mute">{s.why}</p>
                          <p className="mt-2 max-w-measure text-sm text-ink">{s.recommendedChange}</p>
                          <p className="mt-2 text-caption text-mute">
                            {s.expectedImpact} · Effort: {s.estimatedEffort}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {s.status === "pending" ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={decidingId === s.id}
                                onClick={() => handleDecision(s.id, "reject")}
                              >
                                Reject
                              </Button>
                              <Button size="sm" disabled={decidingId === s.id} onClick={() => handleDecision(s.id, "approve")}>
                                Approve
                              </Button>
                            </>
                          ) : (
                            <span
                              className={cn(
                                "rounded border px-2 py-1 text-caption",
                                s.status === "approved" && "border-ink text-ink",
                                s.status === "rejected" && "border-line text-mute",
                                s.status === "applied" && "border-ink bg-ink text-paper",
                              )}
                            >
                              {s.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="mt-8 rounded-lg border border-line p-6">
              {sent ? (
                <p className="text-sm text-ink">
                  Sent. The full report is in your inbox, and it will still be here if you come back.
                </p>
              ) : (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!email.includes("@")) {
                      toast({ title: "That address does not look right", description: "Check it and try again." });
                      return;
                    }
                    setSent(true);
                    toast({
                      title: "Report sent",
                      description: "A copy is on its way. You did not need an account for it.",
                    });
                  }}
                >
                  <Label htmlFor="audit-email">Want a copy of this?</Label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:max-w-md">
                    <Input
                      id="audit-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@yourcompany.com"
                      className="flex-1"
                    />
                    <Button type="submit" variant="outline">
                      Send it
                    </Button>
                  </div>
                  <p className="mt-2 text-caption text-mute">Asked after the analysis, never before it.</p>
                </form>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function buildVerdict(run: AuditRun, company: string): string {
  const critical = run.findings.filter((f) => f.severity === "critical").length;
  if (critical === 0) {
    return `${company}'s site is in good shape. ${run.findings.length} smaller thing${run.findings.length === 1 ? "" : "s"} worth cleaning up.`;
  }
  return `${critical} thing${critical === 1 ? " is" : "s are"} actively costing ${company} visibility right now.`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
