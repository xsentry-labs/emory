import { cva } from "class-variance-authority";

/**
 * Button styles as a plain function, with no "use client" so server components
 * can style links like buttons. (Importing it from button.tsx would hand a
 * server component a client reference, which cannot be called.)
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-mono tracking-[0.03em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border border-accent bg-accent font-semibold text-accent-ink hover:bg-accent/90",
        outline: "border border-dashed border-ink/70 bg-transparent text-ink hover:bg-ink/10",
        ghost: "text-mute hover:bg-wash hover:text-ink",
        quiet: "text-mute underline-offset-4 hover:text-ink hover:underline",
        danger: "border border-dashed border-danger/60 bg-transparent text-danger hover:bg-danger/10",
      },
      size: {
        default: "h-10 px-4 text-[13px]",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
