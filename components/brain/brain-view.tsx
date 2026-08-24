"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, PencilLine } from "lucide-react";
import { AGENT_BY_ID } from "@/lib/agents";
import { BRAIN_GROUPS } from "@/lib/mock-data";
import { useEmory } from "@/lib/store";
import { useHydrated } from "@/hooks/use-hydrated";
import { PageHead } from "@/components/page-head";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import type { BrainField } from "@/lib/types";
import { SOURCE_LABEL, cn, confidenceLabel, whenShort } from "@/lib/utils";

export function BrainView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const hydrated = useHydrated();

  const brain = useEmory((state) => state.brain);
  const changes = useEmory((state) => state.changes);
  const workspace = useEmory((state) => state.workspace);

  const view = params.get("view") === "changes" ? "changes" : "understanding";
  const setView = (next: string) =>
    router.replace(next === "changes" ? `${pathname}?view=changes` : pathname, { scroll: false });

  const confirmed = brain.filter((field) => field.source === "confirmed").length;

  if (!hydrated) return null;

  return (
    <div>
      <PageHead
        title="Brain"
        standfirst={`Everything Emory knows about ${workspace.company}, and where each piece came from. Correct anything — every agent writes from this the moment you do.`}
      />

      <Tabs value={view} onValueChange={setView} className="mb-8">
        <TabsList>
          <TabsTrigger value="understanding">
            What Emory understands
            <span className="tabular-nums text-mute">{brain.length}</span>
          </TabsTrigger>
          <TabsTrigger value="changes">
            What changed
            <span className="tabular-nums text-mute">{changes.length}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "understanding" ? (
        <div className="space-y-10">
          <p className="text-caption text-mute">
            {confirmed} of {brain.length} confirmed by you · last read from your site this morning
          </p>
          {BRAIN_GROUPS.map((group) => {
            const fields = brain.filter((field) => field.group === group.id);
            if (fields.length === 0) return null;
            return (
              <section key={group.id}>
                <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
                  <h2 className="font-display text-h2 font-medium text-ink">{group.label}</h2>
                  <p className="text-caption text-mute">{group.note}</p>
                </div>
                <ul className="mt-4 space-y-3">
                  {fields.map((field) => (
                    <BrainRow key={field.id} field={field} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <div>
          <p className="max-w-measure text-body text-mute">
            Emory rewrites its own understanding from what actually happens — a question asked in
            chat, an objection on a call, a competitor move. This is every change, and why.
          </p>
          <ol className="mt-6 space-y-3">
            {changes.map((entry) => {
              const agent = AGENT_BY_ID[entry.agentId];
              return (
                <li key={entry.id} className="flex gap-4 rounded-lg border border-line p-5">
                  <span
                    aria-hidden
                    className="w-[3px] shrink-0 rounded-full"
                    style={{ background: agent.hex }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-3 text-caption text-mute">
                      <span>{whenShort(entry.at)}</span>
                      <span className="font-medium text-ink">{entry.field}</span>
                      <span>{SOURCE_LABEL[entry.source]}</span>
                    </p>
                    <p className="mt-2 text-sm text-mute line-through">{entry.before}</p>
                    <p className="mt-1 text-body text-ink">{entry.after}</p>
                    <p className="mt-2 max-w-measure text-sm text-mute">{entry.why}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 text-caption text-mute">
            The same list arrives as a three-line email each week.
          </p>
        </div>
      )}
    </div>
  );
}

function BrainRow({ field }: { field: BrainField }) {
  const update = useEmory((state) => state.updateBrainField);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(field.value);

  function save() {
    update(field.id, draft.trim());
    setEditing(false);
    toast({
      title: "Emory has it",
      description: "Every agent writes from this now, and the change is on the record.",
    });
  }

  return (
    <li className="rounded-lg border border-line p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-ink">{field.label}</h3>
        <span className="flex items-center gap-3 text-caption text-mute">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-1.5 w-14 overflow-hidden rounded-full bg-line">
              <span
                className={cn("h-full rounded-full", field.confidence >= 70 ? "bg-ink" : "bg-mute")}
                style={{ width: `${field.confidence}%` }}
              />
            </span>
            {confidenceLabel(field.confidence)}
          </span>
          <span>{SOURCE_LABEL[field.source]}</span>
        </span>
      </div>

      {editing ? (
        <div className="mt-3">
          {field.multiline ? (
            <Textarea
              value={draft}
              rows={3}
              onChange={(event) => setDraft(event.target.value)}
              aria-label={field.label}
            />
          ) : (
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label={field.label}
            />
          )}
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={save} disabled={draft.trim() === field.value}>
              <Check className="h-3.5 w-3.5" />
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(field.value);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 max-w-measure text-body text-ink">{field.value}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-caption text-mute">{field.origin}</p>
        {editing ? null : (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            <PencilLine className="h-3.5 w-3.5" />
            Correct this
          </Button>
        )}
      </div>
    </li>
  );
}
