import Link from "next/link";
import { redirect } from "next/navigation";
import { dropAccountAction, findAction, mapAction } from "@/app/leads-actions";
import { LeadsHeader } from "@/components/leads/leads-header";
import { SubmitButton } from "@/components/start/form-bits";
import { apolloKey } from "@/lib/integrations/apollo";
import { listAccounts } from "@/lib/leads/accounts";
import { chips, getFindState } from "@/lib/leads/find";
import { getBusiness } from "@/lib/repo";
import { getDb } from "@/lib/request-db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  new: "new",
  mapped: "people found",
  approaching: "approach running",
  in_conversation: "in conversation",
  dropped: "dropped",
};

export default function FindPage({ searchParams }: { searchParams: { error?: string; added?: string; dropped?: string; dupes?: string } }) {
  const db = getDb();
  if (!getBusiness(db).onboardedAt) redirect("/start");
  const state = getFindState(db);
  const accounts = listAccounts(db, { includeDropped: true });
  const apollo = Boolean(apolloKey());
  const read = state.parsed ? chips(state.parsed) : [];

  return (
    <>
      <LeadsHeader
        db={db}
        right={
          <Link href="/prospects" className="btn btn-quiet h-9">
            add a person
          </Link>
        }
      />
      <div className="flex flex-col gap-[18px]">
        <form action={findAction} aria-label="Describe who to find" className="flex max-w-[1100px] flex-col gap-3 border border-dashed border-ink px-[18px] py-4">
          <label htmlFor="text" className="font-mono text-xs tracking-[0.1em]">
            who should emory find? in plain english
          </label>
          <textarea
            id="text"
            name="text"
            rows={2}
            required
            maxLength={2000}
            defaultValue={state.text}
            placeholder="e.g. uk warehouses and 3pls with 100 to 1,000 staff opening a new site. the ops director and whoever runs hr."
            className="w-full resize-y bg-transparent text-base leading-relaxed text-ink outline-none placeholder:text-mute"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {read.length ? (
              <>
                <span className="pr-1 font-mono text-xs">emory read that as</span>
                {read.map((c) => (
                  <span key={c} className="border border-line px-2 font-mono text-xs leading-[26px] text-ink">
                    {c}
                  </span>
                ))}
              </>
            ) : (
              <span className="font-mono text-xs">{apollo ? "searches apollo's company database" : "searches the web with ai · set APOLLO_API_KEY for company search, people and emails"}</span>
            )}
            <div className="flex-1" />
            <SubmitButton pendingLabel="searching…">{state.text && read.length ? "find more" : "search"}</SubmitButton>
          </div>
        </form>

        {searchParams.error ? (
          <p role="alert" className="max-w-[1100px] border border-dashed border-danger/60 px-4 py-3 text-sm text-danger">
            {searchParams.error}
          </p>
        ) : null}
        {searchParams.added !== undefined ? (
          <p className="max-w-[1100px] border border-dashed border-line px-4 py-3 text-sm">
            {searchParams.added} new compan{searchParams.added === "1" ? "y" : "ies"} added
            {Number(searchParams.dropped) ? ` · ${searchParams.dropped} dropped as a poor fit` : ""}
            {Number(searchParams.dupes) ? ` · ${searchParams.dupes} already here` : ""}.
          </p>
        ) : null}

        {accounts.length === 0 ? (
          <div className="flex flex-col gap-2 border border-dashed border-line p-6">
            <h2 className="text-lg font-semibold">no companies yet</h2>
            <p>describe who you sell to and emory searches for companies that match, each with a fit score and the reason for it.</p>
          </div>
        ) : (
          <form action={mapAction} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[13px] text-ink">
                {accounts.filter((a) => a.status !== "dropped").length} companies · sorted by fit
              </span>
              <div className="flex-1" />
              {apollo ? <SubmitButton pendingLabel="finding people…">find people and map org charts</SubmitButton> : null}
            </div>
            <div className="overflow-x-auto border border-dashed border-line">
              <table className="w-full min-w-[820px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-dashed border-line text-left font-mono text-xs">
                    <th scope="col" className="w-8 px-3 py-2.5 font-normal">
                      <span className="sr-only">Select</span>
                    </th>
                    {["company", "fit", "why", "people", "status", ""].map((h) => (
                      <th key={h} scope="col" className="px-3 py-2.5 font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a) => {
                    const dropped = a.status === "dropped";
                    return (
                      <tr key={a.id} className="border-b border-dashed border-line-soft align-top hover:bg-wash has-[:checked]:bg-accent-wash">
                        <td className="px-3 py-3">
                          {apollo && a.apollo_id && !dropped ? (
                            <input type="checkbox" name="account" value={a.id} aria-label={`Select ${a.name}`} className="size-4 accent-accent" />
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          <Link href={`/accounts/${a.id}`} className={cn("font-mono hover:underline", dropped ? "text-mute" : "text-ink")}>
                            {a.name.toLowerCase()}
                          </Link>
                          <br />
                          {[a.industry, a.employees ? `${a.employees.toLocaleString("en-US")} staff` : "", a.location].filter(Boolean).join(" · ").toLowerCase() || a.domain}
                        </td>
                        <td className={cn("tnum px-3 py-3 font-mono", (a.fit ?? 0) >= 80 && "text-accent")}>{a.fit ?? "—"}</td>
                        <td className="max-w-sm px-3 py-3">{a.fit_reason || "—"}</td>
                        <td className="tnum px-3 py-3 font-mono">{a.people || "—"}</td>
                        <td className={cn("px-3 py-3 font-mono text-xs", a.status === "in_conversation" && "text-ink")}>{STATUS[a.status]}</td>
                        <td className="px-3 py-3">
                          <button
                            type="submit"
                            formAction={dropAccountAction}
                            name="drop"
                            value={`${a.id}:${dropped ? "new" : "dropped"}`}
                            className="font-mono text-xs underline-offset-4 hover:text-ink hover:underline"
                            formNoValidate
                          >
                            {dropped ? "restore" : "drop"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
