import { cn } from "@/lib/utils";

export function PageHead({
  title,
  standfirst,
  actions,
  className,
}: {
  title: string;
  standfirst?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-measure">
        <h1 className="font-display text-section font-medium leading-tight text-ink">{title}</h1>
        {standfirst ? <p className="mt-2 text-body text-mute">{standfirst}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
