import type { Metadata } from "next";
import Link from "next/link";
import { Faq, type FaqItem } from "@/components/site/faq";
import { PlanCards } from "@/components/site/plan-cards";
import { PLAN_LIST, QUOTA_LABEL, type QuotaKind } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing | Emory",
  description: "Start free. Pay as your pipeline grows. Plans for leads, SEO audits and content.",
};

const FAQ: FaqItem[] = [
  {
    q: "What counts as a lead?",
    a: "A new lead Emory finds and adds to your list. Leads that are duplicates, or that we can't verify as real, are not counted.",
  },
  {
    q: "What are AI drafts and content?",
    a: "Outreach drafts you request on a single lead, re-research of a lead, blog topic ideas and articles, and X post batches. Drafts that Emory writes automatically for the leads it finds are included in the lead price.",
  },
  {
    q: "What happens if I hit a limit?",
    a: "You'll see a message saying which limit you reached. Nothing is lost; your existing leads and drafts stay available. Limits reset on the first of each month (UTC).",
  },
  {
    q: "How do I pay?",
    a: "During early access paid plans are set up and invoiced by hand. Use the button on a plan to get in touch. Card billing will come later.",
  },
  {
    q: "Can I change or cancel my plan?",
    a: "Yes, at any time. Changes apply from the next month.",
  },
];

const ROWS: { label: string; kind?: QuotaKind; text?: (id: string) => string }[] = [
  { label: QUOTA_LABEL.leads + " per month", kind: "leads" },
  { label: QUOTA_LABEL.seo + " per month", kind: "seo" },
  { label: QUOTA_LABEL.ai + " per month", kind: "ai" },
  { label: "Signal-based plays", text: () => "All" },
  { label: "You approve every message", text: () => "Yes" },
  { label: "Priority support", text: (id) => (id === "growth" || id === "scale" ? "Yes" : "-") },
  { label: "Multiple workspaces and seats", text: (id) => (id === "scale" ? "Yes" : "-") },
];

export default function PricingPage() {
  return (
    <>
      <section className="mx-auto max-w-shell px-4 pb-10 pt-14 text-center md:px-8 md:pt-20">
        <h1 className="font-display text-display font-medium">Start free. Pay as your pipeline grows.</h1>
        <p className="mx-auto mt-4 max-w-xl text-lead text-mute">Every plan includes reasons and sources for each lead, and your approval on every message.</p>
      </section>

      <section className="mx-auto max-w-shell px-4 pb-16 md:px-8">
        <PlanCards />
        <p className="mt-4 text-center text-caption text-mute">
          Prices in USD. Early access: paid plans are set up by hand.{" "}
          <Link href="/signup" className="underline">
            Start with Free
          </Link>
          .
        </p>
      </section>

      <section className="border-t border-line bg-wash py-14">
        <div className="mx-auto max-w-shell px-4 md:px-8">
          <h2 className="mb-6 font-display text-section font-medium">Compare plans</h2>
          <div className="overflow-x-auto rounded-lg border border-line bg-paper">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-line text-caption text-mute">
                <tr>
                  <th className="px-4 py-3 font-medium">&nbsp;</th>
                  {PLAN_LIST.map((p) => (
                    <th key={p.id} className="px-4 py-3 font-medium text-ink">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {ROWS.map((r) => (
                  <tr key={r.label}>
                    <th className="px-4 py-3 font-normal text-mute">{r.label}</th>
                    {PLAN_LIST.map((p) => (
                      <td key={p.id} className="tnum px-4 py-3">
                        {r.kind ? p.limits[r.kind].toLocaleString("en-US") + (p.id === "scale" ? "+" : "") : r.text?.(p.id)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <h2 className="mb-6 font-display text-section font-medium">Pricing questions</h2>
          <Faq items={FAQ} />
        </div>
      </section>
    </>
  );
}
