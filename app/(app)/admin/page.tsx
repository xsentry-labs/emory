import { notFound } from "next/navigation";
import { setWorkspacePlan } from "@/app/actions";
import { PageHead } from "@/components/page-head";
import { Button } from "@/components/ui/button";
import { getAccount, getAccountsDb, listWorkspaceSummaries } from "@/lib/accounts";
import { backupNow } from "@/app/actions";
import { isAdminEmail } from "@/lib/admin";
import { backupHealthy, backupStatus } from "@/lib/backup";
import { getWorkspaceDb } from "@/lib/db";
import { PLAN_LIST } from "@/lib/pricing";
import { planOf, usedThisMonth } from "@/lib/quota";
import { currentUser } from "@/lib/request-db";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const user = currentUser();
  const email = user ? getAccount(getAccountsDb(), user.userId)?.email : undefined;
  if (!isAdminEmail(email)) notFound();

  const backup = backupStatus();
  const rows = listWorkspaceSummaries(getAccountsDb()).map((w) => {
    const db = getWorkspaceDb(w.id);
    return { ...w, plan: planOf(db), leads: usedThisMonth(db, "leads"), seo: usedThisMonth(db, "seo"), ai: usedThisMonth(db, "ai") };
  });

  return (
    <>
      <PageHead title="Admin" standfirst="Workspaces and their plans. Paid plans are set by hand during early access." />
      <section aria-label="Backups" className="mb-8 flex flex-wrap items-center gap-4 border border-dashed border-line p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-mono text-xs text-ink">backups</span>
          <span className={backup.configured && backupHealthy() ? "text-sm" : "text-sm text-danger"}>
            {!backup.configured
              ? "OFF. Set BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID and BACKUP_S3_SECRET_ACCESS_KEY. Losing the volume would lose every workspace."
              : backup.lastError
                ? `Last attempt failed: ${backup.lastError}`
                : backup.lastOkAt
                  ? `Last snapshot ${new Date(backup.lastOkAt).toISOString().slice(0, 16).replace("T", " ")} UTC (${backup.lastStamp})${backup.encrypted ? ", encrypted" : ", NOT encrypted: set BACKUP_ENCRYPTION_KEY"}.`
                  : "Configured; the first snapshot runs a minute after start."}
          </span>
        </div>
        {backup.configured ? (
          <form action={backupNow}>
            <button type="submit" className="btn btn-quiet h-9" disabled={backup.running}>
              {backup.running ? "backing up…" : "back up now"}
            </button>
          </form>
        ) : null}
      </section>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="border-b border-line bg-wash text-caption text-mute">
            <tr>
              <th className="px-3 py-2 font-medium">Workspace</th>
              <th className="px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2 font-medium">Used this month</th>
              <th className="px-3 py-2 font-medium">Plan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-3">
                  <span className="font-medium">{r.name}</span> <span className="tnum text-caption text-mute">#{r.id}</span>
                </td>
                <td className="px-3 py-3 text-mute">{r.ownerEmail ?? "unclaimed"}</td>
                <td className="tnum px-3 py-3 text-mute">
                  {r.leads}/{r.plan.limits.leads} leads · {r.seo}/{r.plan.limits.seo} SEO · {r.ai}/{r.plan.limits.ai} AI
                </td>
                <td className="px-3 py-3">
                  <form action={setWorkspacePlan} className="flex items-center gap-2">
                    <input type="hidden" name="workspaceId" value={r.id} />
                    <select name="plan" defaultValue={r.plan.id} className="h-8 rounded-md border border-line bg-paper px-2 text-sm" aria-label={`Plan for ${r.name}`}>
                      {PLAN_LIST.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" variant="outline" size="sm">
                      Save
                    </Button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
