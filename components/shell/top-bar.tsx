"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plug } from "lucide-react";
import { queueSummary, useEmory } from "@/lib/store";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function TopBar() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const workspace = useEmory((state) => state.workspace);
  const connectors = useEmory((state) => state.connectors);
  const actions = useEmory((state) => state.actions);
  const summary = queueSummary(actions);

  const section = NAV_ITEMS.find((item) => pathname.startsWith(item.href));
  const needsAttention = connectors.filter(
    (connector) => connector.connected && connector.health === "expiring",
  ).length;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
      <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/today" className="font-display text-h3 font-semibold text-ink md:hidden">
            Emory
          </Link>
          <span className="hidden text-sm font-medium text-ink md:inline">
            {section?.label ?? "Emory"}
          </span>
          {hydrated ? (
            <span className="hidden truncate text-caption text-mute md:inline">
              · {workspace.domain}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {hydrated && needsAttention > 0 ? (
            <Link
              href="/connections"
              className="hidden items-center gap-1.5 rounded border border-line px-2 py-1 text-caption text-mute transition-colors hover:border-ink/30 hover:text-ink sm:inline-flex"
            >
              <Plug className="h-3 w-3" />
              {needsAttention} connection needs attention
            </Link>
          ) : null}
          <Link
            href="/approvals"
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-caption font-medium transition-colors",
              hydrated && summary.queued > 0
                ? "bg-ink text-paper hover:bg-ink/88"
                : "border border-line text-mute hover:text-ink",
            )}
          >
            {hydrated
              ? summary.queued > 0
                ? `${summary.queued} waiting on you`
                : "Nothing to approve"
              : " "}
          </Link>
        </div>
      </div>
    </header>
  );
}
