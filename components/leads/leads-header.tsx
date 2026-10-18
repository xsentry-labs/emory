import { SectionTabs } from "@/components/shell/section-tabs";
import type { DB } from "@/lib/db";
import { listAccounts } from "@/lib/leads/accounts";
import { listApproaches } from "@/lib/leads/approach";

/** Header shared by every leads screen: find → people → accounts → approaches. */
export function LeadsHeader({ db, right }: { db: DB; right?: React.ReactNode }) {
  const people = (db.prepare(`SELECT COUNT(*) AS n FROM prospects`).get() as { n: number }).n;
  const accounts = listAccounts(db).length;
  const approaches = listApproaches(db).filter((a) => a.status !== "done").length;
  return (
    <header className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-dashed border-line">
      <span className="font-mono text-sm text-ink">/ leads</span>
      <SectionTabs
        label="Lead views"
        tabs={[
          { href: "/leads", label: "find" },
          { href: "/leads/people", label: `people · ${people}` },
          { href: "/accounts", label: `accounts · ${accounts}` },
          { href: "/leads/approaches", label: `approaches · ${approaches}` },
        ]}
      />
      <div className="flex-1" />
      {right}
    </header>
  );
}
