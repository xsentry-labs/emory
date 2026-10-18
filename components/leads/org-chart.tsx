import Link from "next/link";
import type { ChartNode } from "@/lib/leads/people";
import { canEmail } from "@/lib/leads/people";
import { cn } from "@/lib/utils";

/**
 * Org chart as nested lists: each person's card, then their reports in a row
 * below. A guessed reporting line is drawn dashed; a confirmed one solid.
 * Cards carry a checkbox (name="person") so the chart can sit in a form.
 */
export function OrgChart({ roots, accountId, selected, picked }: { roots: ChartNode[]; accountId: number; selected: number | null; picked: Set<number> }) {
  return (
    <ul className="flex min-w-max justify-center gap-6 p-6">
      {roots.map((n) => (
        <Node key={n.person.id} node={n} accountId={accountId} selected={selected} picked={picked} />
      ))}
    </ul>
  );
}

function Node({ node, accountId, selected, picked }: { node: ChartNode; accountId: number; selected: number | null; picked: Set<number> }) {
  const p = node.person;
  const replied = ["replied", "meeting", "won"].includes(p.status);
  return (
    <li className="flex flex-col items-center">
      {p.reports_to !== null ? (
        <span aria-hidden className={cn("h-6 border-l-2", p.reports_verified ? "border-solid border-mute" : "border-dashed border-mute")} />
      ) : null}
      <div
        className={cn(
          "relative flex w-[220px] flex-col gap-0.5 border bg-wash px-3 py-2 text-xs has-[:checked]:border-2 has-[:checked]:border-accent has-[:checked]:bg-accent-wash",
          selected === p.id ? "border-ink" : "border-line",
        )}
      >
        <label className="absolute right-2 top-2">
          <span className="sr-only">Include {p.name} in the approach</span>
          <input type="checkbox" name="person" value={p.id} defaultChecked={picked.has(p.id)} className="size-4 accent-accent" />
        </label>
        <Link href={`/accounts/${accountId}?person=${p.id}`} className="pr-6 font-mono text-[13px] font-medium text-ink hover:underline">
          {p.name.toLowerCase()}
        </Link>
        <span>
          {p.title.toLowerCase() || "title unknown"}
          {replied ? " · replied" : ""}
          {!canEmail(p) ? (p.email_status === "guessed" ? " · email risky" : " · no email") : ""}
        </span>
        {p.buying_role ? <span className="mt-0.5 self-start border border-mute px-1.5 font-mono text-[10px] tracking-[0.08em] text-ink">{p.buying_role}</span> : null}
      </div>
      {node.children.length ? (
        <>
          <span aria-hidden className="h-6 border-l-2 border-mute" />
          <ul className="flex gap-4 border-t-2 border-mute">
            {node.children.map((c) => (
              <Node key={c.person.id} node={c} accountId={accountId} selected={selected} picked={picked} />
            ))}
          </ul>
        </>
      ) : null}
    </li>
  );
}
