"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Radio } from "lucide-react";
import { editionStats, useWire } from "@/lib/store";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn, editionDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { NAV_ITEMS } from "./nav-items";

export function Masthead() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const profile = useWire((state) => state.profile);
  const dispatches = useWire((state) => state.dispatches);
  const stats = editionStats(dispatches);
  const section = NAV_ITEMS.find((item) => item.href === pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-8 md:py-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/feed"
            className="shrink-0 rounded font-display text-2xl font-bold leading-none tracking-tighter text-ink md:hidden"
          >
            emory
          </Link>
          <div className="hidden min-w-0 md:block">
            <p className="font-mono text-2xs uppercase tracking-stamp text-slate">
              {editionDate()} · VOL. IV · NO. 231
            </p>
            <p className="mt-1 font-display text-xl font-semibold leading-none tracking-tight text-ink">
              {section?.label ?? "The Daily Growth Wire"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {hydrated && stats.urgent > 0 ? (
            <Link href="/feed?filter=pending" className="rounded-sm">
              <Badge variant="urgent" className="gap-1.5">
                <AlertTriangle className="h-3 w-3" />
                {stats.urgent} urgent
              </Badge>
            </Link>
          ) : null}
          <Link
            href="/profile"
            className={cn(
              "group flex items-center gap-2 rounded-md border border-line bg-card px-3 py-1.5 shadow-sheet transition-colors hover:border-ink/30",
            )}
          >
            <Radio className="h-3.5 w-3.5 shrink-0 animate-pulse-dot text-teletype-green" />
            <span className="font-mono text-2xs uppercase tracking-wire text-slate">
              Filing for:
            </span>
            <span className="max-w-[9rem] truncate font-mono text-2xs uppercase tracking-wire text-ink group-hover:underline">
              {hydrated ? profile.domain : "…"}
            </span>
          </Link>
        </div>
      </div>

      <TickerStrip />
    </header>
  );
}

function TickerStrip() {
  const hydrated = useHydrated();
  const profile = useWire((state) => state.profile);
  const dispatches = useWire((state) => state.dispatches);
  const stats = editionStats(dispatches);

  const items = hydrated
    ? [
        `${stats.pending} dispatches awaiting review`,
        `${stats.live} running on the wire`,
        `${stats.approved} approved, queued to publish`,
        `Beat: ${profile.vertical}`,
        `Voice: ${profile.voice.join(" · ")}`,
        `Goal: ${profile.goal}`,
        `${stats.spiked} spiked this edition`,
      ]
    : ["Desks connecting…"];

  const strip = [...items, ...items];

  return (
    <div className="relative overflow-hidden border-t border-line bg-ink/[0.03] py-1.5">
      <div className="flex w-max animate-ticker gap-8 pl-4 will-change-transform">
        {strip.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="flex shrink-0 items-center gap-8 font-mono text-2xs uppercase tracking-wire text-slate"
          >
            {item}
            <span aria-hidden className="text-line">
              ◆
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
