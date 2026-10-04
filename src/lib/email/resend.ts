import type { EmailProvider, EmailMessage, SendResult } from "./types";
import { classifyHttpFailure } from "./types";

export function createResendProvider(env: Record<string, string | undefined>): EmailProvider {
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  if (!from) throw new Error("EMAIL_FROM is not set");

  return {
    name: "resend",

    async verify() {
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.ok
        ? { ok: true, detail: "Resend API key accepted" }
        : { ok: false, detail: `Resend rejected the API key (HTTP ${res.status})` };
    },

    async send(message: EmailMessage): Promise<SendResult> {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [message.to],
            subject: message.subject,
            html: message.html,
            text: message.text,
            ...(message.replyTo ? { reply_to: message.replyTo } : {}),
          }),
        });

        if (!res.ok) return classifyHttpFailure(res.status, await res.text());
        const body = (await res.json()) as { id?: string };
        return { ok: true, providerMessageId: body.id ?? null };
      } catch (err) {
        // Network-level faults are always worth another attempt.
        return { ok: false, error: String(err), retryable: true };
      }
    },
  };
}
