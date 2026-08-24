"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Ink stamp, slapped on the corner of anything the desks flag as urgent. */
export function UrgentStamp({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      initial={reduced ? false : { opacity: 0, scale: 1.5, rotate: -14 }}
      animate={{ opacity: 1, scale: 1, rotate: -8 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "pointer-events-none select-none rounded-sm border-2 border-wire-red/60 px-2 py-0.5 font-mono text-2xs font-semibold uppercase tracking-stamp text-wire-red/90 shadow-[0_0_0_2px_hsl(var(--card))]",
        className,
      )}
    >
      Urgent
    </motion.span>
  );
}
