"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, RotateCcw, Save, X } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useHydrated } from "@/hooks/use-hydrated";
import { GOALS, VERTICALS, VOICE_SUGGESTIONS } from "@/lib/mock-data";
import { useWire } from "@/lib/store";
import type { CompanyProfile } from "@/lib/types";
import { cn, isValidDomain, normalizeDomain } from "@/lib/utils";

export function ProfileView() {
  const router = useRouter();
  const hydrated = useHydrated();
  const profile = useWire((state) => state.profile);
  const updateProfile = useWire((state) => state.updateProfile);
  const resetWire = useWire((state) => state.resetWire);

  const [draft, setDraft] = useState<CompanyProfile>(profile);
  const [voiceInput, setVoiceInput] = useState("");
  const [domainError, setDomainError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (hydrated) setDraft(profile);
  }, [hydrated, profile]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);

  function set<K extends keyof CompanyProfile>(key: K, value: CompanyProfile[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (key === "domain") setDomainError(null);
  }

  function addVoice(tag: string) {
    const clean = tag.trim();
    if (!clean) return;
    if (draft.voice.some((item) => item.toLowerCase() === clean.toLowerCase())) {
      setVoiceInput("");
      return;
    }
    setDraft((current) => ({ ...current, voice: [...current.voice, clean] }));
    setVoiceInput("");
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!isValidDomain(draft.domain)) {
      setDomainError("The masthead needs a real domain — acme.com, not a page title.");
      return;
    }
    if (draft.voice.length === 0) {
      toast({
        title: "The desks need a voice",
        description: "Add at least one voice tag or every draft comes back sounding like a brochure.",
        variant: "urgent",
      });
      return;
    }
    updateProfile({ ...draft, domain: normalizeDomain(draft.domain) });
    toast({
      title: "Profile filed",
      description: "The masthead, the strategy room and every desk are working from this now.",
      variant: "success",
    });
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        kicker="Editorial standing orders"
        title="Company Profile"
        standfirst="This is the page every desk reads first. Change it and the masthead, the strategy room and the language on every future filing change with it."
        actions={
          <Button variant="outline" onClick={() => setConfirmReset(true)}>
            <RotateCcw className="h-4 w-4" />
            Reset the wire
          </Button>
        }
      />

      <form onSubmit={save} className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="sheet overflow-hidden">
            <header className="border-b border-line bg-paper/60 px-6 py-3">
              <p className="font-mono text-2xs uppercase tracking-stamp text-wire-red">
                The masthead
              </p>
            </header>
            <div className="grid gap-6 p-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="domain">Domain we file for</Label>
                <Input
                  id="domain"
                  value={draft.domain}
                  onChange={(event) => set("domain", event.target.value)}
                  className="mt-2 font-mono"
                  aria-invalid={Boolean(domainError)}
                  aria-describedby={domainError ? "profile-domain-error" : undefined}
                />
                {domainError ? (
                  <p
                    id="profile-domain-error"
                    role="alert"
                    className="mt-2 font-mono text-2xs uppercase tracking-wire text-wire-red"
                  >
                    {domainError}
                  </p>
                ) : (
                  <p className="mt-2 font-mono text-2xs uppercase tracking-wire text-slate">
                    Shown in the masthead strip on every page
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="vertical">Vertical</Label>
                <select
                  id="vertical"
                  value={draft.vertical}
                  onChange={(event) => set("vertical", event.target.value)}
                  className="mt-2 h-10 w-full rounded-md border border-line bg-card px-3 text-base text-ink shadow-[inset_0_1px_2px_hsl(var(--ink)/0.05)] transition-colors hover:border-ink/25 focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15"
                >
                  {[draft.vertical, ...VERTICALS.filter((v) => v !== draft.vertical)].map(
                    (vertical) => (
                      <option key={vertical}>{vertical}</option>
                    ),
                  )}
                </select>
                <p className="mt-2 font-mono text-2xs uppercase tracking-wire text-slate">
                  Sets which desks lead the edition
                </p>
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="positioning">The one-line position</Label>
                <Textarea
                  id="positioning"
                  value={draft.positioning}
                  onChange={(event) => set("positioning", event.target.value)}
                  rows={3}
                  className="mt-2 font-display"
                />
                <p className="mt-2 font-mono text-2xs uppercase tracking-wire text-slate">
                  Every filed draft is written against this sentence
                </p>
              </div>
            </div>
          </section>

          <section className="sheet overflow-hidden">
            <header className="border-b border-line bg-paper/60 px-6 py-3">
              <p className="font-mono text-2xs uppercase tracking-stamp text-wire-red">
                Who we file for
              </p>
            </header>
            <div className="space-y-6 p-6">
              <div>
                <Label htmlFor="audience">Target audience</Label>
                <Textarea
                  id="audience"
                  value={draft.audience}
                  onChange={(event) => set("audience", event.target.value)}
                  rows={3}
                  className="mt-2"
                />
              </div>

              <div>
                <Label htmlFor="goal">Primary goal</Label>
                <select
                  id="goal"
                  value={draft.goal}
                  onChange={(event) => set("goal", event.target.value)}
                  className="mt-2 h-10 w-full rounded-md border border-line bg-card px-3 text-base text-ink shadow-[inset_0_1px_2px_hsl(var(--ink)/0.05)] transition-colors hover:border-ink/25 focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15"
                >
                  {[draft.goal, ...GOALS.filter((goal) => goal !== draft.goal)].map(
                    (goal) => (
                      <option key={goal}>{goal}</option>
                    ),
                  )}
                </select>
                <p className="mt-2 font-mono text-2xs uppercase tracking-wire text-slate">
                  What the desks optimise every filing against
                </p>
              </div>
            </div>
          </section>

          <section className="sheet overflow-hidden">
            <header className="border-b border-line bg-paper/60 px-6 py-3">
              <p className="font-mono text-2xs uppercase tracking-stamp text-wire-red">
                House voice
              </p>
            </header>
            <div className="p-6">
              <Label htmlFor="voice">Voice tags</Label>
              <ul className="mt-2 flex flex-wrap gap-2">
                <AnimatePresence initial={false}>
                  {draft.voice.map((tag) => (
                    <motion.li
                      key={tag}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.18 }}
                    >
                      <span className="flex items-center gap-1.5 rounded-sm border border-ink/20 bg-ink/[0.04] py-1 pl-2.5 pr-1 font-mono text-2xs uppercase tracking-wire text-ink">
                        {tag}
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              voice: current.voice.filter((item) => item !== tag),
                            }))
                          }
                          aria-label={`Remove ${tag} from the house voice`}
                          className="rounded-sm p-0.5 text-slate transition-colors hover:bg-wire-red/10 hover:text-wire-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    </motion.li>
                  ))}
                </AnimatePresence>
                {draft.voice.length === 0 ? (
                  <li className="font-mono text-2xs uppercase tracking-wire text-wire-red">
                    No voice on file — the desks will default to house-neutral
                  </li>
                ) : null}
              </ul>

              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Input
                  id="voice"
                  value={voiceInput}
                  placeholder="Add a voice tag — e.g. Deadpan"
                  onChange={(event) => setVoiceInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addVoice(voiceInput);
                    }
                  }}
                  className="sm:max-w-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => addVoice(voiceInput)}
                  disabled={!voiceInput.trim()}
                >
                  <Plus className="h-4 w-4" />
                  Add tag
                </Button>
              </div>

              <p className="mt-4 wire-label">Suggested by the strategy desk</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {VOICE_SUGGESTIONS.filter(
                  (suggestion) => !draft.voice.includes(suggestion),
                ).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => addVoice(suggestion)}
                    className="rounded-sm border border-dashed border-line bg-paper/40 px-2 py-1 font-mono text-2xs uppercase tracking-wire text-slate transition-colors hover:border-ink/40 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
                  >
                    + {suggestion}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Live proof that the profile is wired into the rest of the app. */}
        <div className="lg:sticky lg:top-28 lg:self-start">
          <section className="sheet overflow-hidden">
            <header className="border-b border-line bg-paper/60 px-6 py-3">
              <p className="font-mono text-2xs uppercase tracking-stamp text-wire-red">
                Masthead preview
              </p>
            </header>
            <div className="p-6">
              <p className="font-display text-4xl font-bold leading-none tracking-tighter text-ink">
                emory
              </p>
              <div className="rule-double my-3" />
              <p className="font-mono text-2xs uppercase tracking-wire text-slate">
                Filing for:{" "}
                <span className="text-ink">
                  {normalizeDomain(draft.domain) || "—"}
                </span>
              </p>
              <p className="mt-1 font-mono text-2xs uppercase tracking-wire text-slate">
                Beat: <span className="text-ink">{draft.vertical}</span>
              </p>
              <p className="mt-1 font-mono text-2xs uppercase tracking-wire text-slate">
                Voice:{" "}
                <span className="text-ink">
                  {draft.voice.length ? draft.voice.join(" · ") : "—"}
                </span>
              </p>
              <div className="rule my-4" />
              <p className="font-display text-base leading-relaxed text-ink-soft">
                {draft.positioning || "No position on file."}
              </p>
            </div>

            <div className="border-t border-line bg-paper/40 px-6 py-4">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={dirty ? "dirty" : "clean"}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className={cn(
                    "flex items-center gap-1.5 font-mono text-2xs uppercase tracking-wire",
                    dirty ? "text-wire-red" : "text-teletype-green",
                  )}
                >
                  {dirty ? (
                    "Unsaved changes — the desks have not seen these yet"
                  ) : (
                    <>
                      <Check className="h-3 w-3" />
                      Every desk is working from this
                    </>
                  )}
                </motion.p>
              </AnimatePresence>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button type="submit" disabled={!dirty}>
                  <Save className="h-4 w-4" />
                  Save changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDraft(profile)}
                  disabled={!dirty}
                >
                  Discard
                </Button>
              </div>
              <Button
                type="button"
                variant="quiet"
                size="wire"
                className="mt-3"
                onClick={() => router.push("/onboarding")}
              >
                File against a different site
              </Button>
            </div>
          </section>
        </div>
      </form>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reset the wire?</DialogTitle>
            <DialogDescription>
              Every approval, edit and spike from this edition is cleared, and the
              desks re-file the morning batch for {profile.domain}. Your profile
              and connected feeds stay as they are.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5">
            <p className="font-display text-base leading-relaxed text-ink-soft">
              Useful for a fresh demo run. There is no undo — but nothing here has
              ever left this browser.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>
              Leave it as it is
            </Button>
            <Button
              variant="red"
              onClick={() => {
                resetWire();
                setConfirmReset(false);
                toast({
                  title: "Wire reset",
                  description: "The desks have re-filed the morning edition. Nothing else changed.",
                });
              }}
            >
              Reset and re-file
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
