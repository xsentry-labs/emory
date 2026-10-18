"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SiteTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Site views" className="flex gap-[22px] overflow-x-auto">
      {tabs.map((t) => {
        const active = pathname === t.href;
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
