import Link from "next/link";
import { addProspect, findLeads } from "@/app/actions";
import { PageHead } from "@/components/page-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getDb } from "@/lib/request-db";
import { isLlmConfigured } from "@/lib/llm";
import { listProspects } from "@/lib/repo";
import { tierFor } from "@/lib/qualify";

export const dynamic = "force-dynamic";

export default function ProspectsPage({
  searchParams,
}: {
  searchParams: { found?: string; skipped?: string; error?: string };
}) {
  const prospects = listProspects(getDb());
  return (
    <>
      <PageHead title="Leads" standfirst="Ranked by qualification score. Every outbound message waits for your approval." />

      {searchParams.error ? (
        <p role="alert" className="mb-4 rounded-md border border-danger/30 px-4 py-3 text-sm text-danger">
          {searchParams.error}
        </p>
      ) : null}
      {searchParams.found !== undefined ? (
        <p className="mb-4 rounded-md border border-line bg-wash px-4 py-3 text-sm">
          Added {searchParams.found} new lead{searchParams.found === "1" ? "" : "s"}
          {Number(searchParams.skipped) > 0 ? ` (skipped ${searchParams.skipped}: duplicates or not backed by a cited source)` : ""}.
          Open one and run &quot;Research &amp; score with AI&quot; to rank it.
        </p>
      ) : null}

      <form action={findLeads} className="card mb-6 flex flex-wrap items-end gap-3 p-5">
        <div className="min-w-60 flex-1 space-y-1.5">
          <Label htmlFor="focus">Find leads matching your ICP (optional focus)</Label>
          <Input id="focus" name="focus" maxLength={300} placeholder="e.g. Series A fintechs in London hiring a head of marketing" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="count">How many</Label>
          <select id="count" name="count" defaultValue="5" className="h-9 rounded-md border border-line bg-paper px-3 text-sm">
            {[3, 5, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline" disabled={!isLlmConfigured()}>
          Find leads with AI
        </Button>
        {!isLlmConfigured() ? <span className="text-sm text-mute">Set OPENROUTER_API_KEY to enable.</span> : null}
      </form>

      <form action={addProspect} className="card mb-8 grid gap-4 p-5 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company">Company</Label>
          <Input id="company" name="company" maxLength={200} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" maxLength={320} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="website">Website</Label>
          <Input id="website" name="website" maxLength={500} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="source">Where you found them</Label>
          <Input id="source" name="source" maxLength={200} placeholder="LinkedIn, referral, directory…" />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="notes">Research notes</Label>
          <Textarea id="notes" name="notes" rows={3} maxLength={5000} />
        </div>
        <div className="md:col-span-2">
          <Button type="submit">Add lead</Button>
        </div>
      </form>

      {prospects.length === 0 ? (
        <p className="text-mute">No leads yet.</p>
      ) : (
        <ul className="card divide-y divide-line">
          {prospects.map((p) => (
            <li key={p.id}>
              <Link href={`/prospects/${p.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-wash">
                <span>
                  <span className="font-medium">{p.name}</span>
                  {p.company ? <span className="text-mute"> · {p.company}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  {p.score !== null ? (
                    <span className="tnum text-sm text-mute">
                      {tierFor(p.score)} · {p.score}
                    </span>
                  ) : (
                    <span className="text-caption text-mute">unscored</span>
                  )}
                  {p.pending > 0 ? <Badge variant="ink">{p.pending} to approve</Badge> : null}
                  <Badge>{p.status}</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
