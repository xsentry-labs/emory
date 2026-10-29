import Link from "next/link";
import { login } from "@/app/auth/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { SubmitButton } from "@/components/start/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage({ searchParams }: { searchParams: { error?: string; expired?: string } }) {
  return (
    <AuthCard
      title="Log in"
      subtitle={searchParams.expired ? "you were signed out (your password changed or your access did). log in again." : "Welcome back."}
      error={searchParams.error}
      footer={
        <>
          New here?{" "}
          <Link href="/signup" className="underline">
            Create an account
          </Link>
        </>
      }
    >
      <form action={login} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
          <Link href="/forgot" className="text-caption underline underline-offset-4">
            forgot your password?
          </Link>
        </div>
        <SubmitButton pendingLabel="Logging in...">Log in</SubmitButton>
      </form>
    </AuthCard>
  );
}
