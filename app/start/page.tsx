import { submitBusiness, submitWebsite } from "@/app/actions";
import { DescriptionField, SubmitButton } from "@/components/start/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isLlmConfigured } from "@/lib/llm";

export const dynamic = "force-dynamic";

const STEPS = ["Your website", "Your service", "Your leads"];

function Steps({ current }: { current: number }) {
  return (
    <ol className="mb-10 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
      {STEPS.map((label, i) => (
        <li key={label} className={`flex items-center gap-2 ${i + 1 === current ? "text-ink" : "text-mute"}`}>
          <span
            className={`tnum flex h-6 w-6 items-center justify-center rounded-full border text-caption ${
              i + 1 === current ? "border-ink bg-ink text-paper" : "border-line"
            }`}
          >
            {i + 1}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}

export default function StartPage({
  searchParams,
}: {
  searchParams: { step?: string; website?: string; error?: string };
}) {
  const step = searchParams.step === "2" ? 2 : 1;
  const website = searchParams.website ?? "";
  const ready = isLlmConfigured();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Steps current={step} />
      {!ready ? (
        <p className="mb-6 rounded-md border border-line bg-wash px-4 py-3 text-sm">
          Set <code>OPENROUTER_API_KEY</code> on the server to turn on lead finding, scoring and outreach.
        </p>
      ) : null}
      {searchParams.error ? (
        <p role="alert" className="mb-6 rounded-md border border-danger/30 px-4 py-3 text-sm text-danger">
          {searchParams.error}
        </p>
      ) : null}

      {step === 1 ? (
        <form action={submitWebsite} className="space-y-6">
          <div>
            <h1 className="font-display text-display font-medium">Find your next customers.</h1>
            <p className="mt-3 text-lead text-mute">
              Enter your website. We&apos;ll learn what you sell, find people who need it, rank them, and write the outreach.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="website">Your website</Label>
            <Input id="website" name="website" placeholder="yourcompany.com" autoFocus className="h-12 text-body" />
          </div>
          <SubmitButton pendingLabel="One moment...">Continue</SubmitButton>
          <p className="text-sm text-mute">
            No website yet?{" "}
            <a className="underline" href="/start?step=2">
              Describe your service instead
            </a>
            .
          </p>
        </form>
      ) : (
        <form action={submitBusiness} className="space-y-6">
          <input type="hidden" name="website" value={website} />
          <div>
            <h1 className="font-display text-display font-medium">Tell us about your service.</h1>
            <p className="mt-3 text-lead text-mute">
              The more we know, the better the leads and the sharper the outreach.
              {website ? ` We'll also read ${website}.` : ""}
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
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-paper file:px-3 file:py-1.5 file:text-sm"
            />
            <p className="text-caption text-mute">Decks, one-pagers, case studies. PDF, TXT, MD, CSV or HTML; up to 5 files, 5 MB each.</p>
          </div>
          <SubmitButton pendingLabel="Reading your business...">Find my leads</SubmitButton>
        </form>
      )}
    </div>
  );
}
