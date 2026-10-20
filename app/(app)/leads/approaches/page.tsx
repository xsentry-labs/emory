import Link from "next/link";
import { LeadsHeader } from "@/components/leads/leads-header";
import { listApproaches } from "@/lib/leads/approach";
import { getDb } from "@/lib/request-db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LABEL = { proposed: "waiting for your approval", approved: "running", paused: "paused", done: "finished" } as const;

export default function ApproachesPage() {
  const db = getDb();
  const approaches = listApproaches(db);
  return (
    <>
      <LeadsHeader db={db} />
      {approaches.length === 0 ? (
        <div className="flex flex-col gap-2 border border-dashed border-line p-6">
          <h2 className="text-lg font-semibold">no approaches yet</h2>
          <p>open an account, tick the people on its org chart, and emory plans who to contact, in what order, and why.</p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {approaches.map((a) => {
            const left = a.steps.filter((s) => s.status === "planned").length;
            return (
              <li key={a.id}>
                <Link
                  href={`/accounts/${a.account_id}/approach`}
                  className="grid grid-cols-1 gap-1 border-t border-dashed border-line px-1 py-4 hover:bg-wash md:grid-cols-[220px_minmax(0,1fr)_200px] md:gap-4"
                >
                  <span className="font-mono text-ink">{a.account_name.toLowerCase()}</span>
                  <span>{a.headline}</span>
                  <span className={cn("font-mono text-xs", a.status === "proposed" || a.status === "paused" ? "text-accent" : undefined)}>
                    {LABEL[a.status]}
                    {a.status === "approved" ? ` · ${left} step${left === 1 ? "" : "s"} left` : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
