import Link from "next/link";
import { submitBusiness } from "@/app/actions";
import { DescriptionField, SubmitButton } from "@/components/start/form-bits";
import { Label } from "@/components/ui/label";
import { isLlmConfigured } from "@/lib/llm";
import { getBusiness } from "@/lib/repo";
import { getDb } from "@/lib/request-db";

export const dynamic = "force-dynamic";

/** Tell Emory more than the website says: a description and documents sharpen the offer, ideal customer and leads. */
export default function BusinessPage({ searchParams }: { searchParams: { error?: string } }) {
  const website = getBusiness(getDb()).website;
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/today" className="font-mono text-base tracking-[0.26em] text-ink">
        emory
      </Link>
      {!isLlmConfigured() ? (
        <p className="mt-8 border border-dashed border-line px-4 py-3 text-sm">
          Set <code>OPENROUTER_API_KEY</code> on the server to turn on lead finding, scoring and outreach.
        </p>
      ) : null}
      {searchParams.error ? (
        <p role="alert" className="mt-8 border border-dashed border-danger/60 px-4 py-3 text-sm text-danger">
          {searchParams.error}
        </p>
      ) : null}
      <form action={submitBusiness} className="mt-10 space-y-6">
        <input type="hidden" name="website" value={website} />
        <div>
          <h1 className="text-[28px] font-semibold">tell emory about your service</h1>
          <p className="mt-3">
            the more it knows, the better the leads and the sharper the outreach.
            {website ? ` it will also read ${website.replace(/^https?:\/\//, "")}.` : ""}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="description">What you do, and who it&apos;s for</Label>
          <DescriptionField id="description" name="description" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="docs">Company documents (optional)</Label>
          <input
            id="docs"
            name="docs"
            type="file"
            multiple
            accept=".pdf,.txt,.md,.csv,.html,.htm"
            className="block w-full text-sm file:mr-3 file:border file:border-dashed file:border-line file:bg-transparent file:px-3 file:py-1.5 file:font-mono file:text-xs file:text-ink"
          />
          <p className="text-caption">Decks, one-pagers, case studies. PDF, TXT, MD, CSV or HTML; up to 5 files, 5 MB each.</p>
        </div>
        <SubmitButton pendingLabel="Reading your business...">Find my leads</SubmitButton>
      </form>
    </div>
  );
}
