import Link from "next/link";
import { updateProfile } from "@/app/actions";
import { addMemoryAction, deleteMemoryAction, editMemoryAction, suppressAction, unsuppressAction } from "@/app/govern-actions";
import { SubmitButton } from "@/components/start/form-bits";
import { listMemory, type MemoryKind } from "@/lib/memory";
import { getBusiness, getProfile } from "@/lib/repo";
import { getDb } from "@/lib/request-db";
import { listSuppressions } from "@/lib/suppress";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const SECTIONS = [
  { id: "brand", label: "brand profile" },
  { id: "voice", label: "voice" },
  { id: "proof", label: "proof points" },
  { id: "worked", label: "what worked" },
  { id: "cta", label: "call to action" },
  { id: "dnc", label: "do not contact" },
] as const;
type Section = (typeof SECTIONS)[number]["id"];

const COPY: Record<MemoryKind, { title: string; intro: string; placeholder: string }> = {
  voice: {
    title: "voice · learned from your edits",
    intro: "when you edit a draft before approving it, emory writes down the rule the edit teaches. edit or delete any of them.",
    placeholder: 'e.g. sign emails as "maya", never "the team"',
  },
  proof: {
    title: "proof points",
    intro: "results and facts emory may cite. it never invents any, so anything not listed here stays out of emails and posts.",
    placeholder: "e.g. cut no-shows 30% at a 200-person 3pl (with their permission)",
  },
  worked: { title: "what worked", intro: "angles, subject lines and posts that got replies. emory leans on these.", placeholder: "e.g. leading with the night-shift problem gets replies from ops directors" },
  cta: { title: "call to action", intro: "how you want people to take the next step.", placeholder: "e.g. book a 30-minute demo: https://cal.com/you/demo" },
};

function Rules({ kind }: { kind: MemoryKind }) {
  const items = listMemory(getDb(), kind);
  const c = COPY[kind];
  return (
    <>
      <h1 className="text-[26px] font-semibold">{c.title}</h1>
      <p>{c.intro}</p>
      <ul>
        {items.length === 0 ? <li className="border-t border-dashed border-line py-4 text-sm">nothing yet.</li> : null}
        {items.map((m, i) => (
          <li key={m.id} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-t border-dashed border-line py-3.5 last:border-b", i === 0 && m.source.startsWith("from your edit") && "bg-accent-wash px-3.5 shadow-[inset_2px_0_0_var(--accent)]")}>
            <form action={editMemoryAction} className="flex min-w-0 flex-col gap-1">
              <input type="hidden" name="id" value={m.id} />
              <label htmlFor={`m${m.id}`} className="sr-only">
                Rule
              </label>
              <input id={`m${m.id}`} name="text" defaultValue={m.text} maxLength={500} className="w-full border-0 bg-transparent text-[15px] text-ink outline-none focus:bg-field" />
              <span className="font-mono text-xs">
                {m.source} · {new Date(m.updated_at).toISOString().slice(0, 10)}
              </span>
              <button type="submit" className="sr-only">
                Save
              </button>
            </form>
            <form action={deleteMemoryAction}>
              <input type="hidden" name="id" value={m.id} />
              <button type="submit" className="btn btn-quiet btn-sm">
                delete
              </button>
            </form>
          </li>
        ))}
      </ul>
      <form action={addMemoryAction} className="flex flex-wrap gap-2">
        <input type="hidden" name="kind" value={kind} />
        <label htmlFor="new" className="sr-only">
          New entry
        </label>
        <input id="new" name="text" required maxLength={500} placeholder={c.placeholder} className="h-10 min-w-0 flex-[1_1_320px] border border-line bg-field px-3 text-sm text-ink placeholder:text-mute" />
        <button type="submit" className="btn btn-quiet">
          + add
        </button>
      </form>
      <span className="text-xs">press enter in a line to save an edit; clear it to delete.</span>
    </>
  );
}

function Brand() {
  const db = getDb();
  const profile = getProfile(db);
  return (
    <>
      <h1 className="text-[26px] font-semibold">brand profile</h1>
      <p>what you sell and who it&apos;s for. every track reads this before it writes.</p>
      <form action={updateProfile} className="flex flex-col gap-4">
        {[
          { id: "offer", label: "what you offer", value: profile.offer, ph: "the service you provide and the outcome it delivers." },
          { id: "icp", label: "ideal customer", value: profile.icp, ph: "who needs this: industry, size, roles, trigger events, who isn't a fit." },
        ].map((f) => (
          <div key={f.id} className="flex flex-col gap-1.5">
            <label htmlFor={f.id} className="font-mono text-xs text-ink">
              {f.label}
            </label>
            <textarea id={f.id} name={f.id} rows={5} maxLength={3000} defaultValue={f.value} placeholder={f.ph} className="border border-line bg-field p-3 text-sm text-ink placeholder:text-mute" />
          </div>
        ))}
        <div>
          <SubmitButton pendingLabel="saving…">save</SubmitButton>
        </div>
      </form>
      <Link href="/setup/business" className="font-mono text-xs underline underline-offset-4 hover:text-ink">
        rebuild it from your website, a description and documents
      </Link>
    </>
  );
}

function DoNotContact() {
  const list = listSuppressions(getDb());
  return (
    <>
      <h1 className="text-[26px] font-semibold">do not contact</h1>
      <p>nobody here is emailed, followed up, added by a search or planned for, on any track. replies asking to stop are added automatically.</p>
      <form action={suppressAction} className="flex flex-wrap gap-2">
        <label htmlFor="value" className="sr-only">
          Email or domain
        </label>
        <input id="value" name="value" required maxLength={320} placeholder="person@company.com or company.com" className="h-10 min-w-0 flex-[1_1_260px] border border-line bg-field px-3 font-mono text-sm text-ink placeholder:text-mute" />
        <label htmlFor="reason" className="sr-only">
          Reason
        </label>
        <input id="reason" name="reason" maxLength={200} placeholder="reason (optional)" className="h-10 min-w-0 flex-[1_1_200px] border border-line bg-field px-3 text-sm text-ink placeholder:text-mute" />
        <button type="submit" className="btn">
          add
        </button>
      </form>
      <ul>
        {list.length === 0 ? <li className="border-t border-dashed border-line py-4 text-sm">nobody yet.</li> : null}
        {list.map((s) => (
          <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-dashed border-line py-3 last:border-b">
            <span className="flex flex-col">
              <span className="font-mono text-sm text-ink">
                {s.value}
                {s.kind === "domain" ? " · whole domain" : ""}
              </span>
              <span className="text-xs">
                {s.reason} · {new Date(s.created_at).toISOString().slice(0, 10)}
              </span>
            </span>
            <form action={unsuppressAction}>
              <input type="hidden" name="id" value={s.id} />
              <button type="submit" className="btn btn-quiet btn-sm">
                remove
              </button>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function MemoryPage({ searchParams }: { searchParams: { s?: string } }) {
  const db = getDb();
  const section: Section = (SECTIONS.find((x) => x.id === searchParams.s)?.id ?? "brand") as Section;
  const counts: Record<Section, number> = {
    brand: getProfile(db).offer ? 1 : 0,
    voice: listMemory(db, "voice").length,
    proof: listMemory(db, "proof").length,
    worked: listMemory(db, "worked").length,
    cta: listMemory(db, "cta").length,
    dnc: listSuppressions(db).length,
  };
  const profile = getProfile(db);
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-4 border-b border-dashed border-line pb-3">
        <span className="font-mono text-sm text-ink">/ memory</span>
        <div className="flex-1" />
        <span className="font-mono text-xs">every track reads this before it writes</span>
      </header>
      <div className="flex flex-col gap-8 lg:flex-row">
        <nav aria-label="Memory sections" className="flex flex-row flex-wrap lg:w-56 lg:shrink-0 lg:flex-col lg:border-r lg:border-dashed lg:border-line">
          {SECTIONS.map((s) => (
            <Link
              key={s.id}
              href={`/memory?s=${s.id}`}
              aria-current={s.id === section ? "true" : undefined}
              className={cn("flex justify-between gap-4 px-4 py-2.5 font-mono text-[13px] hover:bg-wash", s.id === section && "bg-accent-wash text-ink shadow-[inset_2px_0_0_var(--accent)]")}
            >
              <span>{s.label}</span>
              <span className="tnum">{s.id === "brand" ? "" : counts[s.id]}</span>
            </Link>
          ))}
        </nav>
        <main className="flex min-w-0 max-w-[900px] flex-1 flex-col gap-3">
          {section === "brand" ? <Brand /> : section === "dnc" ? <DoNotContact /> : <Rules kind={section} />}
        </main>
        <aside aria-label="Brand summary" className="flex flex-col gap-3 lg:w-80 lg:shrink-0 lg:border-l lg:border-dashed lg:border-line lg:pl-6">
          <span className="font-mono text-[13px] text-ink">what writers see</span>
          <p className="text-ink">{profile.offer.slice(0, 280) || "no offer written yet."}</p>
          <span className="font-mono text-xs">ideal customer</span>
          <p className="text-[13px]">{profile.icp.slice(0, 280) || "—"}</p>
          <span className="font-mono text-xs">rules in use</span>
          <p className="text-[13px]">
            {counts.voice} voice · {counts.proof} proof · {counts.worked} worked · {counts.cta} call to action
          </p>
          <div className="flex-1" />
          <span className="text-xs">website · {getBusiness(db).website.replace(/^https?:\/\//, "") || "not set"}</span>
        </aside>
      </div>
    </div>
  );
}
