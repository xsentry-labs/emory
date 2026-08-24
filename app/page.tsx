import Link from "next/link";
import { AGENTS, COMPLETE_PRICING } from "@/lib/agents";
import { TIMELINE } from "@/lib/mock-data";
import { UrlField } from "@/components/url-field";
import { AgentChip } from "@/components/agent-chip";
import { ReplacementCalculator } from "@/components/replacement-calculator";
import { whenLong } from "@/lib/utils";

export default function LandingPage() {
  const example = TIMELINE.filter((event) => event.personId === "p-dana");

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-shell items-center justify-between px-6">
          <span className="font-display text-h3 font-semibold text-ink">Emory</span>
          <span className="text-caption text-mute">M-emory, by X-Sentry Labs</span>
        </div>
      </header>

      {/* Hero. One field, one action. */}
      <section className="mx-auto max-w-shell px-6 pb-18 pt-18 md:pt-30">
        <h1 className="max-w-4xl font-display text-hero font-medium text-ink">
          The only marketing team you&apos;ll need.
        </h1>
        <p className="mt-6 max-w-2xl text-lead text-mute">
          Eleven AI agents that get you found, talk to your customers, and close them.
          <br className="hidden sm:block" />
          One brain that learns your business and never forgets it.
        </p>
        <UrlField autoFocus className="mt-10 max-w-xl" />
      </section>

      {/* Eleven agents, visible on the same screen as the claim. */}
      <section className="border-t border-line bg-wash">
        <div className="mx-auto max-w-shell px-6 py-18">
          <h2 className="font-display text-section font-medium text-ink">
            Eleven agents. One brain. Everything marketing, in one place.
          </h2>
          <ul className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {AGENTS.map((agent) => (
              <li key={agent.id} className="flex flex-col gap-2 bg-paper p-5">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: agent.hex }}
                  />
                  <span className="text-sm font-medium text-ink">{agent.name}</span>
                  {agent.status === "activating" ? (
                    <span className="ml-auto text-caption text-mute">{agent.activating}</span>
                  ) : null}
                </span>
                <span className="text-sm text-mute">{agent.line}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The screen nobody else can render. */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-shell px-6 py-18">
          <h2 className="font-display text-section font-medium text-ink">
            One customer. Every touch. One screen.
          </h2>
          <p className="mt-3 max-w-measure text-body text-mute">
            Your rank tracker has the citation. Your CRM has the contact. Your chat tool has the
            conversation. None of them can show you the person.
          </p>
          <p className="mt-8 text-caption text-mute">
            An example, using the journey Emory reconstructs
          </p>
          <ol className="mt-3 overflow-hidden rounded-lg border border-line">
            {example.map((event, index) => (
              <li
                key={event.id}
                className={`flex flex-col gap-1 p-5 sm:flex-row sm:gap-6 ${index % 2 ? "bg-wash" : "bg-paper"}`}
              >
                <span className="w-40 shrink-0 text-caption text-mute">{whenLong(event.at)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <AgentChip id={event.agentId} />
                    <span className="text-caption text-mute">· {event.channel}</span>
                  </span>
                  <span className="mt-1 block text-body text-ink">{event.title}</span>
                </span>
                {event.value ? (
                  <span className="shrink-0 text-caption font-medium tabular-nums text-ink">
                    {event.value}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Their line items, their total, our price. */}
      <section className="border-t border-line bg-wash">
        <div className="mx-auto max-w-shell px-6 py-18">
          <h2 className="font-display text-section font-medium text-ink">
            Here&apos;s what you&apos;re paying now. Here&apos;s what it costs instead.
          </h2>
          <ReplacementCalculator />
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-shell px-6 py-18">
          <h2 className="font-display text-section font-medium text-ink">
            Two agents cost $228. All eleven cost $229.
          </h2>
          <p className="mt-3 max-w-measure text-body text-mute">
            Every agent is buyable on its own, from $29. The moment you need a second one, the
            arithmetic makes the decision for you.
          </p>
          <ul className="mt-10 grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3">
            {COMPLETE_PRICING.map((stage, index) => (
              <li key={stage.stage} className="bg-paper p-6">
                <p className="label">{index === 0 ? "Available now" : `Stage ${index + 1}`}</p>
                <p className="mt-2 font-display text-display font-medium text-ink tabular-nums">
                  {stage.price}
                  <span className="text-body text-mute"> a month</span>
                </p>
                <p className="mt-1 text-sm font-medium text-ink">Emory {stage.stage}</p>
                <p className="mt-2 text-sm text-mute">{stage.justifies}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line bg-ink">
        <div className="mx-auto max-w-shell px-6 py-18">
          <h2 className="font-display text-section font-medium text-paper">
            Start with your website.
          </h2>
          <p className="mt-3 max-w-measure text-body text-paper/70">
            Emory reads it, tells you what is broken and what it is costing you, and shows you which
            agent fixes each one. No signup, no card, no call.
          </p>
          <div className="mt-8 max-w-xl rounded-lg bg-paper p-5">
            <UrlField />
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-shell flex-col gap-2 px-6 py-8 text-caption text-mute sm:flex-row sm:items-center sm:justify-between">
          <span>Emory · M-emory, by X-Sentry Labs</span>
          <span>
            Prototype ·{" "}
            <Link href="/audit" className="underline-offset-4 hover:text-ink hover:underline">
              see an example analysis
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
