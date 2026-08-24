"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { queueSummary, useEmory } from "@/lib/store";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function MobileNav() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const actions = useEmory((state) => state.actions);
  const summary = queueSummary(actions);

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/97 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-6">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const badge =
            item.href === "/approvals" && hydrated && summary.queued > 0 ? summary.queued : null;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 px-1 py-3 text-caption transition-colors",
                  active ? "font-medium text-ink" : "text-mute",
                )}
              >
                {active ? <span className="absolute inset-x-4 top-0 h-0.5 bg-ink" /> : null}
                {item.short}
                {badge ? (
                  <span className="absolute right-1.5 top-1 min-w-4 rounded-full bg-ink px-1 text-[10px] leading-4 tabular-nums text-paper">
                    {badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
