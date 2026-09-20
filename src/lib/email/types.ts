export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export type SendResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; error: string; retryable: boolean };

/**
 * Every provider implements exactly this. Swapping providers is an env change,
 * never a code change — which matters because the free tiers that comfortably
 * cover a 150-200 person Division conference will not cover the 400-500 person
 * District conference, and that switch should not land as a rewrite under
 * deadline pressure.
 */
export interface EmailProvider {
  readonly name: string;
  /** Cheap credential/connectivity check, for the admin health panel. */
  verify(): Promise<{ ok: boolean; detail: string }>;
  send(message: EmailMessage): Promise<SendResult>;
}

/**
 * Providers should mark 4xx client errors (bad key, bad address, rejected
 * content) as non-retryable and 429/5xx/network faults as retryable, so the
 * outbox stops hammering on a permanent failure but rides out a rate limit.
 */
export function classifyHttpFailure(status: number, body: string): SendResult {
  const retryable = status === 429 || status >= 500;
  return { ok: false, error: `HTTP ${status}: ${body.slice(0, 300)}`, retryable };
}
