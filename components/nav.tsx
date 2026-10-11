import Link from "next/link";
import { logout } from "@/app/auth/actions";
import { getAccount, getAccountsDb } from "@/lib/accounts";
import { listPendingApprovals } from "@/lib/repo";
import { currentUser, getDb } from "@/lib/request-db";

export function Nav() {
  const pending = listPendingApprovals(getDb()).length;
  const user = currentUser();
  const email = user ? getAccount(getAccountsDb(), user.userId)?.email : undefined;
  return (
    <nav className="border-b border-line">
      <div className="mx-auto flex h-14 max-w-shell items-center gap-6 px-4 md:px-8">
        <Link href="/" className="font-display text-h3 font-medium">
          Emory <span className="text-mute">Growth</span>
        </Link>
        <Link href="/leads" className="text-sm text-mute hover:text-ink">
          Leads
        </Link>
        <Link href="/approvals" className="text-sm text-mute hover:text-ink">
          Approvals
          {pending > 0 ? <span className="tnum ml-1.5 rounded bg-ink px-1.5 py-0.5 text-caption text-paper">{pending}</span> : null}
        </Link>
        <Link href="/profile" className="ml-auto text-sm text-mute hover:text-ink">
          Your business
        </Link>
        <form action={logout} className="flex items-center gap-3">
          {email ? <span className="hidden text-caption text-mute sm:inline">{email}</span> : null}
          <button type="submit" className="text-sm text-mute underline hover:text-ink">
            Log out
          </button>
        </form>
      </div>
    </nav>
  );
}
