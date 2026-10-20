import Link from "next/link";
import type { ChartNode } from "@/lib/leads/people";
import { canEmail } from "@/lib/leads/people";
import { cn } from "@/lib/utils";

/**
 * Org chart as nested lists, connectors drawn in CSS (`.org` in globals.css).
 * A guessed reporting line is dashed; a confirmed one solid. Cards carry a
 * checkbox (name="person") so the chart can sit inside a form.
 */
export function OrgChart({ roots, accountId, selected, picked }: { roots: ChartNode[]; accountId: number; selected: number | null; picked: Set<number> }) {
  return (
    <div className="org min-w-max p-6">
      <ul>
        {roots.map((n) => (
          <Node key={n.person.id} node={n} accountId={accountId} selected={selected} picked={picked} />
        ))}
      </ul>
    </div>
  );
}

function Node({ node, accountId, selected, picked }: { node: ChartNode; accountId: number; selected: number | null; picked: Set<number> }) {
  const p = node.person;
  const replied = ["replied", "meeting", "won"].includes(p.status);
  const onlyChildGuess = node.children.length === 1 && !node.children[0].person.reports_verified;
  return (
    <li className={cn(p.reports_to !== null && !p.reports_verified && "guess")}>
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
        <ul className={cn(onlyChildGuess && "guess")}>
          {node.children.map((c) => (
            <Node key={c.person.id} node={c} accountId={accountId} selected={selected} picked={picked} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
