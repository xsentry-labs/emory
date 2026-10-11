import { Check } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { PLAN_LIST, formatPrice, type PlanDef } from "@/lib/pricing";
import { cn } from "@/lib/utils";

/** Where a plan's button goes. Paid plans are invoiced by hand in early access, so they open an email. */
function ctaHref(plan: PlanDef): string {
  if (plan.id === "free") return "/signup";
  const contact = process.env.CONTACT_EMAIL?.trim();
  return contact ? `mailto:${contact}?subject=${encodeURIComponent(`Emory ${plan.name} plan`)}` : "/signup";
}

export function PlanCards() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {PLAN_LIST.map((p) => (
        <li
          key={p.id}
          className={cn("card flex flex-col p-6", p.highlight && "border-ink shadow-pop")}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-h3 font-medium">{p.name}</h3>
            {p.highlight ? <span className="rounded bg-ink px-2 py-0.5 text-caption text-paper">Most popular</span> : null}
          </div>
          <p className="mt-1 min-h-10 text-sm text-mute">{p.tagline}</p>
          <p className="mt-4">
            <span className="tnum font-display text-display font-medium">{formatPrice(p)}</span>
            {p.price ? <span className="text-sm text-mute"> / month</span> : null}
          </p>
          <ul className="mt-5 flex-1 space-y-2 text-sm">
            {p.features.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href={ctaHref(p)}
            className={cn(buttonVariants({ variant: p.highlight ? "default" : "outline" }), "mt-6 w-full")}
          >
            {p.cta}
          </Link>
        </li>
      ))}
    </ul>
  );
}
