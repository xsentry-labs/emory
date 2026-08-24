"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { DESKS, SEO_ISSUES } from "@/lib/mock-data";
import { deskLoad, editionStats, useWire } from "@/lib/store";
import { useHydrated } from "@/hooks/use-hydrated";
import { relativeShort } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { DeskIcon } from "@/components/common/desk-icon";
import { NAV_ITEMS } from "./nav-items";

const TONE_DOT: Record<string, string> = {
  filed: "bg-slate",
  approved: "bg-teletype-green",
  live: "bg-teletype-green",
  spiked: "bg-wire-red",
  edited: "bg-desk-gold",
  system: "bg-line",
};

export function Sidebar() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const dispatches = useWire((state) => state.dispatches);
  const integrations = useWire((state) => state.integrations);
  const log = useWire((state) => state.log);

  const stats = editionStats(dispatches);
  const load = deskLoad(dispatches);
  const connected = integrations.filter((item) => item.connected).length;

  const badgeFor = (href: string) => {
    if (!hydrated) return null;
    if (href === "/feed" && stats.pending > 0) return String(stats.pending);
    if (href === "/seo") return `${SEO_ISSUES.filter((issue) => issue.severity === "critical").length} CRIT`;
    if (href === "/integrations") return `${connected}/${integrations.length}`;
    return null;
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-68 flex-col border-r border-line bg-paper/80 backdrop-blur md:flex">
      <div className="border-b border-line px-6 py-5">
        <Link href="/feed" className="block rounded focus-visible:outline-none">
          <span className="block font-display text-3xl font-bold leading-none tracking-tighter text-ink">
            emory
          </span>
          <span className="mt-2 block font-mono text-2xs uppercase tracking-stamp text-slate">
            The Daily Growth Wire
          </span>
        </Link>
      </div>

      <nav className="px-3 py-5" aria-label="Contents">
        <p className="px-3 pb-2 font-mono text-2xs uppercase tracking-stamp text-slate/80">
          Contents
        </p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const badge = badgeFor(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-baseline gap-3 rounded-md px-3 py-2 transition-colors",
                    active
                      ? "bg-ink text-paper"
                      : "text-ink hover:bg-ink/[0.05]",
                  )}
                >
                  <span
                    className={cn(
                      "font-mono text-2xs tabular-nums tracking-wire",
                      active ? "text-paper/60" : "text-slate/70",
                    )}
                  >
                    {item.index}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-semibold leading-tight tracking-tight">
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 block truncate text-xs",
                        active ? "text-paper/60" : "text-slate",
                      )}
                    >
                      {item.standfirst}
                    </span>
                  </span>
                  {badge ? (
                    <span
                      className={cn(
                        "shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-2xs tabular-nums tracking-wire",
                        active
                          ? "border-paper/30 text-paper"
                          : "border-line bg-card text-ink-soft group-hover:border-ink/25",
                      )}
                    >
                      {badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-line px-6 py-5">
        <p className="pb-3 font-mono text-2xs uppercase tracking-stamp text-slate/80">
          Desks on duty
        </p>
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
          {DESKS.map((desk) => (
            <li key={desk.id} className="flex items-center gap-2">
              <span className={cn("h-1.5 w-1.5 rounded-full", desk.dot)} />
              <span className="min-w-0 flex-1 truncate text-xs text-ink-soft">
                {desk.name}
              </span>
              <span className="font-mono text-2xs tabular-nums text-slate">
                {hydrated ? load[desk.id] ?? 0 : "–"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-line px-6 py-5">
        <p className="pb-3 font-mono text-2xs uppercase tracking-stamp text-slate/80">
          Off the wire
        </p>
        {hydrated ? (
          <ul className="space-y-3">
            {log.slice(0, 6).map((row, index) => (
              <motion.li
                key={row.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
                className="flex gap-2"
              >
                <span
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    TONE_DOT[row.tone] ?? "bg-line",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-xs leading-snug text-ink-soft">
                    {row.text}
                  </span>
                  <span className="mt-0.5 block font-mono text-2xs uppercase tracking-wire text-slate/70">
                    {relativeShort(row.at)} ago
                  </span>
                </span>
              </motion.li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate">Opening the wire…</p>
        )}
      </div>

      <div className="border-t border-line px-6 py-4">
        <p className="font-mono text-2xs uppercase tracking-wire text-slate">
          {hydrated ? `${stats.filed} filed · ${stats.spiked} spiked` : "Standing by"}
        </p>
      </div>
    </aside>
  );
}
