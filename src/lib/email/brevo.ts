import type { EmailProvider, EmailMessage, SendResult } from "./types";
import { classifyHttpFailure } from "./types";

export function createBrevoProvider(env: Record<string, string | undefined>): EmailProvider {
  const apiKey = env.BREVO_API_KEY;
  const from = env.EMAIL_FROM;
  const fromName = env.EMAIL_FROM_NAME ?? "Toastmasters District 229";
  if (!apiKey) throw new Error("BREVO_API_KEY is not set");
  if (!from) throw new Error("EMAIL_FROM is not set");

  return {
    name: "brevo",

    async verify() {
      const res = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": apiKey },
      });
      return res.ok
        ? { ok: true, detail: "Brevo API key accepted" }
        : { ok: false, detail: `Brevo rejected the API key (HTTP ${res.status})` };
    },

    async send(message: EmailMessage): Promise<SendResult> {
      try {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            sender: { email: from, name: fromName },
            to: [{ email: message.to }],
            subject: message.subject,
            htmlContent: message.html,
            textContent: message.text,
            ...(message.replyTo ? { replyTo: { email: message.replyTo } } : {}),
          }),
        });

        if (!res.ok) return classifyHttpFailure(res.status, await res.text());
        const body = (await res.json()) as { messageId?: string };
        return { ok: true, providerMessageId: body.messageId ?? null };
      } catch (err) {
        return { ok: false, error: String(err), retryable: true };
      }
    },
  };
}
