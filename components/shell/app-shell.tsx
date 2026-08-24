"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useEmory } from "@/lib/store";
import { useHydrated } from "@/hooks/use-hydrated";
import { MobileNav } from "./mobile-nav";
import { SideNav } from "./side-nav";
import { TopBar } from "./top-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const onboarded = useEmory((state) => state.onboarded);

  useEffect(() => {
    if (hydrated && !onboarded) router.replace("/");
  }, [hydrated, onboarded, router]);

  return (
    <div className="min-h-screen bg-paper">
      <SideNav />
      <div className="md:pl-62">
        <TopBar />
        <main className="mx-auto max-w-shell px-4 pb-24 pt-8 md:px-8 md:pb-16">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
