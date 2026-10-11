import { ArrowRight, Lock, PenLine, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Faq, type FaqItem } from "@/components/site/faq";
import { PlanCards } from "@/components/site/plan-cards";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { PLAYS } from "@/lib/plays";
import { getBusiness } from "@/lib/repo";
import { currentUser, getDb } from "@/lib/request-db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: "1", title: "Enter your website", body: "We read it to learn what you sell and who it is for." },
  { n: "2", title: "Tell us about your service", body: "Add a description or upload decks and case studies. The more we know, the sharper the leads." },
  { n: "3", title: "Watch your leads arrive", body: "A ranked table fills in with a reason, a source and a drafted email for every lead." },
];

const FAQ: FaqItem[] = [
  {
    q: "Does Emory send emails for me?",
    a: "You approve every message first. Today you then send it from your own mail app in one click, so it comes from your address and your reputation stays in your hands. Connecting your mailbox to send for you is on the roadmap.",
  },
  {
    q: "Where do the leads come from?",
    a: "From public web sources: tenders, job posts, funding news, launches and company sites. Every lead links to the page it came from. We don't sell lists, and we only keep an email if it is shown publicly, so you may need to add some yourself.",
  },
  {
    q: "How is this different from a lead database?",
    a: "A database gives you names. Emory gives you a reason to reach out now (an open RFP, a hire, a funding round), shows the evidence, scores the fit against your ideal customer, and drafts the message.",
  },
  {
    q: "Is my data private?",
    a: "Each customer's data lives in its own separate database. Other customers cannot see it.",
  },
  {
    q: "Which channels do you support?",
    a: "Email only, for now. LinkedIn links are included on leads so you can check the person, but Emory does not automate LinkedIn.",
  },
  {
    q: "Can I try it before paying?",
    a: "Yes. The Free plan includes 25 leads, an SEO audit and drafts. Early access is by invite, so you'll need an invite code to sign up.",
  },
];

export default function Landing() {
  const user = currentUser();
  if (user) redirect(getBusiness(getDb()).onboardedAt ? "/plays" : "/start");

  const signal = PLAYS.filter((p) => !p.locked);
  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-shell px-4 pb-16 pt-16 md:px-8 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-display text-hero font-medium">Find buyers who need you right now.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lead text-mute">
            Emory researches companies with a real reason to talk to you, shows you the proof, and drafts the message. You approve every email. Then it helps
            you get found, with SEO fixes and content.
          </p>
          <form action="/signup" method="get" className="mx-auto mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
            <Input
              name="website"
              placeholder="yourcompany.com"
              aria-label="Your website"
              className="h-12 flex-1 text-body"
              autoComplete="url"
            />
            <Button type="submit" size="lg" className="h-12">
              Find my leads <ArrowRight />
            </Button>
          </form>
          <p className="mt-3 text-caption text-mute">Free plan. No card needed. Early access is by invite.</p>
        </div>

        {/* Product mock: clearly an example */}
        <div className="mx-auto mt-14 max-w-4xl">
          <p className="label mb-2 text-center">Example of a lead</p>
          <div className="card overflow-hidden shadow-pop">
            <div className="grid gap-6 p-5 md:grid-cols-[1fr_1.2fr]">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-ink px-2 py-0.5 text-caption text-paper">A</span>
                  <span className="tnum font-medium">82</span>
                  <span className="text-caption text-mute">fit score</span>
                </div>
                <p className="font-medium">Priya Shah, Head of Engineering</p>
                <p className="text-mute">Northwind Logistics</p>
                <div className="flex gap-3 text-caption text-mute">
                  <span className="underline">Source</span>
                  <span className="underline">LinkedIn</span>
                </div>
                <p className="pt-2 text-sm text-mute">
                  <span className="font-medium text-ink">Why now:</span> Published an RFP to replace its legacy dispatch system; strong match to custom
                  software and integrations.
                </p>
              </div>
              <div className="rounded-md bg-wash p-4 text-sm">
                <p className="label mb-1">Drafted outreach</p>
                <p className="font-medium">Your dispatch system RFP</p>
                <p className="mt-1 text-mute">
                  Hi Priya, your RFP for a replacement dispatch system mentions integrating with existing carrier APIs, which is where these projects
                  usually slow down. We build and take custom software into production...
                </p>
                <p className="mt-3 text-caption text-mute">You review, edit and approve before anything is sent.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-line bg-wash py-16 md:py-20">
        <div className="mx-auto max-w-shell px-4 md:px-8">
          <h2 className="font-display text-section font-medium">From your website to a ranked list in minutes</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="card p-6">
                <span className="tnum flex size-8 items-center justify-center rounded-full bg-ink text-sm text-paper">{s.n}</span>
                <h3 className="mt-4 font-display text-h3 font-medium">{s.title}</h3>
                <p className="mt-1.5 text-mute">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Plays */}
      <section id="plays" className="py-16 md:py-20">
        <div className="mx-auto max-w-shell px-4 md:px-8">
          <h2 className="font-display text-section font-medium">Plays: leads with a reason to reach out now</h2>
          <p className="mt-2 max-w-measure text-lead text-mute">
            Each play hunts for one buying signal. Launch the ones that fit your business and every lead comes with the evidence.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {signal.map((p) => (
              <li key={p.id} className="card p-5">
                <p className="text-caption text-mute">{p.signal}</p>
                <h3 className="mt-1 font-display text-h3 font-medium">{p.title}</h3>
                <p className="mt-1.5 text-sm text-mute">{p.blurb}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Marketing */}
      <section id="marketing" className="border-t border-line bg-wash py-16 md:py-20">
        <div className="mx-auto max-w-shell px-4 md:px-8">
          <h2 className="font-display text-section font-medium">Get found, too</h2>
          <p className="mt-2 max-w-measure text-lead text-mute">Outbound finds buyers. Marketing brings them to you. Both live in the same workspace.</p>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            <li className="card p-6">
              <Search className="size-5" aria-hidden />
              <h3 className="mt-3 font-display text-h3 font-medium">SEO audit</h3>
              <p className="mt-1.5 text-sm text-mute">
                We crawl your site, score it, and write a prioritised fix plan with the titles, descriptions and schema ready to paste.
              </p>
            </li>
            <li className="card p-6">
              <PenLine className="size-5" aria-hidden />
              <h3 className="mt-3 font-display text-h3 font-medium">Blog and X posts</h3>
              <p className="mt-1.5 text-sm text-mute">Topic ideas your buyers search for, full draft articles, and a week of posts. You edit and publish.</p>
            </li>
            <li className="card bg-wash p-6">
              <Lock className="size-5" aria-hidden />
              <h3 className="mt-3 font-display text-h3 font-medium">Reddit agent</h3>
              <p className="mt-1.5 text-sm text-mute">Finds threads where people ask for exactly what you do and drafts a helpful reply. Coming soon.</p>
            </li>
          </ul>
        </div>
      </section>

      {/* Control */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-shell px-4 md:px-8">
          <h2 className="font-display text-section font-medium">You stay in control</h2>
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              ["Every message approved", "Nothing is sent until you have read and approved it. Emory never emails on its own."],
              ["Every lead sourced", "Each lead links to where it was found, with a short reason for the score. No black-box lists."],
              ["Your data stays yours", "Each customer has a separate database. We don't share or sell your leads."],
            ].map(([t, b]) => (
              <li key={t} className="flex gap-3">
                <ShieldCheck className="mt-1 size-5 shrink-0" aria-hidden />
                <div>
                  <h3 className="font-medium">{t}</h3>
                  <p className="mt-1 text-mute">{b}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-line bg-wash py-16 md:py-20">
        <div className="mx-auto max-w-shell px-4 md:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-section font-medium">Simple pricing</h2>
            <Link href="/pricing" className="text-sm underline">
              Compare plans
            </Link>
          </div>
          <PlanCards />
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <h2 className="mb-6 font-display text-section font-medium">Questions</h2>
          <Faq items={FAQ} />
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-line bg-ink py-16 text-paper">
        <div className="mx-auto max-w-3xl px-4 text-center md:px-8">
          <h2 className="font-display text-section font-medium">See who is ready to talk to you.</h2>
          <Link href="/signup" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "mt-6 text-ink")}>
            Start free
          </Link>
        </div>
      </section>
    </>
  );
}
