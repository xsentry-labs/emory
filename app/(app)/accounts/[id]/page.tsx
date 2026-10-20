import Link from "next/link";
import { notFound } from "next/navigation";
import { enrichAction, mapAction, proposeAction, remapAction, setManagerAction, setRoleAction } from "@/app/leads-actions";
import { LeadsHeader } from "@/components/leads/leads-header";
import { OrgChart } from "@/components/leads/org-chart";
import { SubmitButton } from "@/components/start/form-bits";
import { apolloKey } from "@/lib/integrations/apollo";
import { accountPeople, getAccount } from "@/lib/leads/accounts";
import { latestApproach } from "@/lib/leads/approach";
import { BUYING_ROLES, canEmail, orgTree } from "@/lib/leads/people";
import { listMessages } from "@/lib/repo";
import { getDb } from "@/lib/request-db";

export const dynamic = "force-dynamic";

const emailText = (status: string) =>
  ({ verified: "verified", manual: "entered by hand", guessed: "risky · not verified", unavailable: "not found" })[status] ?? "not looked up";

export default function AccountPage({ params, searchParams }: { params: { id: string }; searchParams: { person?: string; error?: string } }) {
  const db = getDb();
  const account = getAccount(db, Number(params.id));
  if (!account) notFound();
  const people = accountPeople(db, account.id);
  const roots = orgTree(people);
  const selected = people.find((p) => p.id === Number(searchParams.person)) ?? people.find((p) => p.buying_role === "decides") ?? people[0] ?? null;
  const picked = new Set(people.filter((p) => p.buying_role === "decides" || p.buying_role === "champion").map((p) => p.id));
  const approach = latestApproach(db, account.id);
  const apollo = Boolean(apolloKey());
  const history = selected ? listMessages(db, selected.id).filter((m) => m.status === "sent" || m.status === "received") : [];

  return (
    <>
      <LeadsHeader db={db} />
      <div className="flex flex-col gap-8 xl:flex-row">
        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs tracking-[0.1em]">
                account · fit {account.fit ?? "—"} · {account.status.replace("_", " ")}
              </span>
              <h1 className="text-[26px] font-semibold">{account.name.toLowerCase()}</h1>
              <span className="text-[13px]">
                {[account.industry, account.employees ? `${account.employees.toLocaleString("en-US")} staff` : "", account.location, account.domain]
                  .filter(Boolean)
                  .join(" · ")
                  .toLowerCase()}
              </span>
            </div>
            <div className="flex-1" />
            {apollo && account.apollo_id ? (
              <form action={mapAction}>
                <input type="hidden" name="account" value={account.id} />
                <button type="submit" className="btn btn-quiet h-9">
                  {people.length ? "find more people" : "find people"}
                </button>
              </form>
            ) : null}
            {people.length ? (
              <form action={remapAction}>
                <input type="hidden" name="account" value={account.id} />
                <button type="submit" className="btn btn-quiet h-9">
                  redraw chart
                </button>
              </form>
            ) : null}
            {approach ? (
              <Link href={`/accounts/${account.id}/approach`} className="btn h-9">
                approach · {approach.status}
              </Link>
            ) : null}
          </div>

          {searchParams.error ? (
            <p role="alert" className="border border-dashed border-danger/60 px-4 py-3 text-sm text-danger">
              {searchParams.error}
            </p>
          ) : null}

          {people.length === 0 ? (
            <div className="flex flex-col gap-2 border border-dashed border-line p-6">
              <h2 className="text-lg font-semibold">no people yet</h2>
              <p>{apollo && account.apollo_id ? "find people to see who works here and sketch the org chart." : "add people by hand from the people tab."}</p>
            </div>
          ) : (
            <form action={proposeAction} className="flex flex-col gap-4">
              <input type="hidden" name="account" value={account.id} />
              <div className="flex flex-wrap items-center gap-4 font-mono text-[11px]">
                <span>roles: {BUYING_ROLES.join(" · ")}</span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="w-[18px] border-t-2 border-dashed border-mute" />
                  reporting line is a guess
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 border-2 border-accent" />
                  ticked for the approach
                </span>
                <div className="flex-1" />
                <SubmitButton pendingLabel="planning…">build approach for ticked people</SubmitButton>
              </div>
              <section aria-label="Org chart" className="overflow-auto border border-dashed border-line bg-field">
                <OrgChart roots={roots} accountId={account.id} selected={selected?.id ?? null} picked={picked} />
              </section>
              <span className="text-xs">built from job titles. dashed lines are guesses; correct them on the right and emory keeps your version.</span>
            </form>
          )}
        </main>

        <aside aria-label="Account details" className="flex flex-col gap-3 xl:w-[360px] xl:shrink-0 xl:border-l xl:border-dashed xl:border-line xl:pl-6">
          {selected ? (
            <>
              <span className="font-mono text-xs tracking-[0.1em]">selected · {selected.name.toLowerCase()}</span>
              <dl>
                {[
                  ["role", selected.buying_role ? `${selected.buying_role}${selected.role_reason ? ` · ${selected.role_reason}` : ""}` : "unclear"],
                  ["title", selected.title.toLowerCase() || "unknown"],
                  ["email", `${selected.email || "—"} · ${emailText(selected.email_status)}`],
                  ["so far", history.length ? `${history.length} message${history.length === 1 ? "" : "s"} · ${selected.status}` : "not contacted"],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[72px_minmax(0,1fr)] gap-2.5 border-t border-dashed border-line-soft py-2 text-[13px] last:border-b">
                    <dt className="font-mono">{k}</dt>
                    <dd className="break-words">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-2">
                <Link href={`/prospects/${selected.id}`} className="btn btn-quiet h-9">
                  open person
                </Link>
                {apollo && selected.apollo_id && selected.email_status === "" ? (
                  <form action={enrichAction}>
                    <input type="hidden" name="person" value={selected.id} />
                    <input type="hidden" name="back" value={`/accounts/${account.id}?person=${selected.id}`} />
                    <button type="submit" className="btn h-9">
                      look up email
                    </button>
                  </form>
                ) : null}
              </div>

              <form action={setManagerAction} className="flex flex-col gap-1.5 pt-2">
                <input type="hidden" name="person" value={selected.id} />
                <input type="hidden" name="account" value={account.id} />
                <label htmlFor="manager" className="font-mono text-xs text-ink">
                  reports to {selected.reports_verified ? "· confirmed" : "· a guess"}
                </label>
                <div className="flex gap-2">
                  <select id="manager" name="manager" defaultValue={selected.reports_to ?? ""} className="h-9 min-w-0 flex-1 border border-line bg-field px-2 font-mono text-xs text-ink">
                    <option value="">nobody here (top)</option>
                    {people
                      .filter((p) => p.id !== selected.id)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name.toLowerCase()}
                        </option>
                      ))}
                  </select>
                  <button type="submit" className="btn btn-quiet h-9">
                    confirm
                  </button>
                </div>
              </form>
              <form action={setRoleAction} className="flex flex-col gap-1.5">
                <input type="hidden" name="person" value={selected.id} />
                <input type="hidden" name="account" value={account.id} />
                <label htmlFor="role" className="font-mono text-xs text-ink">
                  buying role
                </label>
                <div className="flex gap-2">
                  <select id="role" name="role" defaultValue={selected.buying_role} className="h-9 min-w-0 flex-1 border border-line bg-field px-2 font-mono text-xs text-ink">
                    <option value="">unclear</option>
                    {BUYING_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="btn btn-quiet h-9">
                    save
                  </button>
                </div>
              </form>
            </>
          ) : null}

          <span className="pt-4 font-mono text-[13px] text-ink">about the account</span>
          {account.fit_reason ? <span className="text-[13px]">· {account.fit_reason}</span> : null}
          {account.description ? <span className="text-[13px]">· {account.description.slice(0, 400)}</span> : null}
          <span className="text-[13px]">
            · {people.filter(canEmail).length} of {people.length} people have a usable email
          </span>
          <div className="flex-1" />
          <span className="text-xs">one account thread: emory won&apos;t email two people here on the same day.</span>
        </aside>
      </div>
    </>
  );
}
