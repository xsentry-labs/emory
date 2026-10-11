"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { SeoAuditRow } from "@/lib/seo/audit";

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-caption text-mute hover:text-ink"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

const SEVERITY: Record<string, { label: string; variant: "ink" | "default" | "outline" }> = {
  high: { label: "High", variant: "ink" },
  medium: { label: "Medium", variant: "default" },
  low: { label: "Low", variant: "outline" },
};

function scoreColor(score: number) {
  return score >= 80 ? "text-ink" : score >= 50 ? "text-ink" : "text-danger";
}

export function SeoView({ initial }: { initial: SeoAuditRow | null }) {
  const [audit, setAudit] = useState(initial);
  const running = audit?.status === "running";

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/seo", { cache: "no-store" });
      if (res.ok) setAudit(((await res.json()) as { audit: SeoAuditRow | null }).audit);
    } catch {
      /* try again on the next tick */
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [running, refresh]);

  if (!audit) return <p className="text-mute">No audit yet. Run one to see what to fix first.</p>;
  if (audit.status === "running") {
    return (
      <div className="card p-5">
        <p className="mb-3 text-sm">Crawling {audit.site} and checking every page...</p>
        <div className="h-1.5 overflow-hidden rounded bg-wash">
          <div className="h-full w-1/3 animate-sweep bg-ink" />
        </div>
      </div>
    );
  }
  if (audit.status === "error" || !audit.report) {
    return (
      <p role="alert" className="rounded-md border border-danger/30 px-4 py-3 text-sm text-danger">
        {audit.error || "The audit failed."}
      </p>
    );
  }

  const r = audit.report;
  const high = r.issues.filter((i) => i.severity === "high").length;
  return (
    <div className="space-y-8">
      <section className="card flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
        <div>
          <p className="label">SEO score</p>
          <p className={`tnum font-display text-display font-medium ${scoreColor(r.score)}`}>{r.score}</p>
        </div>
        <div className="text-sm text-mute">
          <p>
            {r.pagesCrawled} page{r.pagesCrawled === 1 ? "" : "s"} checked on {r.site.replace(/^https?:\/\//, "")}
          </p>
          <p>
            {r.issues.length} issue{r.issues.length === 1 ? "" : "s"} found, {high} high priority
          </p>
          {audit.finished_at ? <p className="tnum">Ran {new Date(audit.finished_at).toLocaleString()}</p> : null}
        </div>
        {r.plan ? <p className="min-w-60 flex-1 text-sm">{r.plan.summary}</p> : null}
      </section>

      <section>
        <h2 className="mb-3 font-display text-h3">Fix plan</h2>
        {r.plan && r.plan.fixes.length > 0 ? (
          <ol className="space-y-3">
            {r.plan.fixes.map((f, i) => (
              <li key={`${f.title}-${i}`} className="card space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tnum flex size-6 items-center justify-center rounded-full bg-ink text-caption text-paper">{i + 1}</span>
                  <h3 className="font-medium">{f.title}</h3>
                  <span className="text-caption text-mute">{f.page.replace(/^https?:\/\//, "")}</span>
                </div>
                <p className="text-sm text-mute">{f.why}</p>
                <p className="text-sm">{f.how}</p>
                {f.copy ? (
                  <div className="rounded-md bg-wash p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="label">Ready to paste</span>
                      <CopyButton text={f.copy} />
                    </div>
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm">{f.copy}</pre>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-mute">{r.planError || "No AI fix plan for this audit. The findings below still apply."}</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-h3">All findings</h2>
        {r.issues.length === 0 ? (
          <p className="text-sm text-mute">No issues found by the automated checks.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {r.issues.map((i) => (
              <li key={i.id} className="p-4">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                    <Badge variant={SEVERITY[i.severity].variant}>{SEVERITY[i.severity].label}</Badge>
                    <span className="font-medium">{i.title}</span>
                    <span className="tnum text-caption text-mute">
                      {i.pages.length > 0 ? `${i.count} page${i.count === 1 ? "" : "s"}` : "site-wide"}
                    </span>
                  </summary>
                  <p className="mt-2 text-sm text-mute">{i.detail}</p>
                  {i.pages.length > 0 ? (
                    <ul className="mt-2 space-y-0.5 text-caption">
                      {i.pages.map((p) => (
                        <li key={p} className="break-all text-mute">
                          {p}
                        </li>
                      ))}
                      {i.count > i.pages.length ? <li className="text-mute">and {i.count - i.pages.length} more</li> : null}
                    </ul>
                  ) : null}
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-h3">Pages checked</h2>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-line bg-wash text-caption text-mute">
              <tr>
                <th className="px-3 py-2 font-medium">Page</th>
                <th className="w-16 px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="w-20 px-3 py-2 font-medium">Words</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.pages.map((p) => (
                <tr key={p.url}>
                  <td className="max-w-xs break-all px-3 py-2 text-mute">{p.url.replace(/^https?:\/\//, "")}</td>
                  <td className="tnum px-3 py-2">{p.status}</td>
                  <td className="px-3 py-2">{p.title || <span className="text-danger">missing</span>}</td>
                  <td className="tnum px-3 py-2">{p.words}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
