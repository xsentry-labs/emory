"use client";

import { motion } from "framer-motion";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { DESKS } from "@/lib/mock-data";
import { deskLoad, editionStats, useWire } from "@/lib/store";
import type { Dispatch } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EditionDate } from "@/components/common/edition-date";

export function EditionRail({ dispatches }: { dispatches: Dispatch[] }) {
  const restore = useWire((state) => state.restore);
  const stats = editionStats(dispatches);
  const load = deskLoad(dispatches);
  const cleared = stats.approved + stats.live;
  const clearedShare = stats.filed ? Math.round((cleared / stats.filed) * 100) : 0;

  function unspikeAll() {
    const spiked = dispatches.filter((item) => item.status === "spiked");
    spiked.forEach((item) => restore(item.id));
    toast({
      title: "Back in the queue",
      description: `${spiked.length} dispatch${spiked.length === 1 ? "" : "es"} pulled off the spike and returned to pending review.`,
    });
  }

  return (
    <aside className="space-y-4">
      <section className="sheet overflow-hidden">
        <header className="border-b border-line bg-paper/60 px-5 py-3">
          <p className="font-mono text-2xs uppercase tracking-stamp text-wire-red">
            Today&apos;s Edition
          </p>
          <p className="mt-1 font-mono text-2xs uppercase tracking-wire text-slate">
            <EditionDate />
          </p>
        </header>

        <div className="grid grid-cols-3 divide-x divide-line">
          {[
            { label: "Filed", value: stats.filed, tone: "text-ink" },
            { label: "Pending", value: stats.pending, tone: "text-wire-red" },
            { label: "Live", value: stats.live, tone: "text-teletype-green" },
          ].map((item) => (
            <div key={item.label} className="px-4 py-4 text-center">
              <motion.p
                key={`${item.label}-${item.value}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "font-mono text-4xl font-medium leading-none tabular-nums",
                  item.tone,
                )}
              >
                {item.value}
              </motion.p>
              <p className="mt-2 font-mono text-2xs uppercase tracking-wire text-slate">
                {item.label}
              </p>
            </div>
          ))}
        </div>

        <div className="border-t border-line px-5 py-4">
          <div className="flex items-baseline justify-between">
            <p className="wire-label">Cleared by you</p>
            <p className="font-mono text-2xs tabular-nums text-ink">{clearedShare}%</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/70">
            <motion.div
              className="h-full rounded-full bg-teletype-green"
              initial={{ width: 0 }}
              animate={{ width: `${clearedShare}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <p className="mt-2 text-xs leading-snug text-slate">
            {stats.pending === 0
              ? "Desk is clear. Every filing has been read."
              : `${stats.pending} still waiting on you · ${stats.urgent} stamped urgent`}
          </p>
        </div>

        {stats.spiked > 0 ? (
          <div className="border-t border-line bg-paper/40 px-5 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-2xs uppercase tracking-wire text-slate">
                {stats.spiked} spiked
              </p>
              <Button variant="quiet" size="wire" onClick={unspikeAll}>
                <Undo2 className="h-3 w-3" />
                Pull back
              </Button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="sheet overflow-hidden">
        <header className="border-b border-line bg-paper/60 px-5 py-3">
          <p className="font-mono text-2xs uppercase tracking-stamp text-slate">
            Filed by desk
          </p>
        </header>
        <ul className="divide-y divide-line/70">
          {DESKS.map((desk) => {
            const count = load[desk.id] ?? 0;
            const share = stats.filed ? (count / stats.filed) * 100 : 0;
            return (
              <li key={desk.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", desk.dot)} />
                <span className="w-24 shrink-0 truncate text-xs text-ink-soft">
                  {desk.name}
                </span>
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-line/60">
                  <motion.span
                    className={cn("block h-full rounded-full", desk.dot)}
                    initial={{ width: 0 }}
                    animate={{ width: `${share}%` }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  />
                </span>
                <span className="w-4 shrink-0 text-right font-mono text-2xs tabular-nums text-slate">
                  {count}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}
