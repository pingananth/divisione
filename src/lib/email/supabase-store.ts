import type { SupabaseClient } from "@supabase/supabase-js";
import type { OutboxStore, OutboxEntry } from "./outbox";
import type { TemplateName, TemplateData } from "./templates";

type OutboxRow = {
  id: string;
  registration_id: string | null;
  idempotency_key: string;
  recipient: string;
  template: string;
  data: TemplateData;
  attempts: number;
  next_attempt_at: string;
};

/**
 * Supabase-backed outbox. Uses the service-role client: email_outbox has RLS
 * enabled with no policies at all, so nothing but server-side code can read
 * members' addresses out of it.
 */
export function supabaseOutboxStore(db: SupabaseClient, providerName: string): OutboxStore {
  return {
    async claimDue(limit, now) {
      const { data, error } = await db
        .from("email_outbox")
        .select("*")
        .eq("status", "pending")
        .lte("next_attempt_at", now.toISOString())
        .order("next_attempt_at", { ascending: true })
        .limit(limit);

      if (error) throw new Error(`Failed to read outbox: ${error.message}`);

      return (data as OutboxRow[]).map(
        (r): OutboxEntry => ({
          id: r.id,
          registrationId: r.registration_id,
          idempotencyKey: r.idempotency_key,
          to: r.recipient,
          template: r.template as TemplateName,
          data: r.data,
          attempts: r.attempts,
          nextAttemptAt: r.next_attempt_at,
        }),
      );
    },

    async markSent(id, providerMessageId) {
      const { error } = await db
        .from("email_outbox")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider: providerName,
          provider_message_id: providerMessageId,
          last_error: null,
        })
        .eq("id", id);
      if (error) throw new Error(`Failed to mark outbox ${id} sent: ${error.message}`);
    },

    async markRetry(id, attempts, nextAttemptAt, lastError) {
      const { error } = await db
        .from("email_outbox")
        .update({
          attempts,
          next_attempt_at: nextAttemptAt.toISOString(),
          last_error: lastError,
          provider: providerName,
        })
        .eq("id", id);
      if (error) throw new Error(`Failed to reschedule outbox ${id}: ${error.message}`);
    },

    async markFailed(id, lastError) {
      const { error } = await db
        .from("email_outbox")
        .update({ status: "failed", last_error: lastError, provider: providerName })
        .eq("id", id);
      if (error) throw new Error(`Failed to mark outbox ${id} failed: ${error.message}`);
    },
  };
}
