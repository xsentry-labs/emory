import { runSeoAudit } from "@/app/actions";
import { PageHead } from "@/components/page-head";
import { SeoView } from "@/components/seo/seo-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isLlmConfigured } from "@/lib/llm";
import { getBusiness } from "@/lib/repo";
import { getDb } from "@/lib/request-db";
import { latestAudit } from "@/lib/seo/audit";

export const dynamic = "force-dynamic";

export default function SeoPage({ searchParams }: { searchParams: { error?: string } }) {
  const db = getDb();
  const audit = latestAudit(db);
  const site = audit?.site || getBusiness(db).website;
  const running = audit?.status === "running";

  return (
    <>
      <PageHead
        title="SEO"
        standfirst="We crawl your site, find what's holding back your search visibility, and write the fixes so you can paste them in."
      />
      {searchParams.error ? (
        <p role="alert" className="mb-4 rounded-md border border-danger/30 px-4 py-3 text-sm text-danger">
          {searchParams.error}
        </p>
      ) : null}
      <form action={runSeoAudit} className="card mb-8 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-60 flex-1 space-y-1.5">
          <Label htmlFor="site">Website to audit</Label>
          <Input id="site" name="site" defaultValue={site} placeholder="yourcompany.com" maxLength={300} />
        </div>
        <Button type="submit" disabled={running}>
          {running ? "Running..." : audit ? "Run again" : "Run SEO audit"}
        </Button>
        {!isLlmConfigured() ? <span className="text-sm text-mute">Without OPENROUTER_API_KEY you get the findings but no written fix plan.</span> : null}
      </form>
      <SeoView initial={audit} />
    </>
  );
}
