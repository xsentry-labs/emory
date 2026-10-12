import { Sidebar } from "@/components/shell/sidebar";
import { getAccount, getAccountsDb } from "@/lib/accounts";
import { listPendingApprovals } from "@/lib/repo";
import { currentUser, getDb } from "@/lib/request-db";
import { isAdminEmail } from "@/lib/admin";
import { quotaSummary } from "@/lib/quota";

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
        pending={listPendingApprovals(db).length}
        plan={quota.plan.name}
        isAdmin={isAdminEmail(email)}
        usage={quota.items.map(({ label, used, limit }) => ({ label, used, limit }))}
      />
      <div className="md:pl-62">
        <main className="mx-auto max-w-shell px-4 pb-20 pt-8 md:px-10">{children}</main>
      </div>
    </div>
  );
}
