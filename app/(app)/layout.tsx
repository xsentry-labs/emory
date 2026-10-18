import { cookies } from "next/headers";
import { Sidebar } from "@/components/shell/sidebar";
import { getAccount, getAccountsDb } from "@/lib/accounts";
import { isAdminEmail } from "@/lib/admin";
import { quotaSummary } from "@/lib/quota";
import { listPendingApprovals } from "@/lib/repo";
import { currentUser, getDb } from "@/lib/request-db";
import { latestAudit } from "@/lib/seo/audit";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { todayView } from "@/lib/today";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const db = getDb();
  const user = currentUser();
  const email = (user && getAccount(getAccountsDb(), user.userId)?.email) || "";
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
        <main className="mx-auto max-w-shell px-4 pb-20 pt-9 md:px-11">{children}</main>
      </div>
    </div>
  );
}
