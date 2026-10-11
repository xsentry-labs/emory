export interface FaqItem {
  q: string;
  a: string;
}

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-line rounded-lg border border-line">
      {items.map((i) => (
        <details key={i.q} className="group p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
            {i.q}
            <span className="text-mute transition-transform group-open:rotate-45" aria-hidden>
              +
            </span>
          </summary>
          <p className="mt-3 max-w-measure text-mute">{i.a}</p>
        </details>
      ))}
    </div>
  );
}
