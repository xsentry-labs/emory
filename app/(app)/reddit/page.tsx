import { Lock } from "lucide-react";
import { PageHead } from "@/components/page-head";
import { Badge } from "@/components/ui/badge";

// Static, clearly-labelled sample. Nothing here is live data.
const SAMPLE = [
  {
    where: "r/startups",
    title: "Need a dev team to rebuild our MVP: any recommendations?",
    ask: "Founder asking for an agency to take over a broken prototype.",
    reply: "Happy to share what we look for when taking over an MVP. A few questions first: what stack is it on, and what is breaking?",
  },
  {
    where: "r/SaaS",
    title: "How do you handle migrating customers to a new billing system?",
    ask: "Operator describing a migration they have no capacity for.",
    reply: "We've seen this go wrong when invoices and entitlements migrate separately. A staged cutover usually works better; want me to outline it?",
  },
];

export default function RedditPage() {
  return (
    <>
      <PageHead
        title="Reddit agent"
        standfirst="Finds threads where someone is asking for the kind of help you provide, and drafts a helpful reply for you to post."
        actions={
          <Badge variant="outline">
            <Lock className="size-3.5" aria-hidden /> Locked
          </Badge>
        }
      />
      <p className="mb-6 max-w-measure text-mute">
        This agent isn&apos;t switched on yet. When it is, you&apos;ll review each thread and each reply before anything is posted, and you post it
        yourself from your own account, because automated posting gets accounts banned.
      </p>

      <h2 className="label mb-2">Example preview (not real data)</h2>
      <ul className="max-w-measure space-y-4 opacity-80" aria-label="Example preview">
        {SAMPLE.map((s) => (
          <li key={s.title} className="card space-y-2 p-4">
            <p className="text-caption text-mute">{s.where}</p>
            <p className="font-medium">{s.title}</p>
            <p className="text-sm text-mute">{s.ask}</p>
            <div className="rounded-md bg-wash p-3 text-sm">
              <p className="label mb-1">Drafted reply</p>
              {s.reply}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
