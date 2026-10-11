import { Sidebar } from "@/components/shell/sidebar";
import { getAccount, getAccountsDb } from "@/lib/accounts";
import { listPendingApprovals } from "@/lib/repo";
import { currentUser, getDb } from "@/lib/request-db";
import { usageSummary } from "@/lib/usage";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const db = getDb();
  const user = currentUser();
  const email = (user && getAccount(getAccountsDb(), user.userId)?.email) || "";
  return (
    <div className="min-h-screen bg-paper">
      <Sidebar
        email={email}
        pending={listPendingApprovals(db).length}
        usage={usageSummary(db).map(({ label, used, limit }) => ({ label, used, limit }))}
      />
      <div className="md:pl-62">
        <main className="mx-auto max-w-shell px-4 pb-20 pt-8 md:px-10">{children}</main>
      </div>
    </div>
  );
}
