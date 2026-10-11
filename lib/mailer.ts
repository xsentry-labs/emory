import nodemailer, { type Transporter } from "nodemailer";

export interface OutgoingEmail {
  to: string;
  from: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  references?: string[];
}

/** Sends one email and returns the Message-ID it went out with. */
export type Mailer = (email: OutgoingEmail) => Promise<{ messageId: string }>;

export interface SendConfig {
  /** e.g. smtps://user:pass@smtp.example.com:465 */
  smtpUrl: string;
  fromEmail: string;
  fromName: string;
  footer: string;
  dailyCap: number;
}

export function sendConfig(env: NodeJS.ProcessEnv = process.env): SendConfig | null {
  const smtpUrl = env.SMTP_URL?.trim();
  const fromEmail = env.FROM_EMAIL?.trim();
  if (!smtpUrl || !fromEmail) return null;
  const cap = Number(env.SEND_DAILY_CAP);
  return {
    smtpUrl,
    fromEmail,
    fromName: env.FROM_NAME?.trim() || "",
    // Postal address / opt-out line appended to every email (CAN-SPAM and similar rules).
    footer: (env.EMAIL_FOOTER ?? "").replace(/\\n/g, "\n").trim(),
    dailyCap: Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : 30,
  };
}

export const fromHeader = (c: Pick<SendConfig, "fromEmail" | "fromName">) =>
  c.fromName ? `"${c.fromName.replace(/"/g, "")}" <${c.fromEmail}>` : c.fromEmail;

let transport: Transporter | undefined;

export const smtpMailer =
  (cfg: SendConfig): Mailer =>
  async (email) => {
    transport ??= nodemailer.createTransport(cfg.smtpUrl);
    const info = await transport.sendMail({
      from: email.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      inReplyTo: email.inReplyTo,
      references: email.references,
    });
    return { messageId: info.messageId };
  };
