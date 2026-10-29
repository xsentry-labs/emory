import Link from "next/link";
import { resetPassword } from "@/app/auth/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { SubmitButton } from "@/components/start/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPage({ searchParams }: { searchParams: { token?: string; error?: string } }) {
  const token = searchParams.token ?? "";
  return (
    <AuthCard
      title="set a new password"
      subtitle="this signs you out everywhere else."
      error={searchParams.error}
      footer={
        <Link href="/forgot" className="underline">
          ask for a new link
        </Link>
      }
    >
      {token ? (
        <form action={resetPassword} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={200} required autoFocus />
            <p className="text-caption">At least 8 characters.</p>
          </div>
          <SubmitButton pendingLabel="Saving...">Set password and log in</SubmitButton>
        </form>
      ) : (
        <p>this link is missing its code. open the link from the email again.</p>
      )}
    </AuthCard>
  );
}
