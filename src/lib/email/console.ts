import type { EmailProvider, EmailMessage, SendResult } from "./types";

/**
 * Development provider. Logs instead of sending, so local work and staging
 * never mail real Toastmasters members by accident.
 */
export function createConsoleProvider(): EmailProvider {
  return {
    name: "console",
    async verify() {
      return { ok: true, detail: "Console provider: emails are logged, not sent" };
    },
    async send(message: EmailMessage): Promise<SendResult> {
      console.info(
        `[email:console] to=${message.to} subject=${JSON.stringify(message.subject)}\n${message.text}`,
      );
      return { ok: true, providerMessageId: `console-${Date.now()}` };
    },
  };
}
