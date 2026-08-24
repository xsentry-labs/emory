"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-sans font-medium transition-[transform,background-color,color,box-shadow,border-color] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-40 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-ink text-paper shadow-sheet hover:bg-ink/90 hover:shadow-sheet-raised",
        outline:
          "border border-line bg-card text-ink shadow-sheet hover:border-ink/30 hover:bg-paper/60 hover:shadow-sheet-raised",
        ghost: "text-ink-soft hover:bg-ink/[0.06] hover:text-ink",
        red: "bg-wire-red text-white shadow-sheet hover:bg-wire-red/90 hover:shadow-sheet-raised",
        green:
          "bg-teletype-green text-white shadow-sheet hover:bg-teletype-green/90 hover:shadow-sheet-raised",
        quiet:
          "border border-transparent text-slate hover:border-line hover:bg-card hover:text-ink",
        link: "text-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 text-sm",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
        wire: "h-8 px-3 font-mono text-2xs uppercase tracking-wire",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
