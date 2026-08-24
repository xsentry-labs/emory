"use client";

import { useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { AGENT_BY_ID } from "@/lib/agents";
import { useEmory } from "@/lib/store";
import { useHydrated } from "@/hooks/use-hydrated";
import { PageHead } from "@/components/page-head";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import type { Connector } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ConnectionsView() {
  const hydrated = useHydrated();
  const connectors = useEmory((state) => state.connectors);
  const reset = useEmory((state) => state.reset);

  const connected = connectors.filter((connector) => connector.connected);
  const categories = Array.from(new Set(connectors.map((connector) => connector.category)));

  if (!hydrated) return null;

  return (
    <div>
      <PageHead
        title="Connections"
        standfirst={`${connected.length} of ${connectors.length} connected. Anything not connected is not a blocker — Emory works around it and tells you when an agent actually needs it.`}
        actions={
          <Button
            variant="outline"
            onClick={() => {
              reset();
              toast({
                title: "Back to the start",
                description: "Approvals, edits and permissions are as they were on day one.",
              });
            }}
          >
            Reset this demo
          </Button>
        }
      />

      <div className="space-y-10">
        {categories.map((category) => (
          <section key={category}>
            <h2 className="border-b border-line pb-2 font-display text-h2 font-medium text-ink">
              {category}
            </h2>
            <ul className="mt-4 space-y-3">
              {connectors
                .filter((connector) => connector.category === category)
                .map((connector) => (
                  <ConnectorRow key={connector.id} connector={connector} />
                ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-10 max-w-measure text-caption text-mute">
        A connection that quietly dies looks exactly like a channel that stopped working, so Emory
        shows you the health of each one and asks you to reconnect before it goes dark.
      </p>
    </div>
  );
}

function ConnectorRow({ connector }: { connector: Connector }) {
  const setConnector = useEmory((state) => state.setConnector);
  const [pending, setPending] = useState(false);

  function toggle() {
    if (pending) return;
    const next = !connector.connected;
    setPending(true);
    window.setTimeout(() => {
      setPending(false);
      setConnector(connector.id, next);
      toast({
        title: next ? `${connector.name} connected` : `${connector.name} disconnected`,
        description: next
          ? "Emory reads from it within the hour."
          : "The agents that rely on it will say so rather than guess.",
      });
    }, 900);
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-lg border p-5 sm:flex-row sm:items-center",
        connector.health === "expiring" ? "border-agent-guard/40" : "border-line",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-medium text-ink">{connector.name}</span>
          <span className="text-caption text-mute">
            {connector.direction === "read"
              ? "Reads only"
              : connector.direction === "write"
                ? "Writes only"
                : "Reads and writes"}
          </span>
        </div>
        <p className="mt-1.5 max-w-measure text-sm text-mute">{connector.detail}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {connector.feeds.map((agentId) => (
            <span key={agentId} className="inline-flex items-center gap-1.5 text-caption text-mute">
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

      <div className="flex shrink-0 items-center gap-4 sm:w-64 sm:justify-end">
        <span
          className={cn(
            "flex items-center gap-1.5 text-caption",
            connector.health === "expiring" ? "text-agent-guard" : "text-mute",
          )}
        >
          {pending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Connecting
            </>
          ) : connector.health === "expiring" ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5" />
              {connector.healthNote}
            </>
          ) : connector.connected ? (
            <>
              <Check className="h-3.5 w-3.5" />
              {connector.healthNote}
            </>
          ) : (
            connector.healthNote
          )}
        </span>
        <Switch
          checked={connector.connected}
          onCheckedChange={toggle}
          disabled={pending}
          aria-label={`${connector.connected ? "Disconnect" : "Connect"} ${connector.name}`}
        />
      </div>
    </li>
  );
}
