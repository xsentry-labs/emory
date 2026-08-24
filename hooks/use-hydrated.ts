"use client";

import { useEffect, useState } from "react";
import { useWire } from "@/lib/store";

/**
 * The wire lives in localStorage, so the first render knows nothing — on the
 * server the persist API is not even attached. Gate anything state-dependent
 * on this to keep hydration honest.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const api = useWire.persist;
    if (!api) {
      setHydrated(true);
      return;
    }
    if (api.hasHydrated()) setHydrated(true);
    return api.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}
