"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { approveDraft } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LeadView, LeadsPayload } from "@/lib/leads-view";

const POLL_RUNNING_MS = 2000;
const POLL_IDLE_MS = 10000;

function breakdown(r: NonNullable<LeadView["ratings"]>) {
  return `ICP fit ${r.icpFit}/3 · Need ${r.need}/3 · Budget ${r.budget}/3 · Authority ${r.authority}/3 · Timing ${r.timing}/3`;
}

function Progress({ p }: { p: LeadsPayload["pipeline"] }) {
  if (p.status === "running") {
    const label =
      p.phase === "finding"
        ? "Finding leads that match your ideal customer..."
        : `Researching, scoring and writing outreach: ${p.done} of ${p.total}`;
    const pct = p.phase === "enriching" && p.total > 0 ? Math.round((p.done / p.total) * 100) : 8;
    return (
      <div className="mb-5">
        <p className="mb-2 text-sm">{label}</p>
        <div className="h-1.5 overflow-hidden rounded bg-wash" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-ink transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }
  if (p.status === "error") {
    return (
      <p role="alert" className="mb-5 rounded-md border border-danger/30 px-4 py-3 text-sm text-danger">
        {p.error}
      </p>
    );
  }
  if (p.status === "done" && p.error) {
    return <p className="mb-5 text-sm text-mute">Finished, with some issues: {p.error}</p>;
  }
  return null;
}

export function LeadsTable({ initial }: { initial: LeadsPayload }) {
  const [data, setData] = useState(initial);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/leads", { cache: "no-store" });
      if (res.ok && alive.current) setData((await res.json()) as LeadsPayload);
    } catch {
      /* keep showing the last data; the next poll retries */
    }
  }, []);

  const running = data.pipeline.status === "running";
  useEffect(() => {
    alive.current = true;
    const t = setInterval(refresh, running ? POLL_RUNNING_MS : POLL_IDLE_MS);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [running, refresh]);

  return (
    <>
      <Progress p={data.pipeline} />
      {data.leads.length === 0 ? (
        <p className="text-mute">{running ? "Leads will appear here as they are found." : "No leads yet."}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-line bg-wash text-caption text-mute">
              <tr>
                <th className="w-10 px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Lead</th>
                <th className="w-24 px-3 py-2 font-medium">Fit</th>
                <th className="w-64 px-3 py-2 font-medium">Why</th>
                <th className="w-80 px-3 py-2 font-medium">Outreach</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.leads.map((l, i) => (
                <tr key={l.id} className="animate-fade-in align-top">
                  <td className="tnum px-3 py-3 text-mute">{i + 1}</td>
                  <td className="px-3 py-3">
                    <Link href={`/prospects/${l.id}`} className="font-medium hover:underline">
                      {l.name}
                    </Link>
                    {l.company && l.company !== l.name ? <div className="text-mute">{l.company}</div> : null}
                    {l.website ? <div className="text-caption text-mute">{l.website.replace(/^https?:\/\//, "")}</div> : null}
                    {!l.email ? <div className="text-caption text-mute">no email yet</div> : null}
                  </td>
                  <td className="px-3 py-3">
                    {l.score !== null && l.tier && l.ratings ? (
                      <span title={breakdown(l.ratings)} className="tnum">
                        <Badge variant={l.tier === "A" ? "ink" : "default"}>{l.tier}</Badge>
                        <span className="ml-1.5">{l.score}</span>
                      </span>
                    ) : (
                      <span className="text-caption text-mute">Researching...</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-mute">{l.why || (l.score === null ? "" : "")}</td>
                  <td className="px-3 py-3">
                    {l.draft ? (
                      <div className="space-y-2">
                        <div>
                          <p className="font-medium">{l.draft.subject || "(no subject)"}</p>
                          <p className="line-clamp-3 whitespace-pre-line text-mute">{l.draft.body}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {l.draft.status === "draft" ? (
                            <form
                              action={async (fd) => {
                                await approveDraft(fd);
                                await refresh();
                              }}
                            >
                              <input type="hidden" name="id" value={l.draft.id} />
                              <Button type="submit" size="sm">
                                Approve
                              </Button>
                            </form>
                          ) : (
                            <Badge variant="done">{l.draft.status === "sent" ? "Sent" : "Approved"}</Badge>
                          )}
                          <Link href={`/prospects/${l.id}`} className="text-caption text-mute underline">
                            Review
                          </Link>
                        </div>
                      </div>
                    ) : l.score !== null ? (
                      <span className="text-caption text-mute">Writing outreach...</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
