import { recrawl } from "@/app/site-actions";
import { SiteTabs } from "@/components/site-section/tabs";
import { SubmitButton } from "@/components/start/form-bits";
import { getBusiness } from "@/lib/repo";
import { getDb } from "@/lib/request-db";
import { latestAudit } from "@/lib/seo/audit";
import { listPrs } from "@/lib/site/fixes";
import { openIssues } from "@/lib/site/issues";

export const dynamic = "force-dynamic";

const when = (t: number) => new Date(t).toISOString().slice(5, 16).replace("T", " ");

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const db = getDb();
  const audit = latestAudit(db);
  const site = audit?.site || getBusiness(db).website;
  const open = openIssues(db).length;
  const prs = listPrs(db).filter((p) => p.status === "open").length;
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-dashed border-line">
        <span className="font-mono text-sm text-ink">/ site{site ? ` · ${site.replace(/^https?:\/\//, "")}` : ""}</span>
        <SiteTabs
          tabs={[
            { href: "/site", label: `issues · ${open}` },
            { href: "/site/fixes", label: `fixes · ${prs} open` },
            { href: "/site/results", label: "results" },
            { href: "/site/settings", label: "settings" },
          ]}
        />
        <div className="flex-1" />
        <span className="font-mono text-xs">
          {audit?.status === "running" ? "crawling now…" : audit?.finished_at ? `last crawl ${when(audit.finished_at)} utc · nightly` : "never crawled"}
        </span>
        <form action={recrawl} className="pb-2 md:pb-0">
          <input type="hidden" name="site" value={site} />
          <SubmitButton pendingLabel="starting...">{audit ? "re-crawl now" : "crawl my site"}</SubmitButton>
        </form>
      </header>
      {children}
    </div>
  );
}
