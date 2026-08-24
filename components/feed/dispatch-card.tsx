"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronDown,
  PencilLine,
  Radio,
  Send,
  Undo2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { toast } from "@/hooks/use-toast";
import { DESK_BY_ID } from "@/lib/mock-data";
import { useWire } from "@/lib/store";
import type { Dispatch } from "@/lib/types";
import { cn, filedAt } from "@/lib/utils";
import { UrgentStamp } from "./urgent-stamp";

export function DispatchCard({
  dispatch,
  index,
  highlighted,
  onEdit,
}: {
  dispatch: Dispatch;
  index: number;
  highlighted?: boolean;
  onEdit: (dispatch: Dispatch) => void;
}) {
  const desk = DESK_BY_ID[dispatch.deskId];
  const reduced = useReducedMotion();
  const approve = useWire((state) => state.approve);
  const pushLive = useWire((state) => state.pushLive);
  const spike = useWire((state) => state.spike);
  const restore = useWire((state) => state.restore);

  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState<"approved" | null>(null);

  /** Stamp first, then commit — the card confirms before it leaves the list. */
  function handleApprove() {
    if (confirming) return;
    setConfirming("approved");
    window.setTimeout(
      () => {
        approve(dispatch.id);
        toast({
          title: "Approved for the edition",
          description: `${desk.tag} filing is cleared. Push it live when you are ready.`,
          variant: "success",
        });
      },
      reduced ? 0 : 720,
    );
  }

  function handleLive() {
    pushLive(dispatch.id);
    toast({
      title: "Running on the wire",
      description: "Published. The desk will report back on how it lands.",
      variant: "success",
    });
  }

  function handleSpike() {
    spike(dispatch.id);
    toast({
      title: "Spiked",
      description: `Pulled from the edition: “${dispatch.headline}”`,
      action: (
        <ToastAction altText="Pull it back" onClick={() => restore(dispatch.id)}>
          Undo
        </ToastAction>
      ),
    });
  }

  const paragraphs = dispatch.body.split("\n").filter(Boolean);

  return (
    <motion.article
      layout={!reduced}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={
        reduced
          ? undefined
          : { opacity: 0, x: -24, height: 0, marginBottom: 0, transition: { duration: 0.28 } }
      }
      transition={{
        duration: 0.35,
        ease: [0.16, 1, 0.3, 1],
        delay: reduced ? 0 : Math.min(index * 0.045, 0.32),
      }}
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-card shadow-sheet transition-shadow duration-200 hover:shadow-sheet-raised",
        highlighted ? "border-wire-red ring-2 ring-wire-red/25" : "border-line/80",
      )}
    >
      {/* Desk colour bar down the gutter. */}
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-[3px]", desk.dot)}
      />

      <AnimatePresence>
        {confirming ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card/92 backdrop-blur-[1px]"
          >
            <motion.span
              initial={reduced ? false : { scale: 1.6, rotate: -16, opacity: 0 }}
              animate={{ scale: 1, rotate: -7, opacity: 1 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="rounded border-[3px] border-teletype-green px-4 py-1.5 font-mono text-lg font-semibold uppercase tracking-stamp text-teletype-green"
            >
              Approved
            </motion.span>
            <span className="font-mono text-2xs uppercase tracking-wire text-slate">
              Cleared for the edition
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="p-5 pl-6 md:p-6 md:pl-7">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", desk.dot)} />
            <span className={cn("font-mono text-2xs uppercase tracking-wire", desk.text)}>
              {desk.tag}
            </span>
          </span>
          <span aria-hidden className="text-line">
            /
          </span>
          <span className="font-mono text-2xs uppercase tracking-wire text-slate">
            {dispatch.kicker}
          </span>
          <span className="ml-auto flex items-center gap-2">
            {dispatch.editedAt ? (
              <Badge variant="outline" className="hidden sm:inline-flex">
                Edited by you
              </Badge>
            ) : null}
            {dispatch.status === "approved" ? (
              <Badge variant="approved">
                <Check className="h-3 w-3" />
                Approved
              </Badge>
            ) : null}
            {dispatch.status === "live" ? (
              <Badge variant="live">
                <Radio className="h-3 w-3" />
                On the wire
              </Badge>
            ) : null}
            <span className="font-mono text-2xs uppercase tracking-wire text-slate tabular-nums">
              {filedAt(dispatch.filedAt)}
            </span>
            {dispatch.priority === "urgent" && dispatch.status === "pending" ? (
              <UrgentStamp />
            ) : null}
          </span>
        </div>

        <h2 className="mt-3 font-display text-2xl font-semibold leading-tight tracking-tight text-ink md:text-3xl">
          {dispatch.headline}
        </h2>

        <div className="mt-3 max-w-3xl font-display text-base leading-relaxed text-ink-soft">
          <p className={cn(!expanded && "line-clamp-3")}>{paragraphs[0]}</p>
          <AnimatePresence initial={false}>
            {expanded && paragraphs.length > 1 ? (
              <motion.div
                initial={reduced ? false : { height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={reduced ? undefined : { height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                {paragraphs.slice(1).map((paragraph, i) => (
                  <p key={i} className="mt-3 whitespace-pre-wrap">
                    {paragraph}
                  </p>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="mt-2 inline-flex items-center gap-1 rounded font-mono text-2xs uppercase tracking-wire text-slate transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
          {expanded ? "Fold the filing" : "Read the full filing"}
          <ChevronDown
            className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")}
          />
        </button>

        <div className="mt-5 flex flex-wrap items-stretch gap-3">
          <div className="flex min-w-[13rem] flex-1 items-center gap-4 rounded-md border border-line bg-paper/60 px-4 py-3">
            <div className="min-w-0">
              <p className="wire-label">{dispatch.impact.label}</p>
              <p className="mt-0.5 font-mono text-xl font-medium tabular-nums text-ink">
                {dispatch.impact.value}
              </p>
            </div>
            <p className="min-w-0 flex-1 border-l border-line pl-4 text-xs leading-snug text-slate">
              {dispatch.impact.note}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 self-center">
            {dispatch.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-sm border border-line bg-paper/50 px-2 py-0.5 font-mono text-2xs uppercase tracking-wire text-slate"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <p className="mr-auto hidden max-w-[18rem] truncate font-mono text-2xs uppercase tracking-wire text-slate lg:block">
            Source: {dispatch.source}
          </p>

          {dispatch.status === "pending" ? (
            <>
              <Button onClick={handleApprove} disabled={Boolean(confirming)}>
                <Check className="h-4 w-4" />
                Approve &amp; publish
              </Button>
              <Button variant="outline" onClick={() => onEdit(dispatch)}>
                <PencilLine className="h-4 w-4" />
                Edit draft
              </Button>
              <Button variant="ghost" onClick={handleSpike}>
                <X className="h-4 w-4" />
                Spike
              </Button>
            </>
          ) : null}

          {dispatch.status === "approved" ? (
            <>
              <Button variant="green" onClick={handleLive}>
                <Send className="h-4 w-4" />
                Push to the wire
              </Button>
              <Button variant="outline" onClick={() => onEdit(dispatch)}>
                <PencilLine className="h-4 w-4" />
                Edit draft
              </Button>
              <Button variant="ghost" onClick={handleSpike}>
                <X className="h-4 w-4" />
                Spike
              </Button>
            </>
          ) : null}

          {dispatch.status === "live" ? (
            <>
              <Button variant="outline" onClick={() => setExpanded((value) => !value)}>
                {expanded ? "Fold the filing" : "Read the filing"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  useWire.getState().approve(dispatch.id);
                  toast({
                    title: "Pulled from the wire",
                    description: "Back in the approved queue. Nothing else changed.",
                  });
                }}
              >
                <Undo2 className="h-4 w-4" />
                Pull from the wire
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}
