"use client";

import { useEffect, useState } from "react";
import { editionDate } from "@/lib/utils";

/**
 * The edition line is "today" — which the server, prerendering at build time,
 * cannot know. Render it after mount so the paper and the browser agree.
 */
export function EditionDate({ suffix }: { suffix?: string }) {
  const [date, setDate] = useState<string | null>(null);
  useEffect(() => setDate(editionDate()), []);
  return (
    <>
      {date ?? "TODAY'S EDITION"}
      {suffix ? ` ${suffix}` : null}
    </>
  );
}
