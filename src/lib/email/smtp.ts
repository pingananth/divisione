import nodemailer, { type Transporter } from "nodemailer";
import type { EmailProvider, EmailMessage, SendResult } from "./types";

/**
 * Universal escape hatch. Amazon SES, Mailgun, Postmark, Zoho and Gmail all
 * expose SMTP, so any provider works through this adapter even without a
 * bespoke one — which is the point of keeping the provider pluggable.
 */
export function createSmtpProvider(env: Record<string, string | undefined>): EmailProvider {
  const host = env.SMTP_HOST;
  const user = env.SMTP_USER;
  const pass = env.SMTP_PASSWORD;
  const from = env.EMAIL_FROM;
  if (!host) throw new Error("SMTP_HOST is not set");
  if (!from) throw new Error("EMAIL_FROM is not set");

  const port = Number(env.SMTP_PORT ?? 587);

  let transporter: Transporter | null = null;
  const getTransport = () => {
    transporter ??= nodemailer.createTransport({
      host,
      port,
      // 465 is implicit TLS; 587 upgrades via STARTTLS.
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });
    return transporter;
  };

  return {
    name: "smtp",

    async verify() {
      try {
        await getTransport().verify();
        return { ok: true, detail: `SMTP connection to ${host}:${port} succeeded` };
      } catch (err) {
        return { ok: false, detail: `SMTP connection to ${host}:${port} failed: ${err}` };
      }
    },

    async send(message: EmailMessage): Promise<SendResult> {
      try {
        const info = await getTransport().sendMail({
          from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          replyTo: message.replyTo,
        });
        return { ok: true, providerMessageId: info.messageId ?? null };
      } catch (err: unknown) {
        // SMTP 5xx is a permanent rejection; 4xx is a temporary deferral.
        const code = (err as { responseCode?: number }).responseCode;
        const retryable = code === undefined || code < 500;
        return { ok: false, error: String(err), retryable };
      }
    },
  };
}
