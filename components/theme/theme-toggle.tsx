"use client";

import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/** Flips data-theme on <html> and remembers the choice in a cookie the server reads on the next render. */
export function ThemeToggle({ initial, className }: { initial: Theme; className?: string }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const next: Theme = theme === "dark" ? "light" : "dark";
  const flip = () => {
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
  };
  const Icon = theme === "dark" ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={flip}
      aria-label={`Switch to ${next} theme`}
      className={cn("inline-flex size-9 items-center justify-center text-mute transition-colors hover:text-ink", className)}
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
