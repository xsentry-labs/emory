"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { editionStats, useWire } from "@/lib/store";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import { DeskIcon } from "@/components/common/desk-icon";
import { NAV_ITEMS } from "./nav-items";

export function MobileNav() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const dispatches = useWire((state) => state.dispatches);
  const pending = editionStats(dispatches).pending;

  return (
    <nav
      aria-label="Contents"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 px-1 py-2.5 transition-colors",
                  active ? "text-ink" : "text-slate hover:text-ink",
                )}
              >
                {active ? (
                  <span className="absolute inset-x-3 top-0 h-0.5 bg-ink" />
                ) : null}
                <span className="relative">
                  <DeskIcon name={item.icon} className="h-4 w-4" />
                  {item.href === "/feed" && hydrated && pending > 0 ? (
                    <span className="absolute -right-2 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-wire-red px-1 font-mono text-[9px] leading-none text-white">
                      {pending}
                    </span>
                  ) : null}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wire">
                  {item.label.split(" ")[0]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
