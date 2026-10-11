import { notFound } from "next/navigation";
import { addDraft, addReply, changeStatus, generateDraft, qualify, research, saveContact } from "@/app/actions";
import { PageHead } from "@/components/page-head";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getDb } from "@/lib/request-db";
import { isLlmConfigured } from "@/lib/llm";
import { sendConfig } from "@/lib/mailer";
import { getProspect, listMessages } from "@/lib/repo";
import { PROSPECT_STATUSES } from "@/lib/types";
import { RATING_LABELS, WEIGHTS, scoreLead } from "@/lib/qualify";

export const dynamic = "force-dynamic";

const DIMENSIONS = [
  ["icpFit", "ICP fit", "Matches who you serve best"],
  ["need", "Need", "Has the problem you solve"],
  ["budget", "Budget", "Can pay for it"],
  ["authority", "Authority", "Reached a decision maker"],
  ["timing", "Timing", "Wants it soon"],
] as const;

export default function ProspectPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();
  const db = getDb();
  const prospect = getProspect(db, id);
  if (!prospect) notFound();
  const messages = listMessages(db, id);
  const sendingEnabled = sendConfig() !== null;
  const nextKind = messages.some((m) => m.direction === "outbound") ? "followup" : "outreach";
  const current = {
    icpFit: prospect.icp_fit ?? 0,
    budget: prospect.bant_budget ?? 0,
    authority: prospect.bant_authority ?? 0,
    need: prospect.bant_need ?? 0,
    timing: prospect.bant_timing ?? 0,
  };

  return (
    <>
      <PageHead
        title={prospect.name}
        standfirst={[prospect.company, prospect.email, prospect.website].filter(Boolean).join(" · ") || undefined}
        actions={
          <form action={changeStatus} className="flex gap-2">
            <input type="hidden" name="prospectId" value={prospect.id} />
            <select
              name="status"
              defaultValue={prospect.status}
              className="h-9 rounded-md border border-line bg-paper px-3 text-sm"
              aria-label="Status"
            >
              {PROSPECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Set status
            </Button>
          </form>
        }
      />

      {prospect.notes ? <p className="measure mb-8 whitespace-pre-wrap text-mute">{prospect.notes}</p> : null}
      {prospect.source_url ? (
        <p className="mb-8 text-sm">
          <a href={prospect.source_url} target="_blank" rel="noopener noreferrer" className="underline">
            Where this lead was found
          </a>
        </p>
      ) : null}

      <form action={saveContact} className="card mb-6 flex flex-wrap items-end gap-3 p-5">
        <input type="hidden" name="prospectId" value={prospect.id} />
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="contact-email">Email</Label>
          <Input id="contact-email" name="email" type="email" defaultValue={prospect.email} maxLength={320} placeholder="name@company.com" />
        </div>
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="contact-linkedin">LinkedIn</Label>
          <Input id="contact-linkedin" name="linkedin_url" defaultValue={prospect.linkedin_url} maxLength={300} placeholder="linkedin.com/in/..." />
        </div>
        <Button type="submit" variant="outline">
          Save contact
        </Button>
        {prospect.linkedin_url ? (
          <a href={prospect.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm underline">
            Open LinkedIn
          </a>
        ) : null}
      </form>

      <form action={research} className="card mb-6 flex flex-wrap items-center gap-3 p-5">
        <input type="hidden" name="prospectId" value={prospect.id} />
        <Button type="submit" variant="outline" disabled={!isLlmConfigured()}>
          Research &amp; score with AI
        </Button>
        <span className="text-sm text-mute">
          {isLlmConfigured()
            ? "Reads the lead's website and notes, then rates ICP fit and BANT. You can adjust the ratings below."
            : "Set OPENROUTER_API_KEY to enable AI research."}
        </span>
      </form>

      {prospect.research_summary ? (
        <div className="card mb-6 space-y-2 p-5">
          <h2 className="font-display text-h3">Research</h2>
          <p className="whitespace-pre-wrap">{prospect.research_summary}</p>
          {prospect.score_rationale ? <p className="text-sm text-mute">Why this score: {prospect.score_rationale}</p> : null}
          {prospect.researched_at ? (
            <p className="tnum text-caption text-mute">Researched {new Date(prospect.researched_at).toLocaleString()}</p>
          ) : null}
        </div>
      ) : null}

      <form action={qualify} className="card mb-8 space-y-4 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-h3">Qualification</h2>
          <span className="tnum text-sm text-mute">
            {prospect.score !== null ? `Tier ${scoreLead(current).tier} · ${prospect.score}/100` : "Not scored yet"}
          </span>
        </div>
        <input type="hidden" name="prospectId" value={prospect.id} />
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-5">
          {DIMENSIONS.map(([key, label, hint]) => (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key}>
                {label} <span className="text-mute">({WEIGHTS[key]}%)</span>
              </Label>
              <select
                id={key}
                name={key}
                defaultValue={current[key]}
                className="h-9 w-full rounded-md border border-line bg-paper px-2 text-sm"
              >
                {RATING_LABELS.map((l, i) => (
                  <option key={i} value={i}>
                    {i} · {l}
                  </option>
                ))}
              </select>
              <p className="text-caption text-mute">{hint}</p>
            </div>
          ))}
        </div>
        <Button type="submit" variant="outline">
          Save score
        </Button>
      </form>

      <h2 className="mb-3 font-display text-h3">Conversation</h2>
      {messages.length === 0 ? (
        <p className="mb-8 text-mute">Nothing yet. Write a first outreach draft below.</p>
      ) : (
        <ul className="mb-8 space-y-3">
          {messages.map((m) => (
            <li key={m.id} className={`card p-4 ${m.direction === "inbound" ? "bg-wash" : ""}`}>
              <div className="mb-2 flex items-center gap-2">
                <Badge variant={m.direction === "inbound" ? "default" : "outline"}>
                  {m.direction === "inbound" ? "Reply" : m.kind}
                </Badge>
                <Badge variant={m.status === "draft" ? "ink" : "default"}>{m.status}</Badge>
                <span className="tnum text-caption text-mute">{new Date(m.created_at).toLocaleString()}</span>
              </div>
              {m.subject ? <p className="font-medium">{m.subject}</p> : null}
              <p className="whitespace-pre-wrap">{m.body}</p>
              {m.status === "approved" ? (
                <p className={`mt-2 text-caption ${m.send_error ? "text-danger" : "text-mute"}`}>
                  {m.send_error || (sendingEnabled ? "Approved. Sends on the next worker run." : "Approved. Sending is not configured (set SMTP_URL and FROM_EMAIL).")}
                </p>
              ) : null}
              {m.status === "sent" && m.sent_at ? (
                <p className="tnum mt-2 text-caption text-mute">Sent {new Date(m.sent_at).toLocaleString()}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {searchParams.error ? (
        <p role="alert" className="mb-4 rounded-md border border-danger/30 px-4 py-3 text-sm text-danger">
          {searchParams.error}
        </p>
      ) : null}

      <form action={generateDraft} className="card mb-6 flex flex-wrap items-center gap-3 p-5">
        <input type="hidden" name="prospectId" value={prospect.id} />
        <input type="hidden" name="kind" value={nextKind} />
        <Button type="submit" disabled={!isLlmConfigured()}>
          Draft {nextKind === "followup" ? "follow-up" : "outreach"} with AI
        </Button>
        <span className="text-sm text-mute">
          {isLlmConfigured()
            ? "Uses your Offer & ICP and this lead's notes. The draft goes to Approvals."
            : "Set OPENROUTER_API_KEY to enable AI drafting."}
        </span>
      </form>

      <div className="grid gap-6 md:grid-cols-2">
        <form action={addDraft} className="card space-y-3 p-5">
          <h3 className="font-display text-h3">New draft</h3>
          <input type="hidden" name="prospectId" value={prospect.id} />
          <input type="hidden" name="kind" value={nextKind} />
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" name="subject" maxLength={300} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body">Message</Label>
            <Textarea id="body" name="body" rows={6} required maxLength={10000} />
          </div>
          <Button type="submit">Send to approvals</Button>
        </form>

        <form action={addReply} className="card space-y-3 p-5">
          <h3 className="font-display text-h3">Log a reply</h3>
          <input type="hidden" name="prospectId" value={prospect.id} />
          <div className="space-y-1.5">
            <Label htmlFor="reply">Their reply</Label>
            <Textarea id="reply" name="body" rows={6} required maxLength={10000} />
          </div>
          <Button type="submit" variant="outline">
            Log reply
          </Button>
        </form>
      </div>
    </>
  );
}
