"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-line bg-paper px-3 py-2 text-body text-ink transition-colors placeholder:text-mute/70 hover:border-ink/30 focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/12 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
