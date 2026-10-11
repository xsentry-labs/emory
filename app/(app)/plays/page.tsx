import { Lock, Zap } from "lucide-react";
import Link from "next/link";
import { runPlay } from "@/app/actions";
import { PageHead } from "@/components/page-head";
import { Button } from "@/components/ui/button";
import { isLlmConfigured } from "@/lib/llm";
import { getPipeline } from "@/lib/pipeline";
import { PLAYS, estimateCalls } from "@/lib/plays";
import { getBusiness } from "@/lib/repo";
import { getDb } from "@/lib/request-db";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function PlaysPage({ searchParams }: { searchParams: { error?: string } }) {
  const db = getDb();
  if (!getBusiness(db).onboardedAt) redirect("/start");
  const running = getPipeline(db).status === "running";
  const ready = isLlmConfigured();

  return (
    <>
      <PageHead
        title="Plays"
        standfirst="Each play hunts for one buying signal, so every lead comes with a reason to reach out now. Launch the ones that fit."
        actions={
          <Link href="/leads" className="text-sm text-mute underline">
            View all leads
          </Link>
        }
      />
      {searchParams.error ? (
        <p role="alert" className="mb-4 rounded-md border border-danger/30 px-4 py-3 text-sm text-danger">
          {searchParams.error}
        </p>
      ) : null}
      {running ? (
        <p className="mb-4 rounded-md border border-line bg-wash px-4 py-3 text-sm">
          A hunt is running.{" "}
          <Link href="/leads" className="underline">
            Watch the leads arrive
          </Link>
          .
        </p>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PLAYS.map((p) => (
          <li key={p.id} className={`card flex flex-col p-5 ${p.locked ? "bg-wash" : ""}`}>
            <div className="mb-3 flex items-center gap-2 text-mute">
              {p.locked ? <Lock className="size-4" aria-hidden /> : <Zap className="size-4" aria-hidden />}
              <span className="text-caption">{p.signal}</span>
            </div>
            <h2 className="font-display text-h3 font-medium">{p.title}</h2>
            <p className="mt-1.5 flex-1 text-sm text-mute">{p.blurb}</p>
            <div className="mt-5 flex items-center justify-between gap-3">
              {p.locked ? (
                <>
                  <span className="text-caption text-mute">Locked</span>
                  <Link href="/reddit" className="text-sm underline">
                    Preview
                  </Link>
                </>
              ) : (
                <>
                  <span className="tnum text-caption text-mute" title="One web search plus two model calls per lead">
                    ~{p.leads} leads · ~{estimateCalls(p)} AI calls
                  </span>
                  <form action={runPlay}>
                    <input type="hidden" name="play" value={p.id} />
                    <Button type="submit" size="sm" disabled={running || !ready}>
                      Run play
                    </Button>
                  </form>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!ready ? <p className="mt-4 text-sm text-mute">Set OPENROUTER_API_KEY on the server to run plays.</p> : null}
      <p className="mt-6 text-caption text-mute">Estimates are examples. Each run counts as one lead hunt toward your daily limit.</p>
    </>
  );
}
