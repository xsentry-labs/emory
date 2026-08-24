"use client";

import { useState } from "react";
import Link from "next/link";
import { AGENTS } from "@/lib/agents";
import { agentLoad, useEmory } from "@/lib/store";
import { useHydrated } from "@/hooks/use-hydrated";
import { PageHead } from "@/components/page-head";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Agent } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AgentsView() {
  const hydrated = useHydrated();
  const actions = useEmory((state) => state.actions);
  const connectors = useEmory((state) => state.connectors);
  const [open, setOpen] = useState<Agent | null>(null);

  const load = agentLoad(actions);
  const live = AGENTS.filter((agent) => agent.status === "live").length;

  return (
    <div>
      <PageHead
        title="Agents"
        standfirst={`Eleven agents, one brain. ${live} are live on your account; the rest show the month they activate. An agent never appears in your queue until it has passed its readiness standard.`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/connections">Connections</Link>
          </Button>
        }
      />

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {AGENTS.map((agent) => {
          const waiting = load[agent.id] ?? 0;
          const feeds = connectors.filter(
            (connector) => connector.feeds.includes(agent.id) && connector.connected,
          ).length;
          return (
            <li key={agent.id}>
              <button
                type="button"
                onClick={() => setOpen(agent)}
                className={cn(
                  "flex h-full w-full flex-col rounded-lg border border-line bg-paper p-5 text-left transition-colors hover:border-ink/30 hover:bg-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
                )}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: agent.hex }}
                  />
                  <span className="text-sm font-medium text-ink">{agent.name}</span>
                  <span className="ml-auto text-caption text-mute">
                    {agent.status === "live" ? "Live" : agent.activating}
                  </span>
                </span>
                <span className="mt-2 flex-1 text-body text-mute">{agent.line}</span>
                <span className="mt-4 flex items-center justify-between border-t border-line pt-3 text-caption text-mute">
                  <span>
                    {hydrated && agent.status === "live"
                      ? waiting > 0
                        ? `${waiting} waiting on you`
                        : "Nothing waiting"
                      : agent.status === "live"
                        ? " "
                        : "Not yet in your queue"}
                  </span>
                  <span>
                    {hydrated ? `${feeds} connection${feeds === 1 ? "" : "s"}` : " "}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <section className="mt-10 rounded-lg border border-line bg-wash p-6">
        <h2 className="font-display text-h2 font-medium text-ink">
          Why some of these say a month instead of a number
        </h2>
        <p className="mt-2 max-w-measure text-body text-mute">
          An agent only appears in your queue once it can be reviewed against real businesses, undo
          everything it does, explain itself to someone who is not a specialist, and fail visibly
          rather than silently. Until then it shows you when it arrives. Nothing here pretends to
          work.
        </p>
      </section>

      <Dialog open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent>
          {open ? (
            <>
              <DialogHeader>
                <span className="flex items-center gap-2 text-caption text-mute">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: open.hex }}
                  />
                  {open.status === "live" ? "Live on your account" : open.activating}
                </span>
                <DialogTitle>{open.name}</DialogTitle>
                <DialogDescription>{open.line}</DialogDescription>
              </DialogHeader>

              <div className="overflow-y-auto px-6 py-5">
                <h3 className="label">What it handles</h3>
                <ul className="mt-3 space-y-2">
                  {open.capabilities.map((capability) => (
                    <li key={capability} className="flex gap-2.5 text-body text-ink">
                      <span
                        aria-hidden
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: open.hex }}
                      />
                      {capability}
                    </li>
                  ))}
                </ul>

                <h3 className="label mt-8">On its own</h3>
                <ul className="mt-3 divide-y divide-line overflow-hidden rounded-md border border-line">
                  {open.tiers.map((tier) => (
                    <li key={tier.name} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-baseline sm:gap-4">
                      <span className="w-20 shrink-0 text-sm font-medium text-ink">{tier.name}</span>
                      <span className="w-20 shrink-0 text-sm tabular-nums text-ink">{tier.price}</span>
                      <span className="text-sm text-mute">{tier.includes}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-caption text-mute">Metered on: {open.metered}</p>
                <p className="mt-4 text-caption text-mute">
                  Included in Emory Complete at Growth tier. Two agents on their own cost $228; all
                  eleven cost $229.
                </p>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(null)}>
                  Close
                </Button>
                <Button asChild>
                  <Link href="/approvals">See what it has prepared</Link>
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
