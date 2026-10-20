/** Shown while a page's data loads. Shapes only; no fake content. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex animate-pulse flex-col gap-4">
      <span className="sr-only">Loading…</span>
      <div className="h-12 border-b border-dashed border-line" />
      <div className="h-8 w-1/3 bg-wash" />
      <div className="h-24 border border-dashed border-line" />
      <div className="h-24 border border-dashed border-line" />
      <div className="h-24 border border-dashed border-line" />
    </div>
  );
}
