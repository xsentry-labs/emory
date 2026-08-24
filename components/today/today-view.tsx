"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AGENT_BY_ID } from "@/lib/agents";
import {
  OWNER_METRICS,
  SHIPPED_THIS_WEEK,
  WAITING_ON,
  hydrate,
} from "@/lib/mock-data";
import { queueSummary, queued, useEmory } from "@/lib/store";
import { useHydrated } from "@/hooks/use-hydrated";
import { MetricBlock } from "@/components/metric-block";
import { AgentChip } from "@/components/agent-chip";
import { Button } from "@/components/ui/button";
import { whenShort } from "@/lib/utils";

export function TodayView() {
  const hydrated = useHydrated();
  const actions = useEmory((state) => state.actions);
  const changes = useEmory((state) => state.changes);
  const workspace = useEmory((state) => state.workspace);
  const summary = queueSummary(actions);
  const open = queued(actions);
  const latestChange = changes[0];

  const shipped = hydrate(SHIPPED_THIS_WEEK, workspace.company, workspace.domain);

  if (!hydrated) return null;

  return (
    <div>
      <header className="mb-10">
        <h1 className="max-w-3xl font-display text-section font-medium leading-snug text-ink">
          {summary.queued > 0
            ? `Emory found ${summary.queued} opportunities this morning.`
            : "Nothing needs your approval. Emory is working."}
        </h1>
        <p className="mt-2 text-body text-mute">
          {summary.queued > 0
            ? `${summary.low} of them are low risk and can be handled without asking you.`
            : "Everything filed today has been dealt with. The agents stay on it."}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
        {OWNER_METRICS.map((metric) => (
          <div key={metric.id} className="bg-paper p-5">
            <MetricBlock
              label={metric.label}
              value={metric.value}
              direction={metric.direction}
              note={metric.note}
            />
          </div>
        ))}
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <section>
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-h2 font-medium text-ink">Waiting on you</h2>
              {summary.queued > 0 ? (
                <Button variant="quiet" asChild>
                  <Link href="/approvals">
                    See all {summary.queued}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : null}
            </div>
            <ul className="mt-4 space-y-2">
              {open.slice(0, 4).map((action) => {
                const agent = AGENT_BY_ID[action.agentId];
                return (
                  <li key={action.id}>
                    <Link
                      href="/approvals"
                      className="flex gap-4 rounded-lg border border-line p-4 transition-colors hover:border-ink/30 hover:bg-wash"
                    >
                      <span
                        aria-hidden
                        className="w-[3px] shrink-0 rounded-full"
                        style={{ background: agent.hex }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-body font-medium text-ink">{action.title}</span>
                        <span className="mt-1 block text-sm text-mute line-clamp-2">{action.why}</span>
                        <span className="mt-2 flex flex-wrap items-center gap-x-3 text-caption text-mute">
                          <AgentChip id={action.agentId} />
                          <span>
                            {action.impact.metric}: {action.impact.estimate}
                          </span>
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
              {open.length === 0 ? (
                <li className="rounded-lg border border-line px-5 py-10 text-center text-body text-mute">
                  Nothing needs your approval. Emory is working.
                </li>
              ) : null}
            </ul>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-h2 font-medium text-ink">What shipped this week</h2>
            <ul className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line">
              {shipped.map((item) => (
                <li key={item.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-baseline sm:gap-4">
                  <AgentChip id={item.agentId} className="w-24 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">{item.title}</span>
                    <span className="mt-0.5 block text-caption text-mute">{item.result}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-line p-5">
            <h2 className="text-sm font-medium text-ink">
              Emory updated your positioning. Here&apos;s what changed and why.
            </h2>
            {latestChange ? (
              <div className="mt-4">
                <p className="text-caption text-mute">
                  {whenShort(latestChange.at)} · {latestChange.field}
                </p>
                <p className="mt-2 text-sm text-mute line-through">{latestChange.before}</p>
                <p className="mt-1 text-sm text-ink">{latestChange.after}</p>
                <p className="mt-2 text-caption text-mute">{latestChange.why}</p>
              </div>
            ) : null}
            <Button variant="quiet" className="mt-4 px-0" asChild>
              <Link href="/brain?view=changes">
                See everything that changed
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </section>

          <section className="rounded-lg border border-line p-5">
            <h2 className="text-sm font-medium text-ink">Not yet in your queue</h2>
            <ul className="mt-4 space-y-4">
              {WAITING_ON.map((item) => (
                <li key={item.id}>
                  <AgentChip id={item.agentId} />
                  <p className="mt-1 text-sm text-ink">{item.title}</p>
                  <p className="mt-1 text-caption text-mute">{item.note}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-caption text-mute">
              An agent appears in your queue only once it has passed its readiness standard. Until
              then it shows the month it activates.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
