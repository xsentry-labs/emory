import Link from "next/link";
import { findMoreLeads } from "@/app/actions";
import { LeadsTable } from "@/components/leads/leads-table";
import { PageHead } from "@/components/page-head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDb } from "@/lib/request-db";
import { leadsPayload } from "@/lib/leads-view";
import { isLlmConfigured } from "@/lib/llm";
import { getBusiness, getProfile } from "@/lib/repo";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function LeadsPage({ searchParams }: { searchParams: { error?: string } }) {
  const db = getDb();
  if (!getBusiness(db).onboardedAt) redirect("/start");
  const payload = leadsPayload(db);
  const { icp } = getProfile(db);
  const running = payload.pipeline.status === "running";

  return (
    <>
      <PageHead
        title="Your leads"
        standfirst="Ranked by ICP fit and BANT (Budget, Authority, Need, Timing). Nothing is sent until you approve it."
        actions={
          <Link href="/prospects" className="text-sm text-mute underline">
            Add a lead manually
          </Link>
        }
      />

      {searchParams.error ? (
        <p role="alert" className="mb-4 rounded-md border border-danger/30 px-4 py-3 text-sm text-danger">
          {searchParams.error}
        </p>
      ) : null}

      <div className="card mb-6 flex flex-wrap items-end justify-between gap-4 p-4">
        <div className="min-w-60 flex-1">
          <p className="label">Targeting</p>
          <p className="line-clamp-2 text-sm">{icp}</p>
          <Link href="/profile" className="text-caption text-mute underline">
            Edit your offer and ideal customer
          </Link>
        </div>
        <form action={findMoreLeads} className="flex flex-wrap items-end gap-2">
          <Input name="focus" maxLength={300} placeholder="Optional focus, e.g. fintechs in London" className="w-72" />
          <Button type="submit" variant="outline" disabled={running || !isLlmConfigured()}>
            {running ? "Finding..." : "Find more leads"}
          </Button>
        </form>
      </div>

      <LeadsTable initial={payload} />
    </>
  );
}
