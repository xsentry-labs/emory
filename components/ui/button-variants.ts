import { cva } from "class-variance-authority";

/**
 * Button styles as a plain function, with no "use client" so server components
 * can style links like buttons. (Importing it from button.tsx would hand a
 * server component a client reference, which cannot be called.)
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-ink text-paper hover:bg-ink/88",
        outline: "border border-line bg-paper text-ink hover:border-ink/35 hover:bg-wash",
        ghost: "text-mute hover:bg-wash hover:text-ink",
        quiet: "text-mute underline-offset-4 hover:text-ink hover:underline",
        danger: "border border-danger/30 bg-paper text-danger hover:bg-danger hover:text-paper",
      },
      size: {
        default: "h-9 px-4 text-sm",
        sm: "h-8 px-3 text-caption",
        lg: "h-12 px-6 text-body",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
