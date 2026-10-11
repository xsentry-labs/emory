"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const MAX_WORDS = 5000;

export function SubmitButton({ children, pendingLabel }: { children: React.ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** Textarea with a live word count against the 5,000-word limit. */
export function DescriptionField({ id, name }: { id: string; name: string }) {
  const [text, setText] = useState("");
  const words = (text.trim().match(/\S+/g) ?? []).length;
  const over = words > MAX_WORDS;
  return (
    <div className="space-y-1.5">
      <Textarea
        id={id}
        name={name}
        rows={9}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What do you do, who do you do it for, and what results do you get them? Pricing, case studies, what makes you different, who is not a fit..."
        aria-invalid={over}
      />
      <p className={`tnum text-caption ${over ? "text-danger" : "text-mute"}`}>
        {words.toLocaleString()} / {MAX_WORDS.toLocaleString()} words
      </p>
    </div>
  );
}
