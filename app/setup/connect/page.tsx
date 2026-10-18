import Link from "next/link";
import { PERMISSIONS, TRACK_NAMES, chosenTracks, listConnections, type Connection } from "@/lib/connections";
import { TRACK_IDS } from "@/lib/report";
import { currentUser, getDb } from "@/lib/request-db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function Row({ c }: { c: Connection }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-dashed border-line py-3.5 last:border-b">
      <span className="flex flex-col gap-0.5">
        <span className="font-mono text-[15px] text-ink">{c.name}</span>
        <span>{c.detail}</span>
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 font-mono text-xs",
          c.state === "connected" || c.state === "ready" ? "text-ink" : "text-mute",
          c.state === "planned" && "opacity-70",
        )}
      >
        {c.state === "connected" || c.state === "ready" ? <span className="size-2 bg-accent" aria-hidden /> : null}
        {c.status}
      </span>
    </li>
  );
}

export default function ConnectPage() {
  const user = currentUser()!;
  const chosen = chosenTracks(getDb());
  const connections = listConnections(user.workspaceId);
  const order = [...chosen, ...TRACK_IDS.filter((t) => !chosen.includes(t))];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex min-h-14 flex-wrap items-center gap-6 border-b border-dashed border-line px-6">
        <span className="font-mono text-[15px] tracking-[0.26em] text-ink">emory</span>
        <ol aria-label="Setup steps" className="flex flex-wrap gap-[22px] font-mono text-[13px]">
          <li>✓ report</li>
          <li aria-current="step" className="flex items-center gap-2 text-ink">
            <span className="size-[9px] bg-accent" aria-hidden />
            connect
          </li>
          <li>today</li>
        </ol>
        <div className="flex-1" />
        <span className="font-mono text-xs">connect only what your tracks need · add the rest later</span>
      </header>

      <div className="flex flex-1 flex-wrap">
        <main className="flex min-w-0 max-w-[920px] flex-[999_1_560px] flex-col px-6 py-8 md:px-12">
          <span className="font-mono text-sm tracking-[0.12em]">003</span>
          <h1 className="mt-1.5 text-[28px] font-semibold">connect where emory works</h1>
          {order.map((t) => (
            <section key={t} aria-label={TRACK_NAMES[t]} className={cn(!chosen.includes(t) && "opacity-70")}>
              <h2 className="pb-1.5 pt-[22px] font-mono text-xs font-normal tracking-[0.12em] text-accent">
                {TRACK_NAMES[t]}
                {chosen.includes(t) ? "" : " · not picked"}
              </h2>
              <ul>
                {connections
                  .filter((c) => c.track === t)
                  .map((c) => (
                    <Row key={c.id} c={c} />
                  ))}
              </ul>
            </section>
          ))}
          <p className="mt-6 text-sm">
            want sharper leads? <Link href="/setup/business" className="text-ink underline underline-offset-4">tell emory more about your service</Link>.
          </p>
        </main>

        <aside aria-labelledby="perm" className="flex flex-[1_1_340px] flex-col gap-3 border-t border-dashed border-line px-6 py-8 md:max-w-[440px] md:border-l md:border-t-0 md:px-7">
          <h2 id="perm" className="text-base font-semibold">
            what emory may do
          </h2>
          <p className="text-[13px]">a person approves everything that leaves emory. there is no autopilot.</p>
          <ul>
            {PERMISSIONS.map((p) => (
              <li key={p.what} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5 border-t border-dashed border-line-soft py-2.5 text-[13px] last:border-b">
                <span>{p.what}</span>
                <span className="font-mono text-xs text-ink">{p.rule}</span>
              </li>
            ))}
          </ul>
          <div className="flex-1" />
          <Link href="/today" className="btn btn-primary self-start">
            go to today
          </Link>
        </aside>
      </div>
    </div>
  );
}
