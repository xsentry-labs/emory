"use client";

import { useState } from "react";
import Link from "next/link";
import { AGENTS, AGENT_BY_ID } from "@/lib/agents";
import { GUARD_BLOCKS, hydrate } from "@/lib/mock-data";
import { queueSummary, useEmory } from "@/lib/store";
import { useHydrated } from "@/hooks/use-hydrated";
import { PageHead } from "@/components/page-head";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionCard } from "./action-card";
import { cn, whenShort } from "@/lib/utils";

type View = "waiting" | "done" | "declined";

export function ApprovalsView() {
  const hydrated = useHydrated();
  const actions = useEmory((state) => state.actions);
  const autonomy = useEmory((state) => state.autonomy);
  const demoteKind = useEmory((state) => state.demoteKind);
  const workspace = useEmory((state) => state.workspace);

  const [view, setView] = useState<View>("waiting");
  const [agentFilter, setAgentFilter] = useState<string>("all");

  const summary = queueSummary(actions);
  const blocks = hydrate(GUARD_BLOCKS, workspace.company, workspace.domain);

  const byView = actions.filter((action) => {
    if (view === "waiting") return action.status === "queued";
    if (view === "declined") return action.status === "declined";
    return action.status === "approved" || action.status === "executed";
  });

  const visible =
    agentFilter === "all"
      ? byView
      : byView.filter((action) => action.agentId === agentFilter);

  const agentsInQueue = AGENTS.filter((agent) =>
    actions.some((action) => action.agentId === agent.id),
  );

  const promoted = Object.entries(autonomy).filter(([, on]) => on);

  return (
    <div>
      <PageHead
        title="Approvals"
        standfirst={
          hydrated
            ? summary.queued > 0
              ? `${summary.queued} things are waiting on you. Emory has prepared each one — what it will do, why, and what it expects to happen.`
              : "Nothing needs your approval. Emory is working."
            : undefined
        }
        actions={
          <Button variant="outline" asChild>
            <Link href="/agents">See what each agent does</Link>
          </Button>
        }
      />

      {!hydrated ? null : (
        <>
          <div className="mb-6 flex flex-col gap-4">
            <Tabs value={view} onValueChange={(value) => setView(value as View)}>
              <TabsList>
                <TabsTrigger value="waiting">
                  Waiting on you
                  <span className="tabular-nums text-mute">{summary.queued}</span>
                </TabsTrigger>
                <TabsTrigger value="done">
                  Done
                  <span className="tabular-nums text-mute">{summary.done}</span>
                </TabsTrigger>
                <TabsTrigger value="declined">
                  Declined
                  <span className="tabular-nums text-mute">{summary.declined}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setAgentFilter("all")}
                className={cn(
                  "rounded border px-2 py-1 text-caption transition-colors",
                  agentFilter === "all"
                    ? "border-ink bg-ink text-paper"
                    : "border-line text-mute hover:border-ink/30 hover:text-ink",
                )}
              >
                All agents
              </button>
              {agentsInQueue.map((agent) => {
                const active = agentFilter === agent.id;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setAgentFilter(active ? "all" : agent.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded border px-2 py-1 text-caption transition-colors",
                      active
                        ? "border-ink bg-ink text-paper"
                        : "border-line text-mute hover:border-ink/30 hover:text-ink",
                    )}
                  >
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: agent.hex }}
                    />
                    {agent.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="min-w-0 space-y-3">
              {visible.length === 0 ? (
                <div className="rounded-lg border border-line px-6 py-16 text-center">
                  <p className="font-display text-h2 font-medium text-ink">
                    {view === "waiting"
                      ? "Nothing needs your approval. Emory is working."
                      : view === "done"
                        ? "Nothing has run yet."
                        : "You have not declined anything."}
                  </p>
                  <p className="mx-auto mt-2 max-w-measure text-body text-mute">
                    {view === "waiting"
                      ? "The agents keep working in the background. Anything that needs a decision will appear here."
                      : "Approve something and it will show up here, with an undo beside it."}
                  </p>
                </div>
              ) : (
                visible.map((action) => <ActionCard key={action.id} action={action} />)
              )}
            </div>

            <aside className="space-y-4">
              <section className="rounded-lg border border-line p-5">
                <h2 className="text-sm font-medium text-ink">How much Emory decides alone</h2>
                <p className="mt-2 text-caption text-mute">
                  Granted one kind of work at a time, and only for low-risk changes. Everything stays
                  reversible.
                </p>
                {promoted.length === 0 ? (
                  <p className="mt-4 text-caption text-mute">
                    Nothing yet. Emory asks about everything.
                  </p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {promoted.map(([kind]) => {
                      const example = actions.find((action) => action.kind === kind);
                      return (
                        <li key={kind} className="flex items-center justify-between gap-2">
                          <span className="text-caption text-ink">
                            {example?.kindLabel ?? kind}
                          </span>
                          <button
                            type="button"
                            onClick={() => demoteKind(kind)}
                            className="rounded text-caption text-mute underline-offset-4 hover:text-ink hover:underline"
                          >
                            Ask me again
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="rounded-lg border border-line p-5">
                <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full"
                    style={{ background: AGENT_BY_ID.guard.hex }}
                  />
                  What Guard stopped
                </h2>
                <ul className="mt-4 space-y-4">
                  {blocks.map((block) => (
                    <li key={block.id}>
                      <p className="text-caption text-mute">{whenShort(block.at)}</p>
                      <p className="mt-1 text-sm text-ink">{block.stopped}</p>
                      <p className="mt-1 text-caption text-mute">{block.reason}</p>
                      <p className="mt-1.5 text-caption text-ink">{block.replacement}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-caption text-mute">
                  Guard runs before anything is written, not after. It is included with every agent
                  and cannot be switched off.
                </p>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
