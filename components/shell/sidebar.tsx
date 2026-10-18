"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import type { Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface Item {
  href: string;
  label: string;
  /** A count that needs attention (solid accent chip). */
  badge?: number;
  /** A neutral figure, e.g. the site score. */
  figure?: string;
  /** Not built yet: shown greyed with a "soon" tag and not linked. */
  soon?: boolean;
}

export interface SidebarProps {
  email: string;
  today: number;
  pending: number;
  siteScore: number | null;
  plan: string;
  isAdmin?: boolean;
  theme: Theme;
  usage: { label: string; used: number; limit: number }[];
}

function items(p: SidebarProps): Item[] {
  return [
    { href: "/today", label: "today", badge: p.today },
    { href: "/site", label: "site", figure: p.siteScore === null ? undefined : String(p.siteScore) },
    { href: "/leads", label: "leads" },
    { href: "/accounts", label: "accounts", soon: true },
    { href: "/content", label: "social" },
    { href: "/approvals", label: "inbox", badge: p.pending },
    { href: "/site/results", label: "results" },
    { href: "/profile", label: "memory" },
    { href: "/audit", label: "audit", soon: true },
    ...(p.isAdmin ? [{ href: "/admin", label: "admin" }] : []),
  ];
}

function NavItem({ item, active }: { item: Item; active: boolean }) {
  const cls = cn(
    "flex h-10 items-center justify-between gap-2.5 px-3 font-mono text-sm transition-colors",
    active ? "bg-wash text-ink" : "text-mute hover:bg-wash hover:text-ink",
    item.soon && "cursor-default opacity-50 hover:bg-transparent hover:text-mute",
  );
  const body = (
    <>
      <span className="flex items-center gap-2.5">
        {active ? <span className="size-[9px] bg-accent" aria-hidden /> : null}
        {item.label}
      </span>
      {item.badge ? <span className="tnum bg-accent px-1.5 text-xs leading-5 text-accent-ink">{item.badge}</span> : null}
      {item.figure ? <span className="tnum text-xs">{item.figure}</span> : null}
      {item.soon ? <span className="text-xs">soon</span> : null}
    </>
  );
  return item.soon ? (
    <div className={cls} aria-disabled>
      {body}
    </div>
  ) : (
    <Link href={item.href} className={cls} aria-current={active ? "page" : undefined}>
      {body}
    </Link>
  );
}

function Usage({ plan, usage }: Pick<SidebarProps, "plan" | "usage">) {
  return (
    <div className="space-y-2 border border-dashed border-line px-3 py-3.5">
      <div className="flex items-center justify-between font-mono text-[13px] text-ink">
        <span>this month</span>
        <Link href="/pricing" className="text-xs text-mute underline-offset-4 hover:underline">
          {plan.toLowerCase()} plan
        </Link>
      </div>
      <ul className="space-y-1.5">
        {usage.map((u) => (
          <li key={u.label}>
            <div className="flex justify-between text-xs">
              <span>{u.label.toLowerCase()}</span>
              <span className="tnum">
                {u.used.toLocaleString("en-US")}/{u.limit.toLocaleString("en-US")}
              </span>
            </div>
            <div className="mt-1 h-1 bg-line">
              <div className="h-full bg-accent" style={{ width: `${Math.min(100, (u.used / Math.max(1, u.limit)) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  const pathname = usePathname();
  const nav = items(props);
  // The longest matching item wins, so /site/results lights "results", not "site".
  const best = nav
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  const isActive = (href: string) => href === best;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-dashed border-line bg-paper px-3 py-6 md:flex">
        <Link href="/today" className="px-3 pb-5 font-mono text-base tracking-[0.26em] text-ink">
          emory
        </Link>
        <nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto">
          {nav.map((item) => (
            <NavItem key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </nav>
        <Usage plan={props.plan} usage={props.usage} />
        <form action={logout} className="flex items-center gap-2.5 px-3 pt-4">
          <span aria-hidden className="flex size-8 shrink-0 items-center justify-center border border-line font-mono text-[13px] text-ink">
            {props.email.slice(0, 1) || "?"}
          </span>
          <span className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink" title={props.email}>
            {props.email}
          </span>
          <ThemeToggle initial={props.theme} className="size-8" />
          <button type="submit" className="inline-flex size-8 items-center justify-center text-mute hover:text-ink" aria-label="Log out" title="Log out">
            <LogOut className="size-4" aria-hidden />
          </button>
        </form>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-10 border-b border-dashed border-line bg-paper md:hidden">
        <div className="flex items-center justify-between px-4 py-2">
          <Link href="/today" className="font-mono text-base tracking-[0.26em] text-ink">
            emory
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle initial={props.theme} />
            <form action={logout}>
              <button type="submit" className="inline-flex size-9 items-center justify-center text-mute hover:text-ink" aria-label="Log out">
                <LogOut className="size-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
        <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-2">
          {nav
            .filter((item) => !item.soon)
            .map((item) => (
              <div key={item.href} className="shrink-0">
                <NavItem item={item} active={isActive(item.href)} />
              </div>
            ))}
        </nav>
      </header>
    </>
  );
}
