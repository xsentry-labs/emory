import Link from "next/link";
import { decide } from "@/app/actions";
import { PageHead } from "@/components/page-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getDb } from "@/lib/db";
import { listPendingApprovals } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function ApprovalsPage() {
  const pending = listPendingApprovals(getDb());
  return (
    <>
      <PageHead title="Approvals" standfirst="Nothing goes out until you approve it. Edit the wording here before deciding." />
      {pending.length === 0 ? (
        <p className="text-mute">Nothing waiting for approval.</p>
      ) : (
        <ul className="space-y-4">
          {pending.map((m) => (
            <li key={m.id}>
              <form action={decide} className="card space-y-3 p-5">
                <input type="hidden" name="id" value={m.id} />
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{m.kind}</Badge>
                  <Link href={`/prospects/${m.prospect_id}`} className="font-medium hover:underline">
                    {m.prospect_name}
                    {m.company ? <span className="text-mute"> · {m.company}</span> : null}
                  </Link>
                </div>
                <Input name="subject" defaultValue={m.subject} maxLength={300} aria-label="Subject" />
                <Textarea name="body" defaultValue={m.body} rows={6} required maxLength={10000} aria-label="Message" />
                <div className="flex gap-2">
                  <Button type="submit" name="decision" value="approved">
                    Approve
                  </Button>
                  <Button type="submit" name="decision" value="rejected" variant="danger">
                    Reject
                  </Button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
