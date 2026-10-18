import Link from "next/link";
import { notFound } from "next/navigation";
import { decide } from "@/app/actions";
import { approachStatusAction, approveApproachAction, proposeAction, stepAction } from "@/app/leads-actions";
import { LeadsHeader } from "@/components/leads/leads-header";
import { SubmitButton } from "@/components/start/form-bits";
import { accountPeople, getAccount } from "@/lib/leads/accounts";
import { latestApproach, type Step } from "@/lib/leads/approach";
import { getDb } from "@/lib/request-db";
import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const when = (s: Step, approvedAt: number | null, now: number) => {
  if (!approvedAt || s.due_at === null) return s.day_offset === 0 ? "day 0" : `+${s.day_offset}d`;
  const days = Math.round((s.due_at - now) / DAY);
  return days <= 0 && s.status === "planned" ? "today" : new Date(s.due_at).toISOString().slice(5, 10);
};

const STEP_STATUS: Record<Step["status"], string> = { planned: "", drafted: "· drafted, waiting for you", done: "✓", skipped: "skipped" };

export default function ApproachPage({ params, searchParams }: { params: { id: string }; searchParams: { approved?: string } }) {
  const db = getDb();
  const account = getAccount(db, Number(params.id));
  if (!account) notFound();
  const approach = latestApproach(db, account.id);
  const people = new Map(accountPeople(db, account.id).map((p) => [p.id, p]));
  const now = Date.now();

  if (!approach) {
    return (
      <>
        <LeadsHeader db={db} />
        <div className="flex flex-col gap-2 border border-dashed border-line p-6">
          <h1 className="text-lg font-semibold">no approach for {account.name.toLowerCase()} yet</h1>
          <p>
            tick people on the <Link href={`/accounts/${account.id}`} className="text-ink underline underline-offset-4">org chart</Link> and build one.
          </p>
        </div>
      </>
    );
  }

  const byPerson = new Map<number, Step[]>();
  for (const s of approach.steps) byPerson.set(s.prospect_id, [...(byPerson.get(s.prospect_id) ?? []), s]);
  const lead = [...byPerson.keys()][0];
  const drafts = db
    .prepare(
      `SELECT m.*, p.name AS person FROM messages m JOIN prospects p ON p.id = m.prospect_id
       WHERE p.account_id = ? AND m.status = 'draft' ORDER BY m.created_at`,
    )
    .all(account.id) as (Message & { person: string })[];

  return (
    <>
      <LeadsHeader
        db={db}
        right={
          <div className="flex flex-wrap gap-2 pb-2 md:pb-0">
            {approach.status === "proposed" ? (
              <>
                <form action={proposeAction}>
                  <input type="hidden" name="account" value={account.id} />
                  {[...byPerson.keys()].map((id) => (
                    <input key={id} type="hidden" name="person" value={id} />
                  ))}
                  <button type="submit" className="btn btn-quiet h-9">
                    regenerate
                  </button>
                </form>
                <form action={approveApproachAction}>
                  <input type="hidden" name="approach" value={approach.id} />
                  <input type="hidden" name="account" value={account.id} />
                  <SubmitButton pendingLabel="approving…">approve plan</SubmitButton>
                </form>
              </>
            ) : approach.status === "approved" || approach.status === "paused" ? (
              <form action={approachStatusAction}>
                <input type="hidden" name="approach" value={approach.id} />
                <input type="hidden" name="account" value={account.id} />
                <input type="hidden" name="status" value={approach.status === "approved" ? "paused" : "approved"} />
                <button type="submit" className="btn h-9">
                  {approach.status === "approved" ? "pause plan" : "resume plan"}
                </button>
              </form>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-col gap-5">
        {searchParams.approved ? (
          <p className="border border-dashed border-line px-4 py-3 text-sm">approved. emails are drafted as they fall due and wait in today for you to approve.</p>
        ) : null}
        {approach.status === "paused" ? (
          <p className="border border-accent bg-accent-wash px-4 py-3 text-sm text-ink">paused: someone at this account replied or you paused it. read the reply before resuming.</p>
        ) : null}

        <section aria-labelledby="str" className="flex flex-wrap items-start gap-7">
          <div className="flex max-w-[760px] flex-[1_1_420px] flex-col gap-1.5">
            <span className="font-mono text-xs tracking-[0.1em]">
              approach ·{" "}
              <Link href={`/accounts/${account.id}`} className="hover:text-ink hover:underline">
                {account.name.toLowerCase()}
              </Link>{" "}
              · {byPerson.size} {byPerson.size === 1 ? "person" : "people"} · {approach.status}
            </span>
            <h1 id="str" className="text-2xl font-semibold">
              {approach.headline}
            </h1>
            <p className="text-[15px]">{approach.rationale}</p>
          </div>
          <div className="flex flex-[0_1_300px] flex-col gap-1 border border-dashed border-line p-3.5 text-[13px]">
            <span className="font-mono text-xs text-ink">rules for this account</span>
            {approach.rules.map((r) => (
              <span key={r}>· {r}</span>
            ))}
          </div>
        </section>

        <section aria-label="Plan per person" className="grid grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] gap-4">
          {[...byPerson.entries()].map(([pid, steps]) => {
            const p = people.get(pid);
            return (
              <div key={pid} className={cn("flex min-w-0 flex-col gap-2.5 p-4", pid === lead ? "border border-accent bg-accent-wash" : "border border-dashed border-line")}>
                <span className="flex items-baseline justify-between gap-2">
                  <Link href={`/prospects/${pid}`} className="font-mono text-[15px] text-ink hover:underline">
                    {(p?.name ?? "someone").toLowerCase()}
                  </Link>
                  <span className={cn("font-mono text-[11px]", pid === lead && "text-accent")}>{p?.buying_role || p?.title.toLowerCase()}</span>
                </span>
                <span className="text-[13px]">angle · {steps[0].angle}</span>
                <ol>
                  {steps.map((s) => {
                    const task = s.channel !== "email" && s.status === "planned" && approach.status === "approved" && (s.due_at ?? Infinity) <= now;
                    return (
                      <li key={s.id} className="grid grid-cols-[52px_64px_minmax(0,1fr)] items-baseline gap-2 border-t border-dashed border-line-soft py-1.5 text-[13px]">
                        <span className="font-mono">{when(s, approach.approved_at, now)}</span>
                        <span className={cn("font-mono text-[11px] text-ink", task && "text-accent")}>{s.channel}</span>
                        <span className={cn(s.status === "skipped" && "line-through")}>
                          {s.summary} {STEP_STATUS[s.status]}
                          {task ? (
                            <span className="mt-1 flex gap-2">
                              {(["done", "skipped"] as const).map((st) => (
                                <form key={st} action={stepAction}>
                                  <input type="hidden" name="step" value={s.id} />
                                  <input type="hidden" name="status" value={st} />
                                  <button type="submit" className="font-mono text-xs underline underline-offset-4 hover:text-ink">
                                    {st === "done" ? "mark done" : "skip"}
                                  </button>
                                </form>
                              ))}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          })}
        </section>

        {drafts.map((d) => (
          <section key={d.id} aria-label={`Draft to ${d.person}`} className="flex max-w-[900px] flex-col gap-2">
            <h2 className="text-[15px] font-semibold">next draft · {d.person.toLowerCase()} by email</h2>
            <form action={decide} className="flex flex-col gap-2">
              <input type="hidden" name="id" value={d.id} />
              <label htmlFor={`s${d.id}`} className="sr-only">
                Subject
              </label>
              <input id={`s${d.id}`} name="subject" defaultValue={d.subject} maxLength={300} className="h-10 border border-line bg-field px-3 font-mono text-sm text-ink" />
              <label htmlFor={`b${d.id}`} className="sr-only">
                Email draft
              </label>
              <textarea id={`b${d.id}`} name="body" defaultValue={d.body} rows={6} required maxLength={10000} className="border border-line bg-field px-3.5 py-3 text-sm leading-relaxed text-ink" />
              <div className="flex flex-wrap gap-2">
                <button type="submit" name="decision" value="approved" className="btn btn-primary btn-sm">
                  approve email
                </button>
                <button type="submit" name="decision" value="rejected" className="btn btn-quiet btn-sm">
                  skip
                </button>
              </div>
            </form>
          </section>
        ))}
      </div>
    </>
  );
}
