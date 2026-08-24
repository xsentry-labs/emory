"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, Check, Link2 } from "lucide-react";
import { AGENT_BY_ID } from "@/lib/agents";
import { AUDIT_FINDINGS, AUDIT_SCORE, companyFromDomain, hydrate } from "@/lib/mock-data";
import { normalizeDomain, useEmory } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STEPS = [
  "Reading your site",
  "Finding your competitors",
  "Checking how AI describes you",
];

const SEVERITY_LABEL = {
  critical: "Costing you now",
  warning: "Worth fixing",
  notice: "Worth knowing",
} as const;

export function AuditView() {
  const params = useSearchParams();
  const workspace = useEmory((state) => state.workspace);
  const site = normalizeDomain(params.get("site") ?? "") || workspace.domain;
  const company = companyFromDomain(site);

  const [step, setStep] = useState(0);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  // One of the two places motion is allowed: the analysis running.
  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStep(1), 900),
      window.setTimeout(() => setStep(2), 1_800),
      window.setTimeout(() => setStep(3), 2_600),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, []);

  const findings = useMemo(() => hydrate(AUDIT_FINDINGS, company, site), [company, site]);
  const verdict = useMemo(() => hydrate(AUDIT_SCORE.verdict, company, site), [company, site]);
  const running = step < 3;

  const grouped = [
    { key: "critical" as const, items: findings.filter((f) => f.severity === "critical") },
    { key: "warning" as const, items: findings.filter((f) => f.severity === "warning") },
    { key: "notice" as const, items: findings.filter((f) => f.severity === "notice") },
  ];

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
        {running ? (
          <div>
            <h1 className="font-display text-section font-medium text-ink">
              Reading {site}
            </h1>
            <ul className="mt-8 space-y-4">
              {STEPS.map((label, index) => {
                const done = step > index;
                const active = step === index;
                return (
                  <li key={label} className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border",
                        done ? "border-ink bg-ink text-paper" : active ? "border-ink" : "border-line",
                      )}
                    >
                      {done ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className={cn("text-body", done || active ? "text-ink" : "text-mute")}>
                      {label}
                    </span>
                    {active ? (
                      <span className="relative h-px flex-1 overflow-hidden bg-line">
                        <span className="absolute inset-y-0 left-0 w-1/3 animate-sweep bg-ink" />
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="mt-10 text-caption text-mute">
              {AUDIT_SCORE.pagesRead} pages. This takes about a minute on a site this size.
            </p>
          </div>
        ) : (
          <div className="animate-fade-in">
            <p className="text-caption text-mute">
              {site} · {AUDIT_SCORE.pagesRead} pages read in {AUDIT_SCORE.seconds} seconds
            </p>

            <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-10">
              <div className="shrink-0">
                <p className="font-display text-[4rem] font-medium leading-none tabular-nums text-ink">
                  {AUDIT_SCORE.score}
                  <span className="text-h3 text-mute">/100</span>
                </p>
                <p className="mt-2 label">Health score</p>
              </div>
              <h1 className="max-w-measure font-display text-h2 font-medium leading-snug text-ink">
                {verdict}
              </h1>
            </div>

            <div className="mt-10 rule" />

            {grouped.map((group) =>
              group.items.length === 0 ? null : (
                <section key={group.key} className="mt-10">
                  <h2 className="text-sm font-medium text-ink">
                    {SEVERITY_LABEL[group.key]}
                    <span className="ml-2 text-caption font-normal text-mute">
                      {group.items.length}
                    </span>
                  </h2>
                  <ul className="mt-4 space-y-3">
                    {group.items.map((finding) => {
                      const owner = AGENT_BY_ID[finding.ownerId];
                      return (
                        <li
                          key={finding.id}
                          className="flex gap-4 rounded-lg border border-line bg-paper p-5"
                        >
                          <span
                            aria-hidden
                            className="w-[3px] shrink-0 self-stretch rounded-full"
                            style={{ background: owner.hex }}
                          />
                          <div className="min-w-0 flex-1">
                            <h3 className="text-body font-medium text-ink">{finding.title}</h3>
                            <p className="mt-1.5 max-w-measure text-sm text-mute">{finding.detail}</p>
                            <p className="mt-2 max-w-measure text-sm text-ink">{finding.costing}</p>
                            <p className="mt-3 text-caption text-mute">
                              Fixed by{" "}
                              <span className="font-medium text-ink">{owner.name}</span> ·{" "}
                              {owner.line}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ),
            )}

            <section className="mt-12 rounded-lg border border-line bg-wash p-6">
              <h2 className="font-display text-h2 font-medium text-ink">
                Emory found {findings.length} things. It can start on {findings.filter((f) => f.actionId).length} of them today.
              </h2>
              <p className="mt-2 max-w-measure text-body text-mute">
                Audit only tells you what is wrong. Each problem above is handed to the agent that
                repairs it, and nothing gets published until you approve it.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button asChild size="lg">
                  <Link href="/onboarding">
                    Start with your website
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <span className="text-caption text-mute">
                  Ten minutes, and you approve the first three fixes yourself.
                </span>
              </div>
            </section>

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
                  <p className="mt-2 text-caption text-mute">
                    Asked after the analysis, never before it.
                  </p>
                </form>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
