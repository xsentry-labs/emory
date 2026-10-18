import Link from "next/link";
import { LeadsHeader } from "@/components/leads/leads-header";
import { listAccounts } from "@/lib/leads/accounts";
import { getDb } from "@/lib/request-db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function AccountsPage() {
  const db = getDb();
  const accounts = listAccounts(db).filter((a) => a.people > 0 || a.status !== "new");
  return (
    <>
      <LeadsHeader db={db} />
      {accounts.length === 0 ? (
        <div className="flex flex-col gap-2 border border-dashed border-line p-6">
          <h2 className="text-lg font-semibold">no mapped accounts yet</h2>
          <p>
            tick companies on <Link href="/leads" className="text-ink underline underline-offset-4">find</Link> to look up their people and sketch the org
            chart.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4">
          {accounts.map((a) => (
            <li key={a.id}>
              <Link
                href={`/accounts/${a.id}`}
                className={cn("flex h-full flex-col gap-1 border p-4 hover:bg-wash", a.status === "in_conversation" ? "border-accent bg-accent-wash" : "border-dashed border-line")}
              >
                <span className="font-mono text-xs tracking-[0.1em]">
                  fit {a.fit ?? "—"} · {a.status.replace("_", " ")}
                </span>
                <span className="font-mono text-[15px] text-ink">{a.name.toLowerCase()}</span>
                <span className="text-[13px]">
                  {a.people} {a.people === 1 ? "person" : "people"} · {a.emails} usable email{a.emails === 1 ? "" : "s"}
                </span>
                {a.fit_reason ? <span className="text-[13px]">{a.fit_reason}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
