"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-render the server page on an interval while work is still running. */
export function AutoRefresh({ everyMs = 1500 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(t);
  }, [router, everyMs]);
  return null;
}
