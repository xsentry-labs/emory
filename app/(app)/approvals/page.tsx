import Link from "next/link";
import { decide } from "@/app/actions";
import { SendActions } from "@/components/approvals/send-actions";
import { PageHead } from "@/components/page-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listPendingApprovals, listReadyToSend } from "@/lib/repo";
import { currentUser, getDb } from "@/lib/request-db";

export const dynamic = "force-dynamic";

// The server's own mailbox (if configured) belongs to a single workspace; everyone else sends by hand.
const serverSends = (workspaceId: number | undefined) =>
  Boolean(workspaceId) &&
  Number(process.env.SENDING_WORKSPACE_ID) === workspaceId &&
  Boolean(process.env.SMTP_URL && process.env.FROM_EMAIL);

export default function ApprovalsPage() {
  const db = getDb();
  const pending = listPendingApprovals(db);
  const ready = listReadyToSend(db);
  const automatic = serverSends(currentUser()?.workspaceId);

  return (
    <>
      <PageHead title="Approvals" standfirst="Nothing goes out until you approve it. Edit the wording here, then send from your own inbox." />

      <h2 className="mb-3 font-display text-h3">To approve</h2>
      {pending.length === 0 ? (
        <p className="mb-10 text-mute">Nothing waiting for approval.</p>
      ) : (
        <ul className="mb-10 space-y-4">
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

      <h2 className="mb-1 font-display text-h3">Ready to send</h2>
      <p className="mb-3 text-sm text-mute">
        {automatic
          ? "Approved messages are sent automatically from the connected mailbox."
          : "Approved. Copy each one or open it in your mail app, send it, then mark it as sent so follow-ups stay on schedule."}
      </p>
      {ready.length === 0 ? (
        <p className="text-mute">Nothing ready to send.</p>
      ) : (
        <ul className="space-y-4">
          {ready.map((m) => (
            <li key={m.id} className="card space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{m.kind}</Badge>
                <Link href={`/prospects/${m.prospect_id}`} className="font-medium hover:underline">
                  {m.prospect_name}
                  {m.company ? <span className="text-mute"> · {m.company}</span> : null}
                </Link>
                <span className="text-caption text-mute">{m.email || "no email yet: add one on the lead"}</span>
              </div>
              {m.subject ? <p className="font-medium">{m.subject}</p> : null}
              <p className="whitespace-pre-wrap text-sm">{m.body}</p>
              {m.send_error ? <p className="text-caption text-danger">{m.send_error}</p> : null}
              {automatic ? null : <SendActions id={m.id} to={m.email} subject={m.subject} body={m.body} />}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
