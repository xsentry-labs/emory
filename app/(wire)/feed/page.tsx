import { Suspense } from "react";
import { FeedView } from "@/components/feed/feed-view";

export const metadata = { title: "The Feed · Emory" };

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <p className="font-mono text-2xs uppercase tracking-stamp text-slate">
          Pulling the edition off the wire…
        </p>
      }
    >
      <FeedView />
    </Suspense>
  );
}
