"use client";

import { Check, Copy, Mail } from "lucide-react";
import { useState } from "react";
import { markMessageSent } from "@/app/actions";
import { Button } from "@/components/ui/button";

/** Send an approved message from the user's own mail app: copy it, open it, then mark it sent. */
export function SendActions({
  id,
  to,
  subject,
  body,
}: {
  id: number;
  to: string;
  subject: string;
  body: string;
}) {
  const [copied, setCopied] = useState(false);
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${subject ? `Subject: ${subject}\n\n` : ""}${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the text is still on screen to select */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? <Check /> : <Copy />}
        {copied ? "Copied" : "Copy"}
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={mailto}>
          <Mail /> Open in mail app
        </a>
      </Button>
      <form action={markMessageSent}>
        <input type="hidden" name="id" value={id} />
        <Button type="submit" size="sm">
          Mark as sent
        </Button>
      </form>
    </div>
  );
}
