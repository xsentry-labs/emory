"use client";

import { useState } from "react";
import { AGENT_BY_ID } from "@/lib/agents";
import { EXPERIMENTS, PROOF_LINES, REVENUE_SOURCES } from "@/lib/mock-data";
import { useEmory } from "@/lib/store";
import { useHydrated } from "@/hooks/use-hydrated";
import { PageHead } from "@/components/page-head";
import { MetricBlock } from "@/components/metric-block";
import { AgentChip } from "@/components/agent-chip";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { money } from "@/lib/utils";

export function RevenueView() {
  const hydrated = useHydrated();
  const workspace = useEmory((state) => state.workspace);
  const [view, setView] = useState<"where" | "proof">("where");

  const total = REVENUE_SOURCES.reduce((sum, source) => sum + source.revenue, 0);
  const leads = REVENUE_SOURCES.reduce((sum, source) => sum + source.leads, 0);
  const invisible = REVENUE_SOURCES.filter((source) => source.reclassified).reduce(
    (sum, source) => sum + source.revenue,
    0,
  );

  if (!hydrated) return null;

  return (
    <div>
      <PageHead
        title="Revenue"
        standfirst="Clicks stopped telling the truth, so this is not a click report. It is one number, how it was arrived at, and what it would have cost you to buy the same work separately."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              toast({
                title: "Proof report sent",
                description: "A copy is on its way to you and anyone else on the account.",
              })
            }
          >
            Send this month&apos;s report
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
        <div className="bg-paper p-5">
          <MetricBlock label="Revenue, last 30 days" value={money(total)} direction="up" note="Booked and paid" />
        </div>
        <div className="bg-paper p-5">
          <MetricBlock label="Leads" value={String(leads)} direction="up" note="Across every channel" />
        </div>
        <div className="bg-paper p-5">
          <MetricBlock
            label="You could not previously see"
            value={money(invisible)}
            note="Arrived from AI assistants with no trail"
          />
        </div>
        <div className="bg-paper p-5">
          <MetricBlock label="Spend producing nothing" value="$2,000" direction="down" note="Found by holding it back and measuring" />
        </div>
      </section>

      <Tabs value={view} onValueChange={(value) => setView(value as "where" | "proof")} className="my-8">
        <TabsList>
          <TabsTrigger value="where">Where it came from</TabsTrigger>
          <TabsTrigger value="proof">The Proof report</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "where" ? (
        <div className="space-y-10">
          <section>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[38rem] text-left">
                <thead>
                  <tr className="border-b border-line">
                    {["Channel", "Revenue", "Leads", "What Emory knows about it"].map((head) => (
                      <th key={head} scope="col" className="px-5 py-3 text-caption font-medium text-mute">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {REVENUE_SOURCES.map((source) => (
                    <tr key={source.id} className="border-b border-line last:border-0">
                      <th scope="row" className="px-5 py-4 text-left align-top">
                        <span className="text-sm font-medium text-ink">{source.label}</span>
                        {source.reclassified ? (
                          <span className="mt-1 block text-caption text-mute">
                            Analytics called this Direct
                          </span>
                        ) : null}
                      </th>
                      <td className="px-5 py-4 align-top">
                        <span className="text-sm tabular-nums text-ink">{money(source.revenue)}</span>
                        <span className="mt-1 block h-1 w-24 overflow-hidden rounded-full bg-line">
                          <span
                            className="block h-full rounded-full bg-ink"
                            style={{ width: `${(source.revenue / total) * 100}%` }}
                          />
                        </span>
                      </td>
                      <td className="px-5 py-4 align-top text-sm tabular-nums text-mute">
                        {source.leads}
                      </td>
                      <td className="max-w-sm px-5 py-4 align-top text-sm text-mute">{source.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 max-w-measure text-caption text-mute">
              Most of what arrives from an AI assistant carries no referrer at all, which is why every
              analytics tool files it as Direct. Emory identifies it on the way in, then confirms it by
              experiment rather than by trusting a click.
            </p>
          </section>

          <section>
            <h2 className="font-display text-h2 font-medium text-ink">
              How Emory knows, rather than guesses
            </h2>
            <ul className="mt-4 space-y-3">
              {EXPERIMENTS.map((experiment) => (
                <li key={experiment.id} className="flex gap-4 rounded-lg border border-line p-5">
                  <span
                    aria-hidden
                    className="w-[3px] shrink-0 rounded-full"
                    style={{ background: AGENT_BY_ID[experiment.agentId].hex }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-medium text-ink">{experiment.name}</p>
                    <p className="mt-1 text-sm text-mute">{experiment.method}</p>
                    <p className="mt-2 text-sm text-ink">{experiment.reading}</p>
                  </div>
                  <span className="shrink-0 text-caption text-mute">{experiment.confidence}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <section>
          <div className="rounded-lg border border-line">
            <header className="border-b border-line p-6">
              <h2 className="font-display text-h2 font-medium text-ink">
                Here&apos;s what Emory did last month, and what it produced.
              </h2>
              <p className="mt-2 text-sm text-mute">
                {workspace.company} · {workspace.domain} · generated on the first of the month, for
                you and anyone else on the account.
              </p>
            </header>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left">
                <thead>
                  <tr className="border-b border-line">
                    {["", "What Emory did", "What it produced", "What it would have cost separately"].map(
                      (head) => (
                        <th key={head} scope="col" className="px-5 py-3 text-caption font-medium text-mute">
                          {head}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {PROOF_LINES.map((line) => (
                    <tr key={line.label} className="border-b border-line last:border-0">
                      <th scope="row" className="px-5 py-4 text-left align-top text-sm font-medium text-ink">
                        {line.label}
                      </th>
                      <td className="max-w-xs px-5 py-4 align-top text-sm text-mute">{line.did}</td>
                      <td className="max-w-xs px-5 py-4 align-top text-sm text-ink">{line.produced}</td>
                      <td className="max-w-xs px-5 py-4 align-top text-sm text-mute">{line.separately}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="border-t border-line bg-wash p-6">
              <p className="max-w-measure text-body text-ink">
                {workspace.plan}. The work above, bought as people and tools, was costing $5,859 a
                month before Emory — and nobody was doing the last two rows at all.
              </p>
            </footer>
          </div>
        </section>
      )}
    </div>
  );
}
