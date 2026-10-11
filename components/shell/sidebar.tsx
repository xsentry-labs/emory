"use client";

import {
  Building2,
  Inbox,
  Lock,
  LogOut,
  MessagesSquare,
  PenLine,
  Search,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/auth/actions";
import { cn } from "@/lib/utils";

interface Item {
  href?: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  /** Not built yet: shown greyed with a "Soon" tag. */
  soon?: boolean;
  /** Visible but unavailable. */
  locked?: boolean;
}

export interface SidebarProps {
  email: string;
  pending: number;
  usage: { label: string; used: number; limit: number }[];
}

function sections(pending: number): { title: string; items: Item[] }[] {
  return [
    {
      title: "Growth",
      items: [
        { href: "/plays", label: "Plays", icon: Sparkles },
        { href: "/leads", label: "Leads", icon: Users },
        { href: "/approvals", label: "Approvals", icon: Inbox, badge: pending },
      ],
    },
    {
      title: "Marketing",
      items: [
        { href: "/seo", label: "SEO", icon: Search },
        { href: "/content", label: "Content", icon: PenLine },
        { href: "/reddit", label: "Reddit agent", icon: MessagesSquare, locked: true },
      ],
    },
  ];
}

function NavItem({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon;
  const body = (
    <>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge ? <span className="tnum rounded bg-ink px-1.5 py-0.5 text-caption text-paper">{item.badge}</span> : null}
      {item.soon ? <span className="text-caption text-mute">Soon</span> : null}
      {item.locked ? <Lock className="size-3.5 text-mute" aria-label="Locked" /> : null}
    </>
  );
  const cls = cn(
    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
    active ? "bg-paper font-medium text-ink shadow-card" : "text-mute hover:bg-paper/70 hover:text-ink",
    item.soon && "cursor-default opacity-60 hover:bg-transparent hover:text-mute",
  );
  return item.href && !item.soon ? (
    <Link href={item.href} className={cls} aria-current={active ? "page" : undefined}>
      {body}
    </Link>
  ) : (
    <div className={cls} aria-disabled>
      {body}
    </div>
  );
}

export function Sidebar({ email, pending, usage }: SidebarProps) {
  const pathname = usePathname();
  const isActive = (href?: string) => Boolean(href) && (pathname === href || pathname.startsWith(`${href}/`));
  const groups = sections(pending);
  const business: Item = { href: "/profile", label: "Your business", icon: Building2 };

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-62 flex-col border-r border-line bg-wash md:flex">
        <Link href="/plays" className="px-5 pb-4 pt-5 font-display text-h3 font-medium">
          Emory
        </Link>
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="label mb-1.5 px-2.5 uppercase tracking-wide">{g.title}</p>
              <div className="space-y-0.5">
                {g.items.map((item) => (
                  <NavItem key={item.label} item={item} active={isActive(item.href)} />
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="label mb-1.5 px-2.5 uppercase tracking-wide">Account</p>
            <NavItem item={business} active={isActive(business.href)} />
          </div>
        </nav>
        <div className="space-y-3 border-t border-line px-4 py-4">
          <div>
            <p className="label mb-1.5">Today&apos;s usage</p>
            <ul className="space-y-1.5">
              {usage.map((u) => (
                <li key={u.label}>
                  <div className="flex justify-between text-caption">
                    <span className="text-mute">{u.label}</span>
                    <span className="tnum">
                      {u.used}/{u.limit}
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded bg-line">
                    <div className="h-full bg-ink" style={{ width: `${Math.min(100, (u.used / u.limit) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <form action={logout} className="flex items-center justify-between gap-2">
            <span className="truncate text-caption text-mute" title={email}>
              {email}
            </span>
            <button type="submit" className="text-mute hover:text-ink" aria-label="Log out" title="Log out">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-10 border-b border-line bg-paper md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/plays" className="font-display text-h3 font-medium">
            Emory
          </Link>
          <form action={logout}>
            <button type="submit" className="text-sm text-mute underline">
              Log out
            </button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {[...groups.flatMap((g) => g.items), business].map((item) => (
            <div key={item.label} className="shrink-0">
              <NavItem item={item} active={isActive(item.href)} />
            </div>
          ))}
        </nav>
      </header>
    </>
  );
}
