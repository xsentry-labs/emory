"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AGENTS } from "@/lib/agents";
import { queueSummary, useEmory } from "@/lib/store";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function SideNav() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const actions = useEmory((state) => state.actions);
  const workspace = useEmory((state) => state.workspace);
  const summary = queueSummary(actions);

  const live = AGENTS.filter((agent) => agent.status === "live").length;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-62 flex-col border-r border-line bg-paper md:flex">
      <div className="px-6 py-6">
        <Link href="/today" className="block rounded font-display text-h3 font-semibold text-ink">
          Emory
        </Link>
        <p className="mt-1 truncate text-caption text-mute">
          {hydrated ? workspace.domain : " "}
        </p>
      </div>

      <nav className="px-3" aria-label="Main">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            const badge =
              item.href === "/approvals" && hydrated && summary.queued > 0
                ? summary.queued
                : null;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active ? "bg-wash font-medium text-ink" : "text-mute hover:bg-wash hover:text-ink",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-ink" : "bg-transparent")}
                  />
                  <span className="flex-1">{item.label}</span>
                  {badge ? (
                    <span className="rounded bg-ink px-1.5 py-0.5 text-caption font-medium tabular-nums text-paper">
                      {badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto px-6 py-6">
        <div className="rule mb-4" />
        <p className="text-caption text-mute">
          {hydrated ? `${live} of ${AGENTS.length} agents live` : " "}
        </p>
        <p className="mt-1 text-caption text-mute">
          {hydrated ? workspace.plan : " "}
        </p>
        <Link
          href="/connections"
          className={cn(
            "mt-4 inline-flex rounded text-caption underline-offset-4 hover:underline",
            pathname.startsWith("/connections") ? "text-ink" : "text-mute hover:text-ink",
          )}
        >
          Connections
        </Link>
      </div>
    </aside>
  );
}
