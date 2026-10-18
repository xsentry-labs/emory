import Link from "next/link";
import { decide } from "@/app/actions";
import { cn } from "@/lib/utils";
import { getDb } from "@/lib/request-db";
import { TRACKS, todayView, type TodayItem, type Track } from "@/lib/today";

export const dynamic = "force-dynamic";

const ago = (t: number, now: number) => {
  const m = Math.max(0, Math.round((now - t) / 60_000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

function DraftActions({ item }: { item: TodayItem }) {
  const d = item.draft!;
  return (
    <form action={decide} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={d.id} />
      <details className="group">
        <summary className="cursor-pointer list-none font-mono text-xs text-mute underline-offset-4 hover:text-ink hover:underline">
          <span className="group-open:hidden">read and edit the full email</span>
          <span className="hidden group-open:inline">hide the email</span>
        </summary>
        <div className="mt-3 flex flex-col gap-2">
          <label className="sr-only" htmlFor={`s${d.id}`}>
            Subject
          </label>
          <input id={`s${d.id}`} name="subject" defaultValue={d.subject} maxLength={300} className="h-10 border border-line bg-field px-3 font-mono text-sm text-ink" />
          <label className="sr-only" htmlFor={`b${d.id}`}>
            Message
          </label>
          <textarea id={`b${d.id}`} name="body" defaultValue={d.body} rows={8} required maxLength={10000} className="border border-line bg-field p-3 text-sm text-ink" />
        </div>
      </details>
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="approved" className="btn btn-primary h-9">
          approve
        </button>
        <button type="submit" name="decision" value="rejected" className="btn btn-quiet h-9">
          skip
        </button>
        <Link href={item.href} className="btn btn-quiet h-9">
          open lead
        </Link>
      </div>
    </form>
  );
}

function Item({ item, now }: { item: TodayItem; now: number }) {
  return (
    <li className={cn("flex flex-col gap-2 border px-[18px] py-4", item.hot ? "border-accent bg-accent-wash" : "border-dashed border-line")}>
      <span className="tag flex flex-wrap items-center gap-2.5">
        <span className={item.hot ? "text-accent" : "text-ink"}>{item.label}</span>
        <span>{ago(item.at, now)}</span>
      </span>
      <span className="font-mono text-[15px] text-ink">{item.title}</span>
      {item.detail ? <span className="text-sm">{item.detail}</span> : null}
      {item.draft ? (
        <DraftActions item={item} />
      ) : (
        <span className="flex flex-wrap gap-2">
          <Link href={item.href} className="btn btn-primary h-9">
            {item.track === "replies" ? "answer" : "open"}
          </Link>
        </span>
      )}
    </li>
  );
}

export default function TodayPage({ searchParams }: { searchParams: { track?: string } }) {
  const db = getDb();
  const now = Date.now();
  const view = todayView(db, now);
  const track = TRACKS.includes(searchParams.track as Track) ? (searchParams.track as Track) : null;
  const items = track ? view.items.filter((i) => i.track === track) : view.items;
  const date = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" }).format(now).toLowerCase();
  const w = view.week;

  return (
    <div className="flex flex-col gap-10 lg:flex-row">
      <section className="flex min-w-0 max-w-[860px] flex-1 flex-col gap-[18px]">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-sm tracking-[0.12em]">{date}</span>
          <h1 className="text-[30px] font-semibold leading-tight">
            {view.counts.all === 0 ? "nothing needs you yet" : `${view.counts.all} thing${view.counts.all === 1 ? "" : "s"} need${view.counts.all === 1 ? "s" : ""} you today`}
          </h1>
          <p>emory never sends, posts or changes anything without you. these are waiting on a person.</p>
        </div>

        <nav aria-label="Filter by track" className="flex flex-wrap gap-2">
          {(["all", ...TRACKS] as const).map((t) => {
            const active = (t === "all" && !track) || t === track;
            return (
              <Link
                key={t}
                href={t === "all" ? "/today" : `/today?track=${t}`}
                aria-current={active ? "page" : undefined}
                className={cn("chip", active && "border-accent bg-accent text-accent-ink")}
              >
                {t} {view.counts[t]}
              </Link>
            );
          })}
        </nav>

        {items.length === 0 ? (
          <div className="flex flex-col gap-3 border border-dashed border-line p-6">
            <h2 className="text-lg font-semibold">{track ? `nothing waiting in ${track}` : "all clear"}</h2>
            <p>new leads, replies and fixes land here as emory finds them.</p>
            <Link href="/leads" className="btn self-start">
              find leads
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-[18px]">
            {items.map((item) => (
              <Item key={item.key} item={item} now={now} />
            ))}
          </ul>
        )}
      </section>

      <aside aria-label="Tracks this week" className="flex flex-col gap-1 lg:w-80 lg:shrink-0 lg:border-l lg:border-dashed lg:border-line lg:pl-6">
        <span className="pb-1.5 font-mono text-[13px] text-ink">tracks this week</span>
        {[
          { href: "/seo", head: w.siteScore === null ? "site · not audited" : `site · ${w.siteScore} / 100`, sub: `${w.siteIssues} open issues` },
          { href: "/leads", head: `leads · ${w.leadsFound} found`, sub: `${w.leadsScored} researched and scored` },
          { href: "/approvals", head: `outreach · ${w.sent} sent`, sub: `${w.replies} repl${w.replies === 1 ? "y" : "ies"}` },
          { href: "/content", head: `social · ${w.postsDrafted} posts drafted`, sub: "x and blog drafts to copy out" },
        ].map((s) => (
          <Link key={s.href} href={s.href} className="flex flex-col gap-0.5 border-t border-dashed border-line-soft py-3 last:border-b">
            <span className="font-mono text-ink">{s.head}</span>
            <span className="text-[13px]">{s.sub}</span>
          </Link>
        ))}
        <div className="mt-6 flex flex-col gap-1 border border-dashed border-line p-3">
          <span className="font-mono text-xs text-ink">last 24 hours, without you</span>
          <span className="text-[13px]">{view.overnight.length ? view.overnight.join(" · ") : "nothing yet."}</span>
        </div>
      </aside>
    </div>
  );
}
