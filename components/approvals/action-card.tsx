"use client";

import { useState } from "react";
import { Check, PencilLine, ShieldCheck, Undo2, X } from "lucide-react";
import { AGENT_BY_ID } from "@/lib/agents";
import { useEmory } from "@/lib/store";
import type { EmoryAction } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { cn, whenShort } from "@/lib/utils";
import { RISK } from "./risk";

/**
 * The approval queue unit: what, why, expected impact, owning agent colour,
 * and one tap to approve. This is the trust surface.
 */
export function ActionCard({ action }: { action: EmoryAction }) {
  const agent = AGENT_BY_ID[action.agentId];
  const approve = useEmory((state) => state.approve);
  const decline = useEmory((state) => state.decline);
  const undo = useEmory((state) => state.undo);
  const editProposed = useEmory((state) => state.editProposed);
  const promoteKind = useEmory((state) => state.promoteKind);
  const autonomy = useEmory((state) => state.autonomy);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(action.proposed);
  const [confirming, setConfirming] = useState(false);

  const settled = action.status !== "queued";

  function runApprove() {
    approve(action.id);
    toast({
      title: "Approved",
      description:
        action.risk === "low"
          ? `${agent.name} is doing it now. You can undo it from the queue.`
          : `${agent.name} is doing it now, and every step is reversible.`,
    });
  }

  function onApprove() {
    if (action.risk === "high") {
      setConfirming(true);
      return;
    }
    runApprove();
  }

  return (
    <article
      className={cn(
        "flex gap-4 rounded-lg border bg-paper p-5 transition-colors",
        settled ? "border-line/70 bg-wash" : "border-line",
      )}
    >
      <span
        aria-hidden
        className="w-[3px] shrink-0 rounded-full"
        style={{ background: agent.hex, opacity: settled ? 0.4 : 1 }}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-caption font-medium text-ink">{agent.name}</span>
          <span className="text-caption text-mute">{action.kindLabel}</span>
          <span className="text-caption text-mute">·</span>
          <span className="text-caption text-mute">{RISK[action.risk].label}</span>
          <span className="ml-auto text-caption text-mute">{whenShort(action.createdAt)}</span>
        </div>

        <h3 className="mt-2 text-lead font-medium leading-snug text-ink">{action.title}</h3>
        <p className="mt-2 max-w-measure text-sm text-mute">{action.why}</p>

        <dl className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <dt className="label">What Emory will do</dt>
            <dd className="mt-1.5 rounded-md border border-line bg-wash p-3 text-sm text-ink">
              {action.current ? (
                <p className="mb-2 text-mute line-through">{action.current}</p>
              ) : null}
              {editing ? (
                <div>
                  <Textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={5}
                    className="bg-paper text-sm"
                    aria-label="Edit what Emory will do"
                  />
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        editProposed(action.id, draft.trim());
                        setEditing(false);
                        toast({
                          title: "Your wording is saved",
                          description: "Emory will use yours, not its own.",
                        });
                      }}
                      disabled={draft.trim() === action.proposed}
                    >
                      Save wording
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDraft(action.proposed);
                        setEditing(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{action.proposed}</p>
              )}
              <p className="mt-2 text-caption text-mute">{action.target}</p>
            </dd>
          </div>
          <div className="sm:w-44">
            <dt className="label">Expected</dt>
            <dd className="mt-1.5">
              <p className="text-sm font-medium text-ink">{action.impact.estimate}</p>
              <p className="mt-0.5 text-caption text-mute">{action.impact.metric}</p>
            </dd>
          </div>
        </dl>

        {action.guard ? (
          <p className="mt-3 flex items-start gap-2 text-caption text-mute">
            <ShieldCheck
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              style={{ color: AGENT_BY_ID.guard.hex }}
              aria-hidden
            />
            <span>
              <span className="font-medium text-ink">Emory Guard</span> · {action.guard}
            </span>
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {settled ? (
            <>
              <span className="mr-auto inline-flex items-center gap-1.5 text-caption text-ink">
                <Check className="h-3.5 w-3.5" />
                {action.status === "declined"
                  ? "Declined. Emory will not raise it again."
                  : action.status === "approved"
                    ? "Approved — running now"
                    : `Done ${action.ranAt ? whenShort(action.ranAt) : ""}`}
              </span>
              {action.status !== "declined" && action.reversible ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    undo(action.id);
                    toast({
                      title: "Undone",
                      description: "Put back exactly as it was, and back in your queue.",
                    });
                  }}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Undo
                </Button>
              ) : null}
              {action.status === "declined" ? (
                <Button variant="ghost" size="sm" onClick={() => undo(action.id)}>
                  <Undo2 className="h-3.5 w-3.5" />
                  Put it back
                </Button>
              ) : null}
            </>
          ) : (
            <>
              <Button onClick={onApprove}>
                <Check className="h-4 w-4" />
                Approve
              </Button>
              <Button variant="outline" onClick={() => setEditing((value) => !value)}>
                <PencilLine className="h-4 w-4" />
                {editing ? "Stop editing" : "Change the wording"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  decline(action.id);
                  toast({
                    title: "Declined",
                    description: "Emory will not propose this one again.",
                  });
                }}
              >
                <X className="h-4 w-4" />
                No
              </Button>

              {action.risk === "low" && !autonomy[action.kind] ? (
                <button
                  type="button"
                  onClick={() => {
                    promoteKind(action.kind);
                    toast({
                      title: `Emory will handle ${action.kindLabel.toLowerCase()} on its own`,
                      description:
                        "Only this one kind of low-risk work, only from now on, and every change stays reversible.",
                    });
                  }}
                  className="ml-auto rounded text-caption text-mute underline-offset-4 transition-colors hover:text-ink hover:underline"
                >
                  Let Emory do {action.kindLabel.toLowerCase()} without asking
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{action.title}</DialogTitle>
            <DialogDescription>{RISK.high.note}</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-5">
            <p className="text-body text-ink">{action.proposed}</p>
            <p className="mt-3 text-sm text-mute">{action.target}</p>
            <p className="mt-4 text-sm text-mute">
              This is reversible, and Emory keeps a record of exactly what changed so it can be put
              back.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Not now
            </Button>
            <Button
              onClick={() => {
                setConfirming(false);
                runApprove();
              }}
            >
              Yes, do it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
