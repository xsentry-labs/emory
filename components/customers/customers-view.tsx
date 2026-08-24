"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PEOPLE, TIMELINE, hydrate } from "@/lib/mock-data";
import { useEmory } from "@/lib/store";
import { useHydrated } from "@/hooks/use-hydrated";
import { PageHead } from "@/components/page-head";
import { AgentChip } from "@/components/agent-chip";
import { Button } from "@/components/ui/button";
import type { PersonStatus } from "@/lib/types";
import { cn, money, whenLong, whenShort } from "@/lib/utils";

const STATUS_LABEL: Record<PersonStatus, string> = {
  new: "Just arrived",
  qualified: "Worth your time",
  customer: "Paying",
  stalled: "Gone quiet",
};

export function CustomersView() {
  const hydrated = useHydrated();
  const workspace = useEmory((state) => state.workspace);
  const [selected, setSelected] = useState<string>("p-dana");
  const [filter, setFilter] = useState<PersonStatus | "all">("all");

  const people = useMemo(
    () => hydrate(PEOPLE, workspace.company, workspace.domain),
    [workspace.company, workspace.domain],
  );
  const timeline = useMemo(
    () => hydrate(TIMELINE, workspace.company, workspace.domain),
    [workspace.company, workspace.domain],
  );

  const visible = filter === "all" ? people : people.filter((p) => p.status === filter);
  const chosen = people.find((p) => p.id === selected) ?? null;
  // On a phone the list and the record are two screens; on a desktop both show.
  const person = chosen ?? people[0];
  const events = timeline
    .filter((event) => event.personId === person.id)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  if (!hydrated) return null;

  return (
    <div>
      <PageHead
        title="Customers"
        standfirst="One person, one scroll. Where they came from, everything they asked, and what it turned into — assembled from channels that normally sit in five separate products."
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {(["all", "new", "qualified", "customer", "stalled"] as const).map((key) => {
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(key)}
              className={cn(
                "rounded border px-2.5 py-1 text-caption transition-colors",
                active
                  ? "border-ink bg-ink text-paper"
                  : "border-line text-mute hover:border-ink/30 hover:text-ink",
              )}
            >
              {key === "all" ? "Everyone" : STATUS_LABEL[key]}
              <span className="ml-1.5 tabular-nums opacity-70">
                {key === "all" ? people.length : people.filter((p) => p.status === key).length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <ul className={cn("space-y-2", chosen && "hidden lg:block")}>
          {visible.map((row) => {
            const active = row.id === person.id;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelected(row.id)}
                  className={cn(
                    "w-full rounded-lg border p-4 text-left transition-colors",
                    active
                      ? "border-ink bg-wash"
                      : "border-line hover:border-ink/30 hover:bg-wash",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{row.name}</span>
                    <span className="text-caption tabular-nums text-mute">{money(row.value)}</span>
                  </span>
                  <span className="mt-0.5 block text-caption text-mute">
                    {row.role}, {row.company}
                  </span>
                  <span className="mt-2 flex items-center justify-between gap-2 text-caption text-mute">
                    <span>{STATUS_LABEL[row.status]}</span>
                    <span>{whenShort(row.lastTouch)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <section className={cn("min-w-0", !chosen && "hidden lg:block")}>
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 lg:hidden"
            onClick={() => setSelected("")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All people
          </Button>

          <div className="rounded-lg border border-line">
            <header className="border-b border-line p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h2 className="font-display text-h2 font-medium text-ink">{person.name}</h2>
                  <p className="mt-0.5 text-sm text-mute">
                    {person.role}, {person.company}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums text-ink">{money(person.value)}</p>
                  <p className="text-caption text-mute">{STATUS_LABEL[person.status]}</p>
                </div>
              </div>
              <p className="mt-3 max-w-measure text-body text-ink">{person.summary}</p>
              <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-caption text-mute">
                <div>
                  <dt className="inline">First seen: </dt>
                  <dd className="inline text-ink">{whenLong(person.firstSeen)}</dd>
                </div>
                <div>
                  <dt className="inline">Arrived from: </dt>
                  <dd className="inline text-ink">{person.arrivedFrom}</dd>
                </div>
                <div>
                  <dt className="inline">Score: </dt>
                  <dd className="inline tabular-nums text-ink">{person.score}</dd>
                </div>
              </dl>
            </header>

            <ol className="divide-y divide-line">
              {events.map((event) => {
                return (
                  <li key={event.id} className="flex gap-4 p-5">
                    <span className="flex w-32 shrink-0 flex-col gap-1">
                      <span className="text-caption text-mute">{whenLong(event.at)}</span>
                      <AgentChip id={event.agentId} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body text-ink">{event.title}</span>
                      <span className="mt-1 block max-w-measure text-sm text-mute">
                        {event.detail}
                      </span>
                      <span className="mt-1.5 block text-caption text-mute">{event.channel}</span>
                    </span>
                    {event.value ? (
                      <span className="shrink-0 text-caption font-medium tabular-nums text-ink">
                        {event.value}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>

            <footer className="border-t border-line bg-wash p-5">
              <p className="max-w-measure text-sm text-mute">
                Every row above came from a different place — an assistant answer, your website, chat,
                your CRM, a call, a payment. Emory holds them as one person because it is one brain,
                not eleven products.{" "}
                <Link href="/revenue" className="text-ink underline-offset-4 hover:underline">
                  See what it added up to
                </Link>
                .
              </p>
            </footer>
          </div>
        </section>
      </div>
    </div>
  );
}
