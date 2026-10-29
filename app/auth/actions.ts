"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { finishPasswordReset, getUser, startPasswordReset, startVerification } from "@/lib/account-admin";
import { createAccount, getAccountsDb, inviteCodeMatches, verifyLogin, type Account } from "@/lib/accounts";
import { getWorkspaceDb } from "@/lib/db";
import { kickoffTracks } from "@/lib/kickoff";
import { allow } from "@/lib/ratelimit";
import { claimReport, parseTracks } from "@/lib/report";
import { currentUser } from "@/lib/request-db";
import { appUrl, endSession, startSession } from "@/lib/session";
import { resetEmail, sendSystemEmail, verifyEmail } from "@/lib/system-mail";

const clientKey = () => headers().get("x-forwarded-for")?.split(",")[0].trim() || "local";
const field = (fd: FormData, name: string) => String(fd.get(name) ?? "");
const back = (page: string, error: string, report = ""): never =>
  redirect(`${page}?error=${encodeURIComponent(error)}${report ? `&report=${encodeURIComponent(report)}` : ""}`);

export async function login(formData: FormData) {
  const email = field(formData, "email");
  if (!allow(`login:${clientKey()}`, 20, 15 * 60_000) || !allow(`login-email:${email.toLowerCase()}`, 8, 15 * 60_000)) {
    back("/login", "Too many attempts. Try again in a few minutes.");
  }
  const account = verifyLogin(getAccountsDb(), email, field(formData, "password"));
  if (!account) back("/login", "Wrong email or password.");
  await startSession(account!);
  redirect("/");
}

export async function signup(formData: FormData) {
  // A site report run before sign-up, to claim into the new workspace.
  const report = field(formData, "report").trim().slice(0, 40);
  if (!allow(`signup:${clientKey()}`, 10, 60 * 60_000)) back("/signup", "Too many attempts. Try again later.", report);
  // SIGNUPS_OPEN=true lets anyone sign up; otherwise an invite code is required.
  if (process.env.SIGNUPS_OPEN !== "true") {
    const invite = process.env.INVITE_CODE;
    if (!invite) back("/signup", "Sign-ups are closed. Ask the owner to set an invite code.", report);
    if (!inviteCodeMatches(field(formData, "invite"), invite)) back("/signup", "That invite code is not valid.", report);
  }
  let account: Account;
  try {
    account = createAccount(getAccountsDb(), {
      email: field(formData, "email"),
      password: field(formData, "password"),
      workspaceName: field(formData, "company"),
    });
  } catch (err) {
    return back("/signup", err instanceof Error ? err.message : "Could not create the account.", report);
  }
  await startSession(account);
  await sendVerification(account.userId, account.email);
  const db = getWorkspaceDb(account.workspaceId);
  const claimed = Boolean(report) && claimReport(getAccountsDb(), report, account.workspaceId, db, parseTracks(formData.getAll("track").map(String)));
  if (claimed) kickoffTracks(db);
  redirect(claimed ? "/setup/connect" : "/start");
}

/** Best effort: a failed verification email never blocks sign-up; it can be resent from settings. */
async function sendVerification(userId: number, email: string): Promise<boolean> {
  const token = startVerification(getAccountsDb(), userId);
  if (!token) return false;
  try {
    await sendSystemEmail({ to: email, ...verifyEmail(`${appUrl(headers())}/verify?token=${token}`) });
    return true;
  } catch (err) {
    console.error("[mail] verification not sent:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function forgotPassword(formData: FormData) {
  const email = field(formData, "email").trim().slice(0, 320);
  if (allow(`forgot:${clientKey()}`, 5, 60 * 60_000) && allow(`forgot-email:${email.toLowerCase()}`, 3, 60 * 60_000)) {
    const r = startPasswordReset(getAccountsDb(), email);
    if (r) {
      try {
        await sendSystemEmail({ to: r.email, ...resetEmail(`${appUrl(headers())}/reset?token=${r.token}`) });
      } catch (err) {
        console.error("[mail] reset not sent:", err instanceof Error ? err.message : err);
        back("/forgot", "We couldn't send email right now. Try again later.");
      }
    }
  }
  // Same answer whether or not the account exists, and when rate limited.
  redirect("/forgot?sent=1");
}

export async function resetPassword(formData: FormData) {
  const token = field(formData, "token");
  if (!allow(`reset:${clientKey()}`, 10, 15 * 60_000)) back(`/reset`, "Too many attempts. Try again in a few minutes.");
  let account: Account;
  try {
    account = finishPasswordReset(getAccountsDb(), token, field(formData, "password"));
  } catch (err) {
    return redirect(`/reset?token=${encodeURIComponent(token)}&error=${encodeURIComponent(err instanceof Error ? err.message : "Couldn't reset the password.")}`);
  }
  await startSession(account);
  redirect("/today?notice=password-reset");
}

export async function resendVerification() {
  const user = currentUser();
  if (!user) redirect("/login");
  const u = getUser(getAccountsDb(), user.userId);
  if (u && !u.email_verified_at && allow(`verify:${user.userId}`, 3, 60 * 60_000)) {
    const ok = await sendVerification(u.id, u.email);
    redirect(`/settings?notice=${ok ? "verify-sent" : "mail-failed"}`);
  }
  redirect("/settings?notice=verify-wait");
}

export async function logout() {
  endSession();
  redirect("/login");
}
