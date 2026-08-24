"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DESKS } from "@/lib/mock-data";
import { useWire } from "@/lib/store";
import { cn, editionDate, isValidDomain, normalizeDomain } from "@/lib/utils";

const STAGES = [
  { label: "Reading your site…", detail: "4,180 URLs · sitemap, nav, pricing, blog" },
  { label: "Building your profile…", detail: "Positioning, ICP and house voice" },
  { label: "Waking the desks…", detail: "Eight desks on the beat" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const seed = useWire((state) => state.seed);
  const reduced = useReducedMotion();

  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(-1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const filing = stage >= 0;

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  function startFiling(event: React.FormEvent) {
    event.preventDefault();
    if (filing) return;

    if (!value.trim()) {
      setError("The desks need a domain before they can file anything.");
      return;
    }
    if (!isValidDomain(value)) {
      setError("That does not read like a domain. Try acme.com or https://acme.com.");
      return;
    }

    setError(null);
    seed(value);
    setStage(0);

    timers.current = [
      setTimeout(() => setStage(1), 700),
      setTimeout(() => setStage(2), 1_450),
      setTimeout(() => setStage(3), 2_150),
      setTimeout(() => router.push("/feed"), 2_450),
    ];
  }

  const domain = useMemo(() => normalizeDomain(value) || "your site", [value]);

  return (
    <div className="min-h-screen bg-paper newsprint">
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left: the counter where you hand over the domain. */}
        <div className="flex flex-col justify-between border-line px-6 py-10 md:px-12 md:py-14 lg:border-r">
          <div>
            <p className="font-display text-6xl font-bold leading-none tracking-tighter text-ink md:text-7xl">
              emory
            </p>
            <div className="rule-double mt-4" />
            <p className="mt-3 font-mono text-2xs uppercase tracking-stamp text-slate">
              The Daily Growth Wire · {editionDate()}
            </p>
          </div>

          <div className="max-w-xl py-12">
            <AnimatePresence mode="wait">
              {!filing ? (
                <motion.div
                  key="form"
                  initial={reduced ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tighter text-ink md:text-6xl">
                    Give us a domain.
                    <br />
                    The desks do the rest.
                  </h1>
                  <p className="mt-5 max-w-lg font-display text-xl leading-relaxed text-ink-soft">
                    Emory reads your site, writes your strategy, then puts eight
                    marketing desks on the beat. They file. You approve, edit or
                    spike. Nothing goes out without you.
                  </p>

                  <form onSubmit={startFiling} className="mt-10" noValidate>
                    <Label htmlFor="domain">Your website</Label>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                      <Input
                        id="domain"
                        autoFocus
                        placeholder="acme.com"
                        value={value}
                        aria-invalid={Boolean(error)}
                        aria-describedby={error ? "domain-error" : undefined}
                        onChange={(event) => {
                          setValue(event.target.value);
                          if (error) setError(null);
                        }}
                        className="h-12 flex-1 font-mono text-base"
                      />
                      <Button type="submit" size="lg" className="h-12 px-6">
                        Start filing
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 min-h-5">
                      {error ? (
                        <motion.p
                          id="domain-error"
                          role="alert"
                          initial={reduced ? false : { opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="font-mono text-2xs uppercase tracking-wire text-wire-red"
                        >
                          {error}
                        </motion.p>
                      ) : (
                        <p className="font-mono text-2xs uppercase tracking-wire text-slate">
                          No account needed for the demo edition · nothing is published without approval
                        </p>
                      )}
                    </div>
                  </form>
                </motion.div>
              ) : (
                <motion.div
                  key="filing"
                  initial={reduced ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <p className="font-mono text-2xs uppercase tracking-stamp text-wire-red">
                    Filing for
                  </p>
                  <h1 className="mt-2 font-display text-5xl font-bold leading-none tracking-tighter text-ink md:text-6xl">
                    {domain}
                  </h1>

                  <ul className="mt-10 space-y-5">
                    {STAGES.map((item, index) => {
                      const done = stage > index;
                      const active = stage === index;
                      return (
                        <motion.li
                          key={item.label}
                          initial={reduced ? false : { opacity: 0, x: -8 }}
                          animate={{
                            opacity: active || done ? 1 : 0.35,
                            x: 0,
                          }}
                          transition={{ duration: 0.3 }}
                          className="flex items-start gap-4"
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                              done
                                ? "border-teletype-green bg-teletype-green text-white"
                                : active
                                  ? "border-ink text-ink"
                                  : "border-line text-slate",
                            )}
                          >
                            {done ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : active ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <span className="h-1.5 w-1.5 rounded-full bg-line" />
                            )}
                          </span>
                          <span>
                            <span className="block font-display text-2xl font-semibold leading-snug tracking-tight text-ink">
                              {item.label}
                            </span>
                            <span className="mt-0.5 block font-mono text-2xs uppercase tracking-wire text-slate">
                              {item.detail}
                            </span>
                          </span>
                        </motion.li>
                      );
                    })}
                  </ul>

                  <div className="mt-10 h-0.5 w-full overflow-hidden rounded-full bg-line">
                    <motion.div
                      className="h-full bg-ink"
                      initial={{ width: "4%" }}
                      animate={{ width: `${Math.min(100, ((stage + 1) / 3) * 100)}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="font-mono text-2xs uppercase tracking-wire text-slate">
            Prototype edition · mock data · nothing leaves this browser
          </p>
        </div>

        {/* Right: the desk roster, so you know who is about to start filing. */}
        <div className="hidden flex-col justify-center gap-1 bg-card/60 px-12 py-14 lg:flex">
          <p className="font-mono text-2xs uppercase tracking-stamp text-slate">
            Desks on the beat
          </p>
          <div className="rule mt-3" />
          <ul>
            {DESKS.map((desk, index) => (
              <motion.li
                key={desk.id}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 * index }}
                className="border-b border-line/70 py-4"
              >
                <div className="flex items-center gap-3">
                  <span className={cn("h-2 w-2 rounded-full", desk.dot)} />
                  <span className="font-mono text-2xs uppercase tracking-wire text-ink">
                    {desk.tag}
                  </span>
                  <span
                    className={cn(
                      "ml-auto font-mono text-2xs uppercase tracking-wire",
                      filing ? "text-teletype-green" : "text-slate/60",
                    )}
                  >
                    {filing ? "on duty" : "standby"}
                  </span>
                </div>
                <p className="mt-1.5 pl-5 text-sm leading-snug text-ink-soft">
                  {desk.beat}
                </p>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
