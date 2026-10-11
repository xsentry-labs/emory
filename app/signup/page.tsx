import Link from "next/link";
import { signup } from "@/app/auth/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { SubmitButton } from "@/components/start/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage({ searchParams }: { searchParams: { error?: string; website?: string } }) {
  return (
    <AuthCard
      title="Create your account"
      subtitle={searchParams.website ? `We'll start with ${searchParams.website}. You'll need an invite code to join.` : "You'll need an invite code to join."}
      error={searchParams.error}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Log in
          </Link>
        </>
      }
    >
      <form action={signup} className="space-y-4">
        <input type="hidden" name="website" value={searchParams.website ?? ""} />
        <div className="space-y-1.5">
          <Label htmlFor="company">Company name</Label>
          <Input id="company" name="company" autoComplete="organization" maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
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
