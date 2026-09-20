import type { EmailProvider } from "./types";
import { createResendProvider } from "./resend";
import { createBrevoProvider } from "./brevo";
import { createSmtpProvider } from "./smtp";
import { createConsoleProvider } from "./console";

export type { EmailProvider, EmailMessage, SendResult } from "./types";

export const SUPPORTED_PROVIDERS = ["resend", "brevo", "smtp", "console"] as const;
export type ProviderName = (typeof SUPPORTED_PROVIDERS)[number];

/**
 * Resolve the configured provider. Selection is `EMAIL_PROVIDER`; credentials
 * live in that provider's own variables. Switching providers for the November
 * District conference is this one variable plus a redeploy.
 */
export function createEmailProvider(
  env: Record<string, string | undefined> = process.env,
): EmailProvider {
  const name = (env.EMAIL_PROVIDER ?? "console").toLowerCase();

  switch (name) {
    case "resend":
      return createResendProvider(env);
    case "brevo":
      return createBrevoProvider(env);
    case "smtp":
      return createSmtpProvider(env);
    case "console":
      return createConsoleProvider();
    default:
      throw new Error(
        `Unknown EMAIL_PROVIDER "${name}". Supported: ${SUPPORTED_PROVIDERS.join(", ")}`,
      );
  }
}
