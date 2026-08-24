"use client";

import { motion } from "framer-motion";
import { Printer, Send } from "lucide-react";
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
import type { StrategyDoc } from "@/lib/types";

export function DocReader({
  doc,
  open,
  onOpenChange,
}: {
  doc: StrategyDoc | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!doc) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <p className="font-mono text-2xs uppercase tracking-stamp text-wire-red">
            {doc.kind} · {doc.pages} pages
          </p>
          <DialogTitle className="text-3xl">{doc.title}</DialogTitle>
          <DialogDescription>{doc.summary}</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-6">
          <p className="font-mono text-2xs uppercase tracking-wire text-slate">
            {doc.updated}
          </p>
          <div className="rule mt-4" />
          <div className="mt-6 space-y-8">
            {doc.sections.map((section, index) => (
              <motion.section
                key={section.heading}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <h3 className="font-display text-xl font-semibold tracking-tight text-ink">
                  {section.heading}
                </h3>
                <div className="mt-3 space-y-3">
                  {section.paragraphs.map((paragraph, i) => (
                    <p
                      key={i}
                      className="font-display text-base leading-relaxed text-ink-soft"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
                {section.bullets ? (
                  <ul className="mt-4 space-y-2 border-l-2 border-line pl-4">
                    {section.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="font-display text-base leading-relaxed text-ink-soft"
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </motion.section>
            ))}
          </div>
          <p className="mt-10 text-center font-mono text-2xs uppercase tracking-stamp text-slate">
            — {doc.title} ends —
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="quiet"
            className="sm:mr-auto"
            onClick={() =>
              toast({
                title: "Sent to the print queue",
                description: `${doc.title} is formatted for the Monday packet.`,
              })
            }
          >
            <Printer className="h-4 w-4" />
            Print for the packet
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close the folder
          </Button>
          <Button
            onClick={() =>
              toast({
                title: "Circulated to the desks",
                description: `Every desk now files against ${doc.title.toLowerCase()}.`,
                variant: "success",
              })
            }
          >
            <Send className="h-4 w-4" />
            Circulate to the desks
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
