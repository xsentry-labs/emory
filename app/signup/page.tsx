import Link from "next/link";
import { signup } from "@/app/auth/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { SubmitButton } from "@/components/start/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAccountsDb } from "@/lib/accounts";
import { getReport } from "@/lib/report";

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string; report?: string; email?: string; track?: string | string[] };
}) {
  const report = searchParams.report ? getReport(getAccountsDb(), searchParams.report) : null;
  const site = report?.site.replace(/^https?:\/\//, "");
  return (
    <AuthCard
      title="save your report"
      subtitle={site ? `create an account to keep the report for ${site} and start on it. you'll need an invite code.` : "you'll need an invite code to join."}
      error={searchParams.error}
      footer={
        <>
          already have an account?{" "}
          <Link href="/login" className="underline">
            log in
          </Link>
        </>
      }
    >
      <form action={signup} className="space-y-4">
        {report ? <input type="hidden" name="report" value={report.id} /> : null}
        {list(searchParams.track).map((t) => (
          <input key={t} type="hidden" name="track" value={t} />
        ))}
        <div className="space-y-1.5">
          <Label htmlFor="company">Company name</Label>
          <Input id="company" name="company" autoComplete="organization" maxLength={120} defaultValue={site ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={searchParams.email ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
          <p className="text-caption text-mute">At least 8 characters.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite">Invite code</Label>
          <Input id="invite" name="invite" autoComplete="off" required />
        </div>
        <SubmitButton pendingLabel="Creating account...">Create account</SubmitButton>
      </form>
    </AuthCard>
  );
}
