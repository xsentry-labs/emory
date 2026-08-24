"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWire } from "@/lib/store";
import { useHydrated } from "@/hooks/use-hydrated";

export default function Home() {
  const router = useRouter();
  const hydrated = useHydrated();
  const onboarded = useWire((state) => state.onboarded);

  useEffect(() => {
    if (!hydrated) return;
    router.replace(onboarded ? "/feed" : "/onboarding");
  }, [hydrated, onboarded, router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <p className="font-mono text-2xs uppercase tracking-stamp text-slate">
        Opening the wire…
      </p>
    </div>
  );
}
