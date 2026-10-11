import Link from "next/link";
import { getDb } from "@/lib/db";
import { listPendingApprovals } from "@/lib/repo";

export function Nav() {
  const pending = listPendingApprovals(getDb()).length;
  return (
    <nav className="border-b border-line">
      <div className="mx-auto flex h-14 max-w-shell items-center gap-6 px-4 md:px-8">
        <Link href="/prospects" className="font-display text-h3 font-medium">
          Emory <span className="text-mute">Growth</span>
        </Link>
        <Link href="/prospects" className="text-sm text-mute hover:text-ink">
          Leads
        </Link>
        <Link href="/approvals" className="text-sm text-mute hover:text-ink">
          Approvals{pending > 0 ? <span className="tnum ml-1.5 rounded bg-ink px-1.5 py-0.5 text-caption text-paper">{pending}</span> : null}
        </Link>
        <Link href="/profile" className="ml-auto text-sm text-mute hover:text-ink">
          Offer &amp; ICP
        </Link>
      </div>
    </nav>
  );
}
