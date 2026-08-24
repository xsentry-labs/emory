"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, Check, FileText, X } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { useHydrated } from "@/hooks/use-hydrated";
import { BRAND_VOICE, COMPETITORS, STRATEGY_DOCS, hydrate } from "@/lib/mock-data";
import { useWire } from "@/lib/store";
import type { StrategyDoc } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DocReader } from "./doc-reader";

export function StrategyView() {
  const hydrated = useHydrated();
  const profile = useWire((state) => state.profile);
  const [openDoc, setOpenDoc] = useState<StrategyDoc | null>(null);

  // Docs are written with {{brand}}/{{domain}} slots so they read as if the
  // strategy desk wrote them for this site specifically.
  const docs = useMemo(
    () => hydrate(STRATEGY_DOCS, profile.brand, profile.domain),
    [profile.brand, profile.domain],
  );

  const brand = hydrated ? profile.brand : "the brand";
  const domain = hydrated ? profile.domain : "your site";

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        kicker="Standing orders · circulated to every desk"
        title="Strategy Room"
        standfirst={`What the desks read before they file: who ${brand} is for, how ${brand} sounds, who else is in the race, and the plan the whole wire is working against.`}
        actions={
          <Button variant="outline" asChild>
            <Link href="/profile">Edit the profile</Link>
          </Button>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="sheet overflow-hidden">
          <header className="flex items-center justify-between border-b border-line bg-paper/60 px-6 py-3">
            <p className="font-mono text-2xs uppercase tracking-stamp text-wire-red">
              The house position
            </p>
            <p className="font-mono text-2xs uppercase tracking-wire text-slate">
              Filed for {domain}
            </p>
          </header>
          <div className="p-6">
            <blockquote className="border-l-2 border-ink pl-5">
              <p className="font-display text-2xl font-medium leading-snug tracking-tight text-ink md:text-3xl">
                “{hydrated ? profile.positioning : "Reading the site…"}”
              </p>
              <footer className="mt-3 font-mono text-2xs uppercase tracking-wire text-slate">
                Every filed draft is written against this sentence
              </footer>
            </blockquote>

            <dl className="mt-8 grid gap-6 sm:grid-cols-2">
              {[
                { term: "Vertical", detail: profile.vertical },
                { term: "Primary goal", detail: profile.goal },
                { term: "Who we file for", detail: profile.audience },
                {
                  term: "House voice",
                  detail: profile.voice.join(" · "),
                },
              ].map((row) => (
                <div key={row.term}>
                  <dt className="wire-label">{row.term}</dt>
                  <dd className="mt-1.5 font-display text-base leading-relaxed text-ink-soft">
                    {hydrated ? row.detail : "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="sheet overflow-hidden">
          <header className="border-b border-line bg-paper/60 px-6 py-3">
            <p className="font-mono text-2xs uppercase tracking-stamp text-wire-red">
              House voice · say this, not that
            </p>
          </header>
          <ul className="divide-y divide-line/70">
            {BRAND_VOICE.map((rule, index) => (
              <motion.li
                key={rule.do}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.04 }}
                className="space-y-2 px-6 py-4"
              >
                <p className="flex gap-2.5 font-display text-base leading-snug text-ink">
                  <Check className="mt-1 h-4 w-4 shrink-0 text-teletype-green" />
                  {rule.do}
                </p>
                <p className="flex gap-2.5 font-display text-base leading-snug text-slate line-through decoration-wire-red/40">
                  <X className="mt-1 h-4 w-4 shrink-0 text-wire-red no-underline" />
                  {rule.dont}
                </p>
              </motion.li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-2xs uppercase tracking-stamp text-wire-red">
              Competitor landscape
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
              Who else is filing on this beat
            </h2>
          </div>
          <p className="hidden max-w-sm text-xs leading-snug text-slate md:block">
            Share of voice measured across tracked queries and answer-engine
            citations. Refreshed with each nightly sweep.
          </p>
        </div>
        <div className="rule mt-4" />

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                {["Publication", "Positioning", "Share of voice", "Traffic", "Strength", "Soft spot"].map(
                  (head) => (
                    <th
                      key={head}
                      scope="col"
                      className="px-3 py-2 font-mono text-2xs uppercase tracking-wire text-slate first:pl-0 last:pr-0"
                    >
                      {head}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {COMPETITORS.map((rival, index) => (
                <motion.tr
                  key={rival.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="border-b border-line/70 align-top transition-colors hover:bg-card"
                >
                  <th scope="row" className="py-4 pr-3 text-left align-top">
                    <span className="block font-display text-lg font-semibold tracking-tight text-ink">
                      {rival.name}
                    </span>
                    <span className="mt-0.5 block font-mono text-2xs tracking-wire text-slate">
                      {rival.domain}
                    </span>
                  </th>
                  <td className="max-w-[14rem] px-3 py-4 text-sm leading-snug text-ink-soft">
                    {rival.positioning}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex items-center gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-line/70">
                        <motion.span
                          className="block h-full rounded-full bg-ink"
                          initial={{ width: 0 }}
                          animate={{ width: `${rival.shareOfVoice * 2}%` }}
                          transition={{ duration: 0.6, delay: 0.1 + index * 0.05 }}
                        />
                      </span>
                      <span className="font-mono text-sm tabular-nums text-ink">
                        {rival.shareOfVoice}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-4 font-mono text-sm tabular-nums text-ink-soft">
                    {rival.monthlyTraffic}
                  </td>
                  <td className="max-w-[15rem] px-3 py-4 text-sm leading-snug text-ink-soft">
                    {rival.strength}
                  </td>
                  <td className="max-w-[15rem] py-4 pl-3 text-sm leading-snug text-wire-red/90">
                    {rival.softSpot}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-mono text-2xs uppercase tracking-stamp text-wire-red">
              Standing documents
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">
              The folder every desk works from
            </h2>
          </div>
          <p className="hidden text-xs text-slate md:block">
            {docs.length} documents · open one to read it in full
          </p>
        </div>
        <div className="rule mt-4" />

        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {docs.map((doc, index) => (
            <motion.li
              key={doc.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
            >
              <button
                type="button"
                onClick={() => setOpenDoc(doc)}
                className={cn(
                  "group flex h-full w-full flex-col rounded-lg border border-line/80 bg-card p-5 text-left shadow-sheet transition-all duration-200",
                  "hover:-translate-y-0.5 hover:border-ink/25 hover:shadow-sheet-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
                )}
              >
                <span className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-slate" />
                  <span className="font-mono text-2xs uppercase tracking-wire text-slate">
                    {doc.kind} · {doc.pages}pp
                  </span>
                  <ArrowUpRight className="ml-auto h-4 w-4 text-slate transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ink" />
                </span>
                <span className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight text-ink">
                  {doc.title}
                </span>
                <span className="mt-2 flex-1 font-display text-base leading-relaxed text-ink-soft">
                  {doc.summary}
                </span>
                <span className="mt-4 border-t border-line pt-3 font-mono text-2xs uppercase tracking-wire text-slate">
                  {doc.updated}
                </span>
              </button>
            </motion.li>
          ))}
        </ul>
      </section>

      <DocReader
        doc={openDoc}
        open={Boolean(openDoc)}
        onOpenChange={(open) => {
          if (!open) setOpenDoc(null);
        }}
      />
    </div>
  );
}
