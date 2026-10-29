import { cookies } from "next/headers";
import { Sidebar } from "@/components/shell/sidebar";
import { resendVerification } from "@/app/auth/actions";
import { isAdminEmail } from "@/lib/admin";
import { quotaSummary } from "@/lib/quota";
import { listPendingApprovals } from "@/lib/repo";
import { currentAccount, getDb } from "@/lib/request-db";
import { latestAudit } from "@/lib/seo/audit";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { todayView } from "@/lib/today";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const db = getDb();
  const account = currentAccount();
  const email = account?.email ?? "";
  const quota = quotaSummary(db);
  return (
    <div className="min-h-screen bg-paper">
      <Sidebar
        email={email}
        today={todayView(db).counts.all}
        pending={listPendingApprovals(db).length}
        siteScore={latestAudit(db)?.report?.score ?? null}
        plan={quota.plan.name}
        isAdmin={isAdminEmail(email)}
        theme={parseTheme(cookies().get(THEME_COOKIE)?.value)}
        usage={quota.items.map(({ label, used, limit }) => ({ label, used, limit }))}
      />
      <div className="md:pl-60">
        <main className="mx-auto max-w-shell px-4 pb-20 pt-9 md:px-11">
          {account && !account.email_verified_at ? (
            <form action={resendVerification} className="mb-6 flex flex-wrap items-center gap-3 border border-accent bg-accent-wash px-4 py-3 text-sm text-ink">
              <span className="flex-1">confirm your email ({account.email}) to invite your team and get account notices.</span>
              <button type="submit" className="font-mono text-xs underline underline-offset-4">
                send the link again
              </button>
            </form>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
