"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { acceptInvite, changePassword, createInvite, deleteAccount, getUser, removeMember, revokeInvite } from "@/lib/account-admin";
import { getAccountsDb } from "@/lib/accounts";
import { dropWorkspaceDb } from "@/lib/db";
import { allow } from "@/lib/ratelimit";
import { currentUser } from "@/lib/request-db";
import { appUrl, endSession, startSession } from "@/lib/session";
import { inviteEmail, sendSystemEmail } from "@/lib/system-mail";

const id = z.coerce.number().int().positive();
const field = (fd: FormData, name: string) => String(fd.get(name) ?? "");
const msg = (err: unknown, fallback: string) => encodeURIComponent(err instanceof Error ? err.message : fallback);

function me() {
  const user = currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function changePasswordAction(formData: FormData) {
  const user = me();
  if (!allow(`pw:${user.userId}`, 10, 15 * 60_000)) redirect("/settings?error=Too+many+attempts.+Try+again+later.");
  try {
    changePassword(getAccountsDb(), user.userId, field(formData, "current"), field(formData, "next"));
  } catch (err) {
    redirect(`/settings?error=${msg(err, "Couldn't change the password.")}`);
  }
  // Every other session is now signed out; keep this one.
  await startSession({ userId: user.userId, workspaceId: user.workspaceId, email: "" });
  redirect("/settings?notice=password-changed");
}

export async function inviteAction(formData: FormData) {
  const user = me();
  if (!allow(`invite:${user.userId}`, 20, 60 * 60_000)) redirect("/settings/team?error=Too+many+invites.+Try+again+later.");
  try {
    const db = getAccountsDb();
    const inv = createInvite(db, user.userId, field(formData, "email"));
    const inviter = getUser(db, user.userId)!.email;
    await sendSystemEmail({ to: inv.email, ...inviteEmail(`${appUrl(headers())}/invite?token=${inv.token}`, inviter, inv.workspaceName) });
  } catch (err) {
    redirect(`/settings/team?error=${msg(err, "Couldn't send the invite.")}`);
  }
  redirect("/settings/team?notice=invited");
}

export async function revokeInviteAction(formData: FormData) {
  const user = me();
  revokeInvite(getAccountsDb(), user.userId, id.parse(formData.get("invite")));
  redirect("/settings/team");
}

export async function removeMemberAction(formData: FormData) {
  const user = me();
  try {
    removeMember(getAccountsDb(), user.userId, id.parse(formData.get("member")));
  } catch (err) {
    redirect(`/settings/team?error=${msg(err, "Couldn't remove them.")}`);
  }
  redirect("/settings/team?notice=removed");
}

/** Public: accept an invite, creating the account and signing in. */
export async function acceptInviteAction(formData: FormData) {
  const token = field(formData, "token");
  const ip = headers().get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (!allow(`accept:${ip}`, 10, 15 * 60_000)) redirect(`/invite?token=${encodeURIComponent(token)}&error=Too+many+attempts.`);
  let account;
  try {
    account = acceptInvite(getAccountsDb(), token, field(formData, "password"));
  } catch (err) {
    redirect(`/invite?token=${encodeURIComponent(token)}&error=${msg(err, "Couldn't accept the invite.")}`);
  }
  await startSession(account);
  redirect("/today");
}

export async function deleteAccountAction(formData: FormData) {
  const user = me();
  if (!allow(`delete:${user.userId}`, 5, 15 * 60_000)) redirect("/settings?error=Too+many+attempts.");
  const confirm = field(formData, "confirm").trim().toLowerCase();
  const u = getUser(getAccountsDb(), user.userId);
  if (!u || confirm !== u.email) redirect(`/settings?error=${encodeURIComponent("Type your email address exactly to confirm.")}`);
  try {
    const d = deleteAccount(getAccountsDb(), user.userId, field(formData, "password"));
    if (d.workspaceId) dropWorkspaceDb(d.workspaceId);
  } catch (err) {
    redirect(`/settings?error=${msg(err, "Couldn't delete the account.")}`);
  }
  endSession();
  redirect("/?deleted=1");
}
