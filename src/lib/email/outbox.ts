import type { EmailProvider } from "./types";
import { renderEmail, type TemplateName, type TemplateData } from "./templates";

export type OutboxEntry = {
  id: string;
  registrationId: string | null;
  /**
   * Unique per (registration, template). The uniqueness constraint on this
   * column is what guarantees a member is never told twice that they are
   * confirmed, even if reconciliation runs repeatedly.
   */
  idempotencyKey: string;
  to: string;
  template: TemplateName;
  data: TemplateData;
  attempts: number;
  nextAttemptAt: string;
};

export interface OutboxStore {
  /** Entries due at or before `now`, oldest first. */
  claimDue(limit: number, now: Date): Promise<OutboxEntry[]>;
  markSent(id: string, providerMessageId: string | null): Promise<void>;
  markRetry(id: string, attempts: number, nextAttemptAt: Date, error: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}

export const MAX_ATTEMPTS = 6;

/** Exponential backoff: 1, 2, 4, 8, 16, 32 minutes, capped at an hour. */
export function backoffMs(attempts: number): number {
  return Math.min(60 * 1000 * 2 ** (attempts - 1), 60 * 60 * 1000);
}

export type ProcessSummary = { sent: number; retried: number; failed: number };

/**
 * Drain due outbox entries through the configured provider.
 *
 * Sending is deliberately decoupled from reconciliation: a provider outage or
 * a tripped rate limit on a free tier delays confirmations instead of losing
 * them or stalling the matching run. Permanent failures (bad address, rejected
 * key) stop immediately rather than burning the daily quota on retries.
 */
export async function processOutbox(
  store: OutboxStore,
  provider: EmailProvider,
  opts: { now?: Date; limit?: number; maxAttempts?: number } = {},
): Promise<ProcessSummary> {
  const now = opts.now ?? new Date();
  const limit = opts.limit ?? 50;
  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;

  const due = await store.claimDue(limit, now);
  const summary: ProcessSummary = { sent: 0, retried: 0, failed: 0 };

  for (const entry of due) {
    const message = {
      ...renderEmail(entry.template, entry.data),
      to: entry.to,
      replyTo: entry.data.supportEmail || undefined,
    };
    const result = await provider.send(message);

    if (result.ok) {
      await store.markSent(entry.id, result.providerMessageId);
      summary.sent++;
      continue;
    }

    const attempts = entry.attempts + 1;

    if (!result.retryable || attempts >= maxAttempts) {
      const why = result.retryable
        ? `gave up after ${attempts} attempts: ${result.error}`
        : result.error;
      await store.markFailed(entry.id, why);
      summary.failed++;
      continue;
    }

    await store.markRetry(
      entry.id,
      attempts,
      new Date(now.getTime() + backoffMs(attempts)),
      result.error,
    );
    summary.retried++;
  }

  return summary;
}

/** Build the idempotency key for a registration/template pair. */
export function outboxKey(registrationId: string, template: TemplateName): string {
  return `${registrationId}:${template}`;
}

export type { TemplateName, TemplateData };
