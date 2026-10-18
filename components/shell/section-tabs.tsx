"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SectionTabs({ tabs, label }: { tabs: { href: string; label: string }[]; label: string }) {
  const pathname = usePathname();
  // Longest matching tab wins, so /accounts/12 lights "accounts" but /site/fixes doesn't light "issues".
  const best = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav aria-label={label} className="flex gap-[22px] overflow-x-auto">
      {tabs.map((t) => {
        const active = t.href === best;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn("flex h-12 items-center whitespace-nowrap border-b-2 font-mono text-[13px] hover:text-ink", active ? "border-accent text-ink" : "border-transparent")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
