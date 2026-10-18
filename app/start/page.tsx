import Link from "next/link";
import { startReportAction } from "@/app/report-actions";
import { SubmitButton } from "@/components/start/form-bits";
import { currentUser } from "@/lib/request-db";

export const dynamic = "force-dynamic";

const GETS = [
  { head: "seo defects", body: "ranked by how much they cost you in search, with the fix for each" },
  { head: "who to sell to", body: "your ideal customer, worked out from your own pages" },
  { head: "first moves", body: "fixes, leads and posts to start on this week" },
];

export default function StartPage({ searchParams }: { searchParams: { error?: string; website?: string } }) {
  const signedIn = Boolean(currentUser());
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex min-h-14 items-center gap-4 border-b border-dashed border-line px-6">
        <Link href="/" className="font-mono text-[15px] tracking-[0.26em] text-ink">
          emory
        </Link>
        <span className="font-mono text-xs">by xsentry labs</span>
        <div className="flex-1" />
        <Link href={signedIn ? "/today" : "/login"} className="font-mono text-[13px] hover:text-ink">
          {signedIn ? "back to today" : "sign in"}
        </Link>
      </header>

      <main className="flex max-w-[860px] flex-1 flex-col gap-[26px] px-6 py-16 md:px-14 md:py-[72px]">
        <span className="font-mono text-sm tracking-[0.12em]">001</span>
        <h1 className="text-[34px] font-semibold leading-[1.15] md:text-[44px]">
          your website in.
          <br />a growth plan out.
        </h1>
        <p className="max-w-[560px] text-lg">
          emory reads your site, finds what&apos;s hurting search, and works out who you should be selling to. free, about two minutes, no
          signup.
        </p>
        {searchParams.error ? (
          <p role="alert" className="max-w-[680px] border border-dashed border-danger/60 px-4 py-3 text-sm text-danger">
            {searchParams.error}
          </p>
        ) : null}
        <form action={startReportAction} aria-label="Audit a website" className="flex max-w-[680px] flex-wrap gap-2.5">
          <label htmlFor="website" className="sr-only">
            Website address
          </label>
          <input
            id="website"
            name="website"
            required
            autoFocus
            maxLength={300}
            defaultValue={searchParams.website ?? ""}
            placeholder="yourcompany.com"
            className="h-12 min-w-0 flex-[1_1_320px] border border-ink bg-field px-4 font-mono text-[17px] text-ink placeholder:text-mute"
          />
          <SubmitButton pendingLabel="starting...">audit my site</SubmitButton>
        </form>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3 pt-3">
          {GETS.map((g) => (
            <div key={g.head} className="flex flex-col gap-1 border border-dashed border-line p-4">
              <span className="font-mono text-ink">{g.head}</span>
              <span className="text-[13px]">{g.body}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
