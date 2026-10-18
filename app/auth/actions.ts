"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAccount, getAccountsDb, inviteCodeMatches, verifyLogin, type Account } from "@/lib/accounts";
import { getWorkspaceDb } from "@/lib/db";
import { kickoffTracks } from "@/lib/kickoff";
import { allow } from "@/lib/ratelimit";
import { claimReport, parseTracks } from "@/lib/report";
import { SESSION_COOKIE, SESSION_TTL_MS, sessionSecret, signSession } from "@/lib/session-token";

async function startSession(account: Account) {
  const secret = sessionSecret();
  if (!secret) throw new Error("Server is missing SESSION_SECRET.");
  cookies().set(SESSION_COOKIE, await signSession(secret, account.userId, account.workspaceId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

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
  const invite = process.env.INVITE_CODE;
  if (!invite) back("/signup", "Sign-ups are closed. Ask the owner to set an invite code.", report);
  if (!inviteCodeMatches(field(formData, "invite"), invite)) back("/signup", "That invite code is not valid.", report);
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
  const db = getWorkspaceDb(account.workspaceId);
  const claimed = Boolean(report) && claimReport(getAccountsDb(), report, account.workspaceId, db, parseTracks(formData.getAll("track").map(String)));
  if (claimed) kickoffTracks(db);
  redirect(claimed ? "/setup/connect" : "/start");
}

export async function logout() {
  cookies().delete(SESSION_COOKIE);
  redirect("/login");
}
