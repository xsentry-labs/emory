"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * A page that fails shows this in place, with the sidebar still there, so a
 * problem in one track never takes the others down.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div role="alert" className="flex max-w-xl flex-col gap-3 border border-dashed border-danger/60 p-6">
      <span className="tag text-danger">error · this page didn&apos;t load</span>
      <h1 className="text-xl font-semibold">something went wrong here</h1>
      <p>the rest of emory is fine. try again, or go back to today.{error.digest ? ` (ref ${error.digest})` : ""}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="btn btn-primary">
          try again
        </button>
        <Link href="/today" className="btn btn-quiet">
          back to today
        </Link>
      </div>
    </div>
  );
}
