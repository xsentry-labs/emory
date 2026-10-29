import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { finishVerification } from "@/lib/account-admin";
import { getAccountsDb } from "@/lib/accounts";
import { currentUser } from "@/lib/request-db";

export const dynamic = "force-dynamic";

/** Opening the link confirms the email. Safe to reload: a used link just says so. */
export default function VerifyPage({ searchParams }: { searchParams: { token?: string } }) {
  const ok = finishVerification(getAccountsDb(), searchParams.token ?? "");
  const signedIn = Boolean(currentUser());
  return (
    <AuthCard
      title={ok ? "email confirmed" : "this link didn't work"}
      subtitle={ok ? "thanks. you can now invite your team." : "it may have expired or already been used. you can send a new one from settings."}
      footer={
        <Link href={signedIn ? (ok ? "/today" : "/settings") : "/login"} className="underline">
          {signedIn ? (ok ? "go to today" : "go to settings") : "log in"}
        </Link>
      }
    >
      <span />
    </AuthCard>
  );
}
