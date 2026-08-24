"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidDomain, normalizeDomain, useEmory } from "@/lib/store";
import { cn } from "@/lib/utils";

/**
 * The single most important component we own. Large, autofocused, forgiving of
 * input format. It is the only conversion action on the page.
 */
export function UrlField({
  autoFocus = false,
  size = "lg",
  className,
}: {
  autoFocus?: boolean;
  size?: "lg" | "md";
  className?: string;
}) {
  const router = useRouter();
  const runAudit = useEmory((state) => state.runAudit);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!value.trim()) {
      setError("Put your website in and Emory will read it.");
      return;
    }
    if (!isValidDomain(value)) {
      setError("That does not look like a website. Try yourcompany.com.");
      return;
    }
    runAudit(value);
    router.push(`/audit?site=${encodeURIComponent(normalizeDomain(value))}`);
  }

  return (
    <form onSubmit={submit} noValidate className={className}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          placeholder="yourcompany.com"
          aria-label="Your website"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "url-error" : undefined}
          className={cn("flex-1", size === "lg" && "h-13 text-lead")}
        />
        <Button type="submit" size={size === "lg" ? "lg" : "default"}>
          Analyse free
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
      <p
        id={error ? "url-error" : undefined}
        role={error ? "alert" : undefined}
        className={cn("mt-2 text-caption", error ? "text-agent-guard" : "text-mute")}
      >
        {error ?? "No signup. Results in 60 seconds."}
      </p>
    </form>
  );
}
