"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useHydrated } from "@/hooks/use-hydrated";
import { DESKS } from "@/lib/mock-data";
import { editionStats, useWire } from "@/lib/store";
import type { DeskId, Dispatch, DispatchStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DispatchCard } from "./dispatch-card";
import { EditDraftSheet } from "./edit-draft-sheet";
import { EditionRail } from "./edition-rail";

type FilterKey = "all" | "pending" | "approved" | "live";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending review" },
  { key: "approved", label: "Approved" },
  { key: "live", label: "Live" },
];

const EMPTY_COPY: Record<FilterKey, { head: string; body: string }> = {
  all: {
    head: "No dispatches yet.",
    body: "Desks file within minutes of connecting a site. Leave the wire open — the first sweep is already running.",
  },
  pending: {
    head: "Nothing waiting on you.",
    body: "Every filing has been read. The desks keep working; the next batch lands after the evening sweep.",
  },
  approved: {
    head: "Nothing cleared yet.",
    body: "Approve a dispatch and it waits here until you push it to the wire.",
  },
  live: {
    head: "Nothing running yet.",
    body: "Push an approved dispatch to the wire and the desk will start reporting back on how it lands.",
  },
};

export function FeedView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const hydrated = useHydrated();

  const dispatches = useWire((state) => state.dispatches);
  const profile = useWire((state) => state.profile);

  const filter = (params.get("filter") as FilterKey) || "all";
  const deskParam = params.get("desk") as DeskId | null;
  const focusId = params.get("dispatch");

  const [editing, setEditing] = useState<Dispatch | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (!value || value === "all") next.delete(key);
      else next.set(key, value);
      router.replace(next.toString() ? `${pathname}?${next}` : pathname, {
        scroll: false,
      });
    },
    [params, pathname, router],
  );

  // Deep links from the audit desk land on a specific filing.
  useEffect(() => {
    if (!focusId || !hydrated) return;
    setHighlight(focusId);
    const node = document.getElementById(`dispatch-${focusId}`);
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timer = window.setTimeout(() => {
      setHighlight(null);
      setParam("dispatch", null);
    }, 3_600);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, hydrated]);

  const stats = editionStats(dispatches);

  const visible = useMemo(() => {
    const byStatus = dispatches.filter((dispatch) => {
      if (dispatch.status === "spiked") return false;
      if (filter === "all") return true;
      return dispatch.status === (filter as DispatchStatus);
    });
    const byDesk = deskParam
      ? byStatus.filter((dispatch) => dispatch.deskId === deskParam)
      : byStatus;
    return [...byDesk].sort(
      (a, b) => new Date(b.filedAt).getTime() - new Date(a.filedAt).getTime(),
    );
  }, [dispatches, filter, deskParam]);

  const counts: Record<FilterKey, number> = {
    all: stats.filed,
    pending: stats.pending,
    approved: stats.approved,
    live: stats.live,
  };

  const activeDesk = DESKS.find((desk) => desk.id === deskParam);
  const empty = EMPTY_COPY[filter];

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        kicker={`The wire · filing for ${hydrated ? profile.domain : "your site"}`}
        title="The Feed"
        standfirst={
          hydrated && stats.pending > 0
            ? `${stats.pending} dispatches are waiting on your desk, ${stats.urgent} of them stamped urgent. Approve, edit or spike — nothing runs until you say so.`
            : "Every filing has been read. The desks stay on the beat and will wake you when something moves."
        }
        actions={
          <Button variant="outline" asChild>
            <a href="/seo">Open the audit desk</a>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <div className="mb-6 flex flex-col gap-4">
            <Tabs value={filter} onValueChange={(value) => setParam("filter", value)}>
              <TabsList className="w-full justify-start sm:w-auto">
                {FILTERS.map((item) => (
                  <TabsTrigger key={item.key} value={item.key}>
                    {item.label}
                    <span
                      className={cn(
                        "rounded-sm px-1 font-mono text-2xs tabular-nums",
                        filter === item.key ? "bg-paper/20" : "bg-ink/[0.06]",
                      )}
                    >
                      {hydrated ? counts[item.key] : "–"}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 font-mono text-2xs uppercase tracking-wire text-slate">
                Desks:
              </span>
              <button
                type="button"
                onClick={() => setParam("desk", null)}
                className={cn(
                  "rounded-sm border px-2 py-1 font-mono text-2xs uppercase tracking-wire transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
                  !deskParam
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-card text-slate hover:border-ink/30 hover:text-ink",
                )}
              >
                All
              </button>
              {DESKS.map((desk) => {
                const active = deskParam === desk.id;
                return (
                  <button
                    key={desk.id}
                    type="button"
                    onClick={() => setParam("desk", active ? null : desk.id)}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-2xs uppercase tracking-wire transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
                      active
                        ? "border-ink bg-ink text-paper"
                        : "border-line bg-card text-slate hover:border-ink/30 hover:text-ink",
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", desk.dot)} />
                    {desk.name}
                  </button>
                );
              })}
            </div>
          </div>

          {!hydrated ? (
            <LoadingWire />
          ) : visible.length === 0 ? (
            <EmptyWire
              head={activeDesk ? `The ${activeDesk.name} desk is quiet.` : empty.head}
              body={
                activeDesk
                  ? `Nothing filed under this tab from ${activeDesk.tag.toLowerCase()}. ${activeDesk.beat}`
                  : empty.body
              }
              onClear={
                activeDesk || filter !== "all"
                  ? () => {
                      setParam("desk", null);
                      setParam("filter", "all");
                    }
                  : undefined
              }
            />
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout" initial={false}>
                {visible.map((dispatch, index) => (
                  <div key={dispatch.id} id={`dispatch-${dispatch.id}`}>
                    <DispatchCard
                      dispatch={dispatch}
                      index={index}
                      highlighted={highlight === dispatch.id}
                      onEdit={setEditing}
                    />
                  </div>
                ))}
              </AnimatePresence>

              <p className="pt-2 text-center font-mono text-2xs uppercase tracking-stamp text-slate">
                — End of edition · desks file again after the evening sweep —
              </p>
            </div>
          )}
        </div>

        <div className="xl:sticky xl:top-28 xl:self-start">
          {hydrated ? <EditionRail dispatches={dispatches} /> : null}
        </div>
      </div>

      <EditDraftSheet
        dispatch={editing}
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </div>
  );
}

function LoadingWire() {
  return (
    <div className="space-y-4" aria-live="polite">
      <p className="font-mono text-2xs uppercase tracking-stamp text-slate">
        Teletype warming up · pulling today&apos;s filings
      </p>
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="sheet animate-pulse space-y-3 p-6"
          style={{ animationDelay: `${row * 120}ms` }}
        >
          <div className="h-2 w-32 rounded-full bg-line/80" />
          <div className="h-6 w-3/4 rounded bg-line/60" />
          <div className="h-3 w-full rounded bg-line/40" />
          <div className="h-3 w-5/6 rounded bg-line/40" />
        </div>
      ))}
    </div>
  );
}

function EmptyWire({
  head,
  body,
  onClear,
}: {
  head: string;
  body: string;
  onClear?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sheet flex flex-col items-center px-6 py-16 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-paper/60">
        <Inbox className="h-5 w-5 text-slate" />
      </span>
      <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink">
        {head}
      </h2>
      <p className="mt-3 max-w-md font-display text-lg leading-relaxed text-ink-soft">
        {body}
      </p>
      {onClear ? (
        <Button variant="outline" className="mt-6" onClick={onClear}>
          Show the whole edition
        </Button>
      ) : null}
    </motion.div>
  );
}
