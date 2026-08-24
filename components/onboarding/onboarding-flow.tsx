"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { AGENT_BY_ID } from "@/lib/agents";
import { ONBOARDING_QUESTIONS, companyFromDomain, hydrate } from "@/lib/mock-data";
import { queued, useEmory } from "@/lib/store";
import { useHydrated } from "@/hooks/use-hydrated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { cn, confidenceLabel } from "@/lib/utils";

/** Emory proposes, the human corrects. Never present a blank form. */
export function OnboardingFlow() {
  const router = useRouter();
  const hydrated = useHydrated();
  const workspace = useEmory((state) => state.workspace);
  const connectors = useEmory((state) => state.connectors);
  const setConnector = useEmory((state) => state.setConnector);
  const finishOnboarding = useEmory((state) => state.finishOnboarding);
  const actions = useEmory((state) => state.actions);

  const questions = useMemo(
    () =>
      hydrate(ONBOARDING_QUESTIONS, companyFromDomain(workspace.domain), workspace.domain)
        .slice()
        // Least certain first: those are the ones worth a human's attention.
        .sort((a, b) => a.confidence - b.confidence),
    [workspace.domain],
  );

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [connecting, setConnecting] = useState<string | null>(null);

  const corrected = Object.entries(answers).filter(
    ([id, value]) => value !== questions.find((q) => q.id === id)?.answer,
  ).length;

  const connected = connectors.filter((connector) => connector.connected);
  const readyActions = queued(actions).slice(0, 3);

  function connect(id: string) {
    if (connecting) return;
    setConnecting(id);
    window.setTimeout(() => {
      setConnector(id, true);
      setConnecting(null);
    }, 900);
  }

  function finish() {
    finishOnboarding(answers);
    toast({
      title: "Emory is working",
      description:
        "Everything Emory has prepared is in your queue. Nothing runs until you approve it.",
    });
    router.push("/approvals");
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/" className="font-display text-h3 font-semibold text-ink">
            Emory
          </Link>
          <span className="text-caption text-mute">
            Step {step + 1} of 3 · {hydrated ? workspace.domain : ""}
          </span>
        </div>
        <div className="h-0.5 bg-line">
          <div
            className="h-full bg-ink transition-[width] duration-300"
            style={{ width: `${((step + 1) / 3) * 100}%` }}
          />
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-5 py-12">
        {step === 0 ? (
          <section>
            <h1 className="font-display text-section font-medium text-ink">
              Here&apos;s what Emory understood. Correct anything that&apos;s wrong.
            </h1>
            <p className="mt-3 max-w-measure text-body text-mute">
              Read from your site in under a minute. The least certain answers are first — those are
              the ones worth your time.
            </p>

            <ul className="mt-8 space-y-5">
              {questions.map((question) => {
                const value = answers[question.id] ?? question.answer;
                const changed = value !== question.answer;
                return (
                  <li key={question.id} className="rounded-lg border border-line p-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Label htmlFor={question.id} className="text-sm text-ink">
                        {question.question}
                      </Label>
                      <span className="flex items-center gap-2 text-caption text-mute">
                        <span className="inline-flex h-1.5 w-16 overflow-hidden rounded-full bg-line">
                          <span
                            className="h-full rounded-full bg-ink"
                            style={{ width: `${question.confidence}%` }}
                          />
                        </span>
                        {changed ? "Confirmed by you" : confidenceLabel(question.confidence)}
                      </span>
                    </div>
                    {question.multiline ? (
                      <Textarea
                        id={question.id}
                        rows={3}
                        value={value}
                        onChange={(event) =>
                          setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                        }
                        className="mt-3"
                      />
                    ) : (
                      <Input
                        id={question.id}
                        value={value}
                        onChange={(event) =>
                          setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                        }
                        className="mt-3"
                      />
                    )}
                    <p className="mt-2 text-caption text-mute">{question.origin}</p>
                  </li>
                );
              })}
            </ul>

            <div className="mt-8 flex items-center gap-4">
              <Button size="lg" onClick={() => setStep(1)}>
                This is right
                <ArrowRight className="h-4 w-4" />
              </Button>
              <span className="text-caption text-mute">
                {corrected > 0
                  ? `${corrected} corrected. Every agent writes from these.`
                  : "You can change any of it later on the Brain screen."}
              </span>
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section>
            <h1 className="font-display text-section font-medium text-ink">
              Connect what you already use.
            </h1>
            <p className="mt-3 max-w-measure text-body text-mute">
              Anything you skip is not a blocker. Emory works around it and asks again when an agent
              actually needs it.
            </p>

            <ul className="mt-8 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
              {connectors.map((connector) => (
                <li key={connector.id} className="flex items-start gap-4 bg-paper p-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">{connector.name}</p>
                    <p className="mt-1 text-caption text-mute">{connector.detail}</p>
                    <p className="mt-2 flex flex-wrap gap-1.5">
                      {connector.feeds.map((agentId) => (
                        <span
                          key={agentId}
                          className="inline-flex items-center gap-1 text-caption text-mute"
                        >
                          <span
                            aria-hidden
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ background: AGENT_BY_ID[agentId].hex }}
                          />
                          {AGENT_BY_ID[agentId].short}
                        </span>
                      ))}
                    </p>
                  </div>
                  {connector.connected ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-caption text-ink">
                      <Check className="h-3.5 w-3.5" />
                      Connected
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => connect(connector.id)}
                      disabled={connecting === connector.id}
                      className="shrink-0"
                    >
                      {connecting === connector.id ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Connecting
                        </>
                      ) : (
                        "Connect"
                      )}
                    </Button>
                  )}
                </li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button size="lg" onClick={() => setStep(2)}>
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
              <span className="text-caption text-mute">
                {connected.length} of {connectors.length} connected. Skipping is fine.
              </span>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section>
            <h1 className="font-display text-section font-medium text-ink">
              Emory found {readyActions.length} things it can fix now.
            </h1>
            <p className="mt-3 max-w-measure text-body text-mute">
              Approve what you want done. Nothing is published, sent or changed until you do.
            </p>

            <ul className="mt-8 space-y-3">
              {readyActions.map((action) => {
                const agent = AGENT_BY_ID[action.agentId];
                return (
                  <li key={action.id} className="flex gap-4 rounded-lg border border-line p-5">
                    <span
                      aria-hidden
                      className="w-[3px] shrink-0 rounded-full"
                      style={{ background: agent.hex }}
                    />
                    <div className="min-w-0">
                      <p className="text-body font-medium text-ink">{action.title}</p>
                      <p className="mt-1.5 max-w-measure text-sm text-mute">{action.why}</p>
                      <p className="mt-2 text-caption text-mute">
                        {action.impact.metric}: {action.impact.estimate}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Button size="lg" onClick={finish}>
                Take me to them
                <ArrowRight className="h-4 w-4" />
              </Button>
              <span className={cn("text-caption text-mute")}>
                This is the whole product: Emory proposes, you approve.
              </span>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
