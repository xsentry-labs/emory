"use client";

import { useEffect, useState } from "react";
import { useEmory } from "@/lib/store";

/** State lives in the browser, so the first render knows nothing. */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const api = useEmory.persist;
    if (!api) {
      setHydrated(true);
      return;
    }
    if (api.hasHydrated()) setHydrated(true);
    return api.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}
