import Link from "next/link";
import { forgotPassword } from "@/app/auth/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { SubmitButton } from "@/components/start/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPage({ searchParams }: { searchParams: { sent?: string; error?: string } }) {
  return (
    <AuthCard
      title="reset your password"
      subtitle={searchParams.sent ? "if there's an account for that email, a reset link is on its way. it works once, for one hour." : "enter your email and we'll send a link to set a new password."}
      error={searchParams.error}
      footer={
        <Link href="/login" className="underline">
          back to log in
        </Link>
      }
    >
      {searchParams.sent ? null : (
        <form action={forgotPassword} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </div>
          <SubmitButton pendingLabel="Sending...">Send reset link</SubmitButton>
        </form>
      )}
    </AuthCard>
  );
}
