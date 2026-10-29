import nodemailer, { type Transporter } from "nodemailer";

/**
 * Account email (password resets, verification, invites). Deliberately not the
 * outreach mailbox: account mail must arrive even when outreach is paused, and
 * shouldn't share its sending reputation. Env: MAIL_URL (smtp[s]://…),
 * MAIL_FROM ("Emory <hello@yourdomain.com>").
 *
 * Without them, links are printed to the server log in development; in
 * production sending fails loudly so nobody waits for an email that never comes.
 */

export interface SystemEmail {
  to: string;
  subject: string;
  text: string;
}

export type SystemMailer = (email: SystemEmail) => Promise<void>;

export const systemMailConfigured = (env: Record<string, string | undefined> = process.env) => Boolean(env.MAIL_URL?.trim() && env.MAIL_FROM?.trim());

let transport: Transporter | undefined;

export const sendSystemEmail: SystemMailer = async (email) => {
  if (!systemMailConfigured()) {
    if (process.env.NODE_ENV === "production") throw new Error("Account email isn't set up on this server (MAIL_URL, MAIL_FROM).");
    console.log(`[mail] (not configured; printing instead)\nTo: ${email.to}\nSubject: ${email.subject}\n\n${email.text}\n`);
    return;
  }
  transport ??= nodemailer.createTransport(process.env.MAIL_URL!.trim());
  await transport.sendMail({ from: process.env.MAIL_FROM!.trim(), to: email.to, subject: email.subject, text: email.text });
};

const sign = "\n\n— Emory";

export const resetEmail = (link: string): Omit<SystemEmail, "to"> => ({
  subject: "Reset your Emory password",
  text: `Someone asked to reset the password for this Emory account. If it was you, set a new one here (the link works once, for one hour):\n\n${link}\n\nIf it wasn't you, ignore this email; your password hasn't changed.${sign}`,
});

export const verifyEmail = (link: string): Omit<SystemEmail, "to"> => ({
  subject: "Confirm your email for Emory",
  text: `Confirm this is your email address so Emory can send you account notices and you can invite your team:\n\n${link}\n\nThe link works for 7 days.${sign}`,
});

export const inviteEmail = (link: string, inviter: string, workspace: string): Omit<SystemEmail, "to"> => ({
  subject: `${inviter} invited you to ${workspace} on Emory`,
  text: `${inviter} invited you to join the ${workspace} workspace on Emory.\n\nAccept and set your password here (the link works for 7 days):\n\n${link}\n\nIf you weren't expecting this, ignore it.${sign}`,
});
