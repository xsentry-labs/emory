"use client";

import { motion } from "framer-motion";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import type { SeoIssue } from "@/lib/types";
import { SEVERITY } from "./severity";

export function FixDialog({
  issue,
  open,
  onOpenChange,
}: {
  issue: SeoIssue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!issue) return null;
  const severity = SEVERITY[issue.severity];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <p className={`font-mono text-2xs uppercase tracking-stamp ${severity.text}`}>
            {severity.label} · {issue.pages} page{issue.pages === 1 ? "" : "s"} affected
          </p>
          <DialogTitle>{issue.title}</DialogTitle>
          <DialogDescription>{issue.detail}</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-6">
          <p className="wire-label">The fix the tech desk filed</p>
          <p className="mt-2 font-display text-lg leading-relaxed text-ink">
            {issue.fix.summary}
          </p>

          <ol className="mt-6 space-y-3">
            {issue.fix.steps.map((step, index) => (
              <motion.li
                key={step}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.28, delay: index * 0.05 }}
                className="flex gap-3"
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line font-mono text-2xs tabular-nums text-slate">
                  {index + 1}
                </span>
                <span className="font-display text-base leading-relaxed text-ink-soft">
                  {step}
                </span>
              </motion.li>
            ))}
          </ol>

          {issue.fix.snippet ? (
            <div className="mt-6">
              <p className="wire-label">Template diff</p>
              <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-ink px-4 py-3 font-mono text-xs leading-relaxed text-paper">
                <code>{issue.fix.snippet}</code>
              </pre>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              toast({
                title: "Handed to engineering",
                description: `“${issue.title}” is queued with the fix and the crawl evidence attached.`,
                variant: "success",
              });
            }}
          >
            <ClipboardCheck className="h-4 w-4" />
            Hand to engineering
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
