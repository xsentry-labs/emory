import Link from "next/link";
import { acceptInviteAction } from "@/app/account-actions";
import { AuthCard } from "@/components/auth/auth-card";
import { SubmitButton } from "@/components/start/form-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findInvite } from "@/lib/account-admin";
import { getAccountsDb } from "@/lib/accounts";

export const dynamic = "force-dynamic";

export default function InvitePage({ searchParams }: { searchParams: { token?: string; error?: string } }) {
  const token = searchParams.token ?? "";
  const invite = findInvite(getAccountsDb(), token);
  if (!invite) {
    return (
      <AuthCard
        title="this invite didn't work"
        subtitle="it may have expired or already been used. ask whoever invited you to send a new one."
        error={searchParams.error}
        footer={
          <Link href="/login" className="underline">
            log in
          </Link>
        }
      >
        <span />
      </AuthCard>
    );
  }
  return (
    <AuthCard
      title={`join ${invite.workspaceName.toLowerCase()}`}
      subtitle={`you were invited as ${invite.email}. set a password to join.`}
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
      <form action={acceptInviteAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={invite.email} readOnly />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={200} required autoFocus />
          <p className="text-caption">At least 8 characters.</p>
        </div>
        <SubmitButton pendingLabel="Joining...">Join the workspace</SubmitButton>
      </form>
    </AuthCard>
  );
}
