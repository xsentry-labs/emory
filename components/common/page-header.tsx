import { cn } from "@/lib/utils";

export function PageHeader({
  kicker,
  title,
  standfirst,
  actions,
  className,
}: {
  kicker: string;
  title: string;
  standfirst: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-8", className)}>
      <div className="rule-double mb-4" />
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="font-mono text-2xs uppercase tracking-stamp text-wire-red">
            {kicker}
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold leading-none tracking-tighter text-ink md:text-5xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl font-display text-lg leading-relaxed text-ink-soft">
            {standfirst}
          </p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="rule mt-5" />
    </header>
  );
}
