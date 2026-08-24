"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Plug, PlugZap } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DeskIcon } from "@/components/common/desk-icon";
import { toast } from "@/hooks/use-toast";
import { useHydrated } from "@/hooks/use-hydrated";
import { useWire } from "@/lib/store";
import type { Integration } from "@/lib/types";
import { cn } from "@/lib/utils";

export function IntegrationsView() {
  const hydrated = useHydrated();
  const integrations = useWire((state) => state.integrations);
  const connected = integrations.filter((item) => item.connected);

  const categories = Array.from(new Set(integrations.map((item) => item.category)));

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        kicker="Wire room · sources feeding the desks"
        title="Wire Room"
        standfirst="Every desk files better with a live feed behind it. Connect a source and the desk that depends on it starts filing against real numbers instead of estimates."
        actions={
          <div className="flex items-center gap-3 rounded-md border border-line bg-card px-4 py-2 shadow-sheet">
            <span className="font-mono text-2xs uppercase tracking-wire text-slate">
              Feeds live
            </span>
            <span className="font-mono text-xl tabular-nums text-ink">
              {hydrated ? connected.length : "–"}
              <span className="text-slate">/{integrations.length}</span>
            </span>
          </div>
        }
      />

      {!hydrated ? (
        <p className="font-mono text-2xs uppercase tracking-stamp text-slate">
          Checking which feeds are still open…
        </p>
      ) : (
        <div className="space-y-10">
          {categories.map((category) => (
            <section key={category}>
              <div className="flex items-end justify-between">
                <h2 className="font-mono text-2xs uppercase tracking-stamp text-wire-red">
                  {category}
                </h2>
                <p className="font-mono text-2xs uppercase tracking-wire text-slate">
                  {
                    integrations.filter(
                      (item) => item.category === category && item.connected,
                    ).length
                  }{" "}
                  of {integrations.filter((item) => item.category === category).length} live
                </p>
              </div>
              <div className="rule mt-3" />
              <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {integrations
                  .filter((item) => item.category === category)
                  .map((integration, index) => (
                    <IntegrationCard
                      key={integration.id}
                      integration={integration}
                      index={index}
                    />
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function IntegrationCard({
  integration,
  index,
}: {
  integration: Integration;
  index: number;
}) {
  const setIntegration = useWire((state) => state.setIntegration);
  const [pending, setPending] = useState(false);

  function toggle() {
    if (pending) return;
    const next = !integration.connected;
    setPending(true);
    // A short handshake so the flip reads as a connection, not a checkbox.
    window.setTimeout(() => {
      setPending(false);
      setIntegration(integration.id, next);
      toast({
        title: next ? "Feed open" : "Feed closed",
        description: next
          ? `${integration.name} is wired in. The desks that rely on it are filing against it from the next sweep.`
          : `${integration.name} is disconnected. Dispatches that need it will fall back to estimates.`,
        variant: next ? "success" : "default",
      });
    }, 900);
  }

  const status = pending
    ? "connecting"
    : integration.connected
      ? "live"
      : "offline";

  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.05, 0.3) }}
      className={cn(
        "group flex flex-col rounded-lg border bg-card p-5 shadow-sheet transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sheet-raised",
        integration.connected ? "border-teletype-green/40" : "border-line/80",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors",
            integration.connected
              ? "border-teletype-green/40 bg-teletype-green/10 text-teletype-green"
              : "border-line bg-paper/60 text-slate",
          )}
        >
          <DeskIcon name={integration.icon} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-semibold leading-tight tracking-tight text-ink">
            {integration.name}
          </h3>
          <p className="mt-0.5 font-mono text-2xs uppercase tracking-wire text-slate">
            {integration.blurb}
          </p>
        </div>
        <Switch
          checked={integration.connected}
          onCheckedChange={toggle}
          disabled={pending}
          aria-label={`${integration.connected ? "Disconnect" : "Connect"} ${integration.name}`}
        />
      </div>

      <p className="mt-4 flex-1 text-sm leading-relaxed text-ink-soft">
        {integration.detail}
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={status}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "flex items-center gap-1.5 font-mono text-2xs uppercase tracking-wire",
              status === "live"
                ? "text-teletype-green"
                : status === "connecting"
                  ? "text-ink"
                  : "text-slate",
            )}
          >
            {status === "connecting" ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Opening the line…
              </>
            ) : status === "live" ? (
              <>
                <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-teletype-green" />
                Feeding the desks
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-line" />
                Line closed
              </>
            )}
          </motion.span>
        </AnimatePresence>

        <Button variant="quiet" size="wire" onClick={toggle} disabled={pending}>
          {integration.connected ? (
            <>
              <Plug className="h-3 w-3" />
              Disconnect
            </>
          ) : (
            <>
              <PlugZap className="h-3 w-3" />
              Connect
            </>
          )}
        </Button>
      </div>
    </motion.li>
  );
}
