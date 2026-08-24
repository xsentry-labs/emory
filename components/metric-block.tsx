import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/** Number, label, direction of travel. Four of these are the owner dashboard. */
export function MetricBlock({
  label,
  value,
  direction,
  note,
  className,
}: {
  label: string;
  value: string;
  direction?: "up" | "down" | "flat";
  note?: string;
  className?: string;
}) {
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  return (
    <div className={cn("min-w-0", className)} data-metric>
      <p className="label">{label}</p>
      <p className="mt-1.5 flex items-baseline gap-2 font-display text-display font-medium leading-none text-ink">
        {value}
        {direction ? <Icon className="h-4 w-4 shrink-0 text-mute" aria-hidden /> : null}
      </p>
      {note ? <p className="mt-2 text-caption leading-snug text-mute">{note}</p> : null}
    </div>
  );
}
