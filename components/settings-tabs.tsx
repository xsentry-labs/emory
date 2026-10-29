import Link from "next/link";
import { cn } from "@/lib/utils";

export function SettingsHeader({ active }: { active: "account" | "team" }) {
  return (
    <header className="mb-6 flex flex-wrap items-center gap-x-6 border-b border-dashed border-line">
      <span className="font-mono text-sm text-ink">/ settings</span>
      <nav aria-label="Settings" className="flex gap-[22px]">
        {(["account", "team"] as const).map((t) => (
          <Link
            key={t}
            href={t === "account" ? "/settings" : "/settings/team"}
            aria-current={t === active ? "page" : undefined}
            className={cn("flex h-12 items-center border-b-2 font-mono text-[13px] hover:text-ink", t === active ? "border-accent text-ink" : "border-transparent")}
          >
            {t}
          </Link>
        ))}
      </nav>
    </header>
  );
}

const NOTICES: Record<string, string> = {
  "verify-sent": "verification email sent. check your inbox.",
  "verify-wait": "a verification email was sent recently. give it a few minutes.",
  "mail-failed": "we couldn't send email right now. try again later.",
  "password-changed": "password changed. you've been signed out everywhere else.",
  invited: "invite sent.",
  removed: "removed from the workspace.",
};

export function Flash({ notice, error }: { notice?: string; error?: string }) {
  if (error)
    return (
      <p role="alert" className="mb-4 border border-dashed border-danger/60 px-4 py-3 text-sm text-danger">
        {error}
      </p>
    );
  if (notice && NOTICES[notice]) return <p className="mb-4 border border-dashed border-line px-4 py-3 text-sm">{NOTICES[notice]}</p>;
  return null;
}
