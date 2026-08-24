import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-2xs uppercase tracking-wire transition-colors",
  {
    variants: {
      variant: {
        default: "border-line bg-paper/70 text-ink-soft",
        ink: "border-ink bg-ink text-paper",
        urgent: "border-wire-red/40 bg-wire-red/10 text-wire-red",
        live: "border-teletype-green/40 bg-teletype-green/10 text-teletype-green",
        approved: "border-teletype-green/30 bg-card text-teletype-green",
        outline: "border-line bg-transparent text-slate",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
