import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  note,
  tone = "ink",
  className,
}: {
  label: string;
  value: string | number;
  note?: string;
  tone?: "ink" | "green" | "red" | "slate";
  className?: string;
}) {
  const toneClass = {
    ink: "text-ink",
    green: "text-teletype-green",
    red: "text-wire-red",
    slate: "text-slate",
  }[tone];

  return (
    <div className={cn("min-w-0", className)}>
      <p className="wire-label">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-3xl font-medium leading-none tabular-nums tracking-tight",
          toneClass,
        )}
      >
        {value}
      </p>
      {note ? <p className="mt-1.5 text-xs leading-snug text-slate">{note}</p> : null}
    </div>
  );
}
